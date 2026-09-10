"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { parsePublicationTarget } from "@/lib/publications/targets";
import { createClient } from "@/lib/supabase/server";

function safeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "material.png";
}

export async function createCampaignPublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const target = parsePublicationTarget(String(formData.get("target") ?? ""));
  const caption = String(formData.get("caption") ?? "").trim();
  const materialPaths = [...new Set(formData.getAll("material_path").map((value) => String(value).trim()).filter(Boolean))].slice(0, 10);

  if (!campaignId || !target || target.type === "reel") return;
  const requiredMin = target.type === "carousel" ? 2 : 1;
  const requiredMax = target.type === "carousel" ? 10 : 1;
  if (materialPaths.length < requiredMin || materialPaths.length > requiredMax) return;
  if (materialPaths.some((path) => !path.startsWith(`${campaignId}/`) || !path.toLowerCase().endsWith(".png"))) return;

  const supabase = await createClient();
  const { data: campaign } = await supabase.from("campaigns").select("id,name").eq("id", campaignId).maybeSingle();
  if (!campaign) return;

  const { data: publication, error: publicationError } = await supabase
    .from("publications")
    .insert({
      campaign_id: campaignId,
      network: target.network,
      type: target.type,
      caption: caption || null,
      status: "draft",
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (publicationError || !publication) return;

  const createdPaths: string[] = [];
  try {
    for (let index = 0; index < materialPaths.length; index++) {
      const materialPath = materialPaths[index];
      const { data: file, error: downloadError } = await supabase.storage.from("digital-materials").download(materialPath);
      if (downloadError || !file) throw downloadError || new Error("Falha ao carregar material salvo.");

      const filename = materialPath.split("/").pop() || `material-${index + 1}.png`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const publicPath = `${campaignId}/publications/${publication.id}/${timestamp}-${index}-${safeName(filename)}`;
      const bytes = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage.from("social-media").upload(publicPath, bytes, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;
      createdPaths.push(publicPath);

      const { data: publicUrl } = supabase.storage.from("social-media").getPublicUrl(publicPath);
      const { error: mediaError } = await supabase.from("publication_media").insert({
        publication_id: publication.id,
        storage_path: publicPath,
        public_url: publicUrl.publicUrl,
        media_type: "image",
        sort_order: index,
      });
      if (mediaError) throw mediaError;
    }

    await supabase.from("audit_logs").insert({
      actor_id: profile.id,
      action: "publication_created_from_campaign_materials",
      entity_type: "publication",
      entity_id: publication.id,
      details: { campaign_id: campaignId, target: `${target.network}:${target.type}`, media_count: materialPaths.length },
    });
  } catch (error) {
    console.error("campaign publication creation failed", error);
    if (createdPaths.length) await supabase.storage.from("social-media").remove(createdPaths);
    await supabase.from("publication_media").delete().eq("publication_id", publication.id);
    await supabase.from("publications").delete().eq("id", publication.id);
    return;
  }

  revalidatePath("/app");
  revalidatePath("/app/publicacoes");
  revalidatePath(`/app/campanhas/${campaignId}`);
  redirect(`/app/publicacoes/${publication.id}`);
}
