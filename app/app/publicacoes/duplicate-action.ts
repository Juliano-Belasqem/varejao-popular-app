"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function safeFileName(path: string, index: number) {
  const name = path.split("/").pop() || `midia-${index + 1}`;
  return `${index + 1}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 140);
}

export async function duplicatePublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const sourceId = String(formData.get("id") ?? "").trim();
  if (!sourceId) return;

  const supabase = await createClient();
  const [{ data: source, error: sourceError }, { data: sourceMedia, error: mediaError }] = await Promise.all([
    supabase
      .from("publications")
      .select("campaign_id,network,type,caption")
      .eq("id", sourceId)
      .maybeSingle(),
    supabase
      .from("publication_media")
      .select("storage_path,public_url,media_type,sort_order")
      .eq("publication_id", sourceId)
      .order("sort_order", { ascending: true }),
  ]);

  if (sourceError || mediaError || !source) return;

  const { data: duplicate, error: insertError } = await supabase
    .from("publications")
    .insert({
      campaign_id: source.campaign_id,
      network: source.network,
      type: source.type,
      caption: source.caption,
      status: "draft",
      scheduled_at: null,
      published_at: null,
      error_message: null,
      meta_media_id: null,
      meta_post_id: null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError || !duplicate) return;

  const copiedPaths: string[] = [];
  try {
    for (const [index, item] of (sourceMedia ?? []).entries()) {
      if (!item.storage_path) continue;
      const targetPath = `duplicates/${duplicate.id}/${safeFileName(item.storage_path, index)}`;
      const { error: copyError } = await supabase.storage.from("social-media").copy(item.storage_path, targetPath);
      if (copyError) throw copyError;
      copiedPaths.push(targetPath);

      const { data: publicUrlData } = supabase.storage.from("social-media").getPublicUrl(targetPath);
      const { error: duplicateMediaError } = await supabase.from("publication_media").insert({
        publication_id: duplicate.id,
        storage_path: targetPath,
        public_url: publicUrlData.publicUrl,
        media_type: item.media_type,
        sort_order: item.sort_order,
      });
      if (duplicateMediaError) throw duplicateMediaError;
    }
  } catch (error) {
    await supabase.from("publication_media").delete().eq("publication_id", duplicate.id);
    if (copiedPaths.length) await supabase.storage.from("social-media").remove(copiedPaths);
    await supabase.from("publications").delete().eq("id", duplicate.id);
    console.error("publication duplication failed", error);
    return;
  }

  revalidatePath("/app/publicacoes");
  redirect(`/app/publicacoes/${duplicate.id}`);
}
