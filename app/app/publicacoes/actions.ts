"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { publishPublication } from "@/lib/meta/publisher";
import { createClient } from "@/lib/supabase/server";

const networks = new Set(["instagram", "facebook"]);
const types = new Set(["feed", "story", "carousel", "reel"]);

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${normalized}-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function safePathPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "material.png";
}

export async function savePublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "");
  const network = String(formData.get("network") ?? "");
  const type = String(formData.get("type") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();

  if (!id || !networks.has(network) || !types.has(type)) return;

  const supabase = await createClient();
  await supabase
    .from("publications")
    .update({ network, type, caption: caption || null, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "scheduled", "error", "cancelled"]);

  revalidatePath("/app/publicacoes");
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function addPublicationMediaAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "").trim();
  const materialPath = String(formData.get("material_path") ?? "").trim();
  if (!id || !materialPath) return;

  const supabase = await createClient();
  const { data: publication } = await supabase
    .from("publications")
    .select("id,campaign_id,status")
    .eq("id", id)
    .maybeSingle();

  if (!publication || !publication.campaign_id || !["draft", "scheduled", "error", "cancelled"].includes(publication.status)) return;
  if (!materialPath.startsWith(`${publication.campaign_id}/`)) return;

  const { count } = await supabase
    .from("publication_media")
    .select("id", { count: "exact", head: true })
    .eq("publication_id", id);
  if ((count ?? 0) >= 10) return;

  const { data: source, error: downloadError } = await supabase.storage.from("digital-materials").download(materialPath);
  if (downloadError || !source) return;

  const sourceName = materialPath.split("/").pop() || "material.png";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const publicPath = `${publication.campaign_id}/drafts/${timestamp}-${safePathPart(sourceName)}`;
  const bytes = await source.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("social-media")
    .upload(publicPath, bytes, { contentType: source.type || "image/png", upsert: false });
  if (uploadError) return;

  const { data: publicUrlData } = supabase.storage.from("social-media").getPublicUrl(publicPath);
  const { data: lastMedia } = await supabase
    .from("publication_media")
    .select("sort_order")
    .eq("publication_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: mediaError } = await supabase.from("publication_media").insert({
    publication_id: id,
    storage_path: publicPath,
    public_url: publicUrlData.publicUrl,
    media_type: "image",
    sort_order: (lastMedia?.sort_order ?? -1) + 1,
  });

  if (mediaError) await supabase.storage.from("social-media").remove([publicPath]);
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function removePublicationMediaAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "").trim();
  const mediaId = String(formData.get("media_id") ?? "").trim();
  if (!id || !mediaId) return;

  const supabase = await createClient();
  const { data: publication } = await supabase.from("publications").select("status").eq("id", id).maybeSingle();
  if (!publication || !["draft", "scheduled", "error", "cancelled"].includes(publication.status)) return;

  const { data: media } = await supabase
    .from("publication_media")
    .select("id,storage_path")
    .eq("id", mediaId)
    .eq("publication_id", id)
    .maybeSingle();
  if (!media) return;

  await supabase.from("publication_media").delete().eq("id", mediaId).eq("publication_id", id);
  if (media.storage_path) await supabase.storage.from("social-media").remove([media.storage_path]);
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function schedulePublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "");
  const scheduledInput = String(formData.get("scheduled_at") ?? "");
  const scheduledAt = localDateTimeToIso(scheduledInput);
  if (!id || !scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("publications")
    .update({ status: "scheduled", scheduled_at: scheduledAt, error_message: null, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "scheduled", "error", "cancelled"]);

  if (!error) {
    revalidatePath("/app/publicacoes");
    revalidatePath(`/app/publicacoes/${id}`);
  }
}

export async function publishNowAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  try {
    await publishPublication(id, ["draft", "scheduled", "error"]);
  } catch (error) {
    console.error("manual Meta publication failed", error);
  }

  revalidatePath("/app/publicacoes");
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function returnToDraftAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("publications")
    .update({ status: "draft", scheduled_at: null, error_message: null, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["scheduled", "error", "cancelled"]);

  revalidatePath("/app/publicacoes");
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function deleteDraftAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: publication } = await supabase.from("publications").select("status").eq("id", id).maybeSingle();
  if (!publication || !["draft", "cancelled", "error"].includes(publication.status)) return;

  const { data: media } = await supabase.from("publication_media").select("storage_path").eq("publication_id", id);
  await supabase.from("publication_media").delete().eq("publication_id", id);
  await supabase.from("publications").delete().eq("id", id);
  const paths = (media ?? []).map((item) => item.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from("social-media").remove(paths);
  revalidatePath("/app/publicacoes");
  redirect("/app/publicacoes");
}
