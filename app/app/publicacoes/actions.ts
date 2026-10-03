"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { publishPublication } from "@/lib/meta/publisher";
import { validatePublicationMedia } from "@/lib/publications/validation";
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

export async function createIndependentPublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const network = String(formData.get("network") ?? "instagram").trim();
  const type = String(formData.get("type") ?? "feed").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const campaignId = String(formData.get("campaign_id") ?? "").trim() || null;

  if (!networks.has(network) || !types.has(type)) return;

  const supabase = await createClient();

  if (campaignId) {
    const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", campaignId).maybeSingle();
    if (!campaign) return;
  }

  const { data: publication, error } = await supabase
    .from("publications")
    .insert({
      campaign_id: campaignId,
      network,
      type,
      caption: caption || null,
      status: "draft",
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !publication) return;

  revalidatePath("/app/publicacoes");
  redirect(`/app/publicacoes/${publication.id}/midia`);
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
  const { data: publication, error: publicationError } = await supabase
    .from("publications")
    .select("id,campaign_id,status")
    .eq("id", id)
    .maybeSingle();
  if (publicationError) {
    console.error("Cannot load publication before adding media", { id, error: publicationError.message });
    return;
  }

  if (!publication || !publication.campaign_id || !["draft", "scheduled", "error", "cancelled"].includes(publication.status)) return;
  if (!materialPath.startsWith(`${publication.campaign_id}/`)) return;

  const { count, error: countError } = await supabase
    .from("publication_media")
    .select("id", { count: "exact", head: true })
    .eq("publication_id", id);
  if (countError || count === null) {
    console.error("Cannot verify publication media limit", { id, error: countError?.message });
    return;
  }
  if (count >= 10) return;

  const { data: source, error: downloadError } = await supabase.storage.from("digital-materials").download(materialPath);
  if (downloadError || !source) return;

  const sourceName = materialPath.split("/").pop() || "material.png";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  // A timestamp alone is not unique when two uploads begin within the same millisecond.
  const publicPath = `${publication.campaign_id}/drafts/${timestamp}-${crypto.randomUUID()}-${safePathPart(sourceName)}`;
  const bytes = await source.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("social-media")
    .upload(publicPath, bytes, { contentType: source.type || "image/png", upsert: false });
  if (uploadError) return;

  const { data: publicUrlData } = supabase.storage.from("social-media").getPublicUrl(publicPath);
  const { data: lastMedia, error: orderError } = await supabase
    .from("publication_media")
    .select("sort_order")
    .eq("publication_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) {
    console.error("Cannot determine publication media ordering", { id, error: orderError.message });
    const { error: cleanupError } = await supabase.storage.from("social-media").remove([publicPath]);
    if (cleanupError) console.error("Cannot clean up publication media after ordering failure", { id, publicPath, error: cleanupError.message });
    return;
  }

  const { error: mediaError } = await supabase.from("publication_media").insert({
    publication_id: id,
    storage_path: publicPath,
    public_url: publicUrlData.publicUrl,
    media_type: "image",
    sort_order: (lastMedia?.sort_order ?? -1) + 1,
  });

  if (mediaError) {
    console.error("Cannot register uploaded publication media", { id, error: mediaError.message });
    const { error: cleanupError } = await supabase.storage.from("social-media").remove([publicPath]);
    if (cleanupError) console.error("Cannot clean up unregistered publication media", { id, publicPath, error: cleanupError.message });
    return;
  }
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function removePublicationMediaAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "").trim();
  const mediaId = String(formData.get("media_id") ?? "").trim();
  if (!id || !mediaId) return;

  const supabase = await createClient();
  const { data: publication, error: publicationError } = await supabase.from("publications").select("status").eq("id", id).maybeSingle();
  if (publicationError) {
    console.error("Cannot check publication state before media removal", { id, error: publicationError.message });
    return;
  }
  if (!publication || !["draft", "scheduled", "error", "cancelled"].includes(publication.status)) return;

  const { data: media, error: mediaError } = await supabase
    .from("publication_media")
    .select("id,storage_path")
    .eq("id", mediaId)
    .eq("publication_id", id)
    .maybeSingle();
  if (mediaError) {
    console.error("Cannot load publication media for removal", { id, mediaId, error: mediaError.message });
    return;
  }
  if (!media) return;

  // Do not remove the Storage object unless the relational delete succeeded.
  const { data: deleted, error: deleteError } = await supabase.from("publication_media")
    .delete().eq("id", mediaId).eq("publication_id", id).select("id").maybeSingle();
  if (deleteError || !deleted) {
    console.error("Publication media deletion not confirmed; Storage retained", { id, mediaId, error: deleteError?.message });
    return;
  }
  if (media.storage_path) {
    const { error: storageError } = await supabase.storage.from("social-media").remove([media.storage_path]);
    if (storageError) console.error("Publication media Storage cleanup failed", { id, mediaId, error: storageError.message });
  }
  revalidatePath(`/app/publicacoes/${id}`);
  revalidatePath(`/app/publicacoes/${id}/midia`);
}

export async function schedulePublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "");
  const scheduledInput = String(formData.get("scheduled_at") ?? "");
  const scheduledAt = localDateTimeToIso(scheduledInput);
  if (!id || !scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) return;

  const supabase = await createClient();
  const [{ data: publication, error: publicationError }, { data: media, error: mediaError }] = await Promise.all([
    supabase.from("publications").select("network,type,status").eq("id", id).maybeSingle(),
    supabase.from("publication_media").select("media_type,public_url").eq("publication_id", id),
  ]);

  if (publicationError || mediaError) {
    console.error("Cannot validate publication scheduling prerequisites", { id, publicationError: publicationError?.message, mediaError: mediaError?.message });
    return;
  }
  if (!publication || !["draft", "scheduled", "error", "cancelled"].includes(publication.status)) return;

  const validation = validatePublicationMedia(publication, media ?? []);
  if (!validation.ok) {
    await supabase
      .from("publications")
      .update({ error_message: `Não foi possível agendar: ${validation.message}`, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", ["draft", "scheduled", "error", "cancelled"]);
    revalidatePath(`/app/publicacoes/${id}`);
    return;
  }

  const { data: scheduled, error } = await supabase
    .from("publications")
    .update({ status: "scheduled", scheduled_at: scheduledAt, error_message: null, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", publication.status)
    .eq("network", publication.network)
    .eq("type", publication.type)
    .select("id")
    .maybeSingle();

  if (error || !scheduled) {
    console.error("Publication scheduling not confirmed; state or format may have changed", { id, error: error?.message });
    return;
  }
  revalidatePath("/app/publicacoes");
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function cancelScheduledPublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { data: cancelled, error: cancelError } = await supabase
    .from("publications")
    .update({ status: "cancelled", scheduled_at: null, error_message: null, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (cancelError || !cancelled) {
    console.error("Publication cancellation not confirmed", { id, error: cancelError?.message });
    return;
  }

  revalidatePath("/app/publicacoes");
  revalidatePath(`/app/publicacoes/${id}`);
}

export async function retryPublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  try {
    await publishPublication(id, ["error"]);
  } catch (error) {
    console.error("retry Meta publication failed", error);
  }

  revalidatePath("/app/publicacoes");
  revalidatePath(`/app/publicacoes/${id}`);
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
  const { data: publication, error: publicationError } = await supabase.from("publications").select("status").eq("id", id).maybeSingle();
  if (publicationError) {
    console.error("Cannot determine publication deletion eligibility", { id, error: publicationError.message });
    return;
  }
  if (!publication || !["draft", "cancelled", "error"].includes(publication.status)) return;

  const { data: media, error: mediaError } = await supabase.from("publication_media").select("storage_path").eq("publication_id", id);
  if (mediaError) {
    console.error("Cannot safely delete publication without media inventory", { id, error: mediaError.message });
    return;
  }
  // publication_media has an ON DELETE CASCADE foreign key; delete the parent
  // conditionally and only clean Storage after the database confirms deletion.
  const { data: deleted, error: deleteError } = await supabase.from("publications")
    .delete().eq("id", id).in("status", ["draft", "cancelled", "error"]).select("id").maybeSingle();
  if (deleteError || !deleted) {
    console.error("Publication deletion not confirmed; media Storage retained", { id, error: deleteError?.message });
    return;
  }
  const paths = (media ?? []).map((item) => item.storage_path).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from("social-media").remove(paths);
    if (storageError) console.error("Publication Storage cleanup failed", { id, error: storageError.message });
  }
  revalidatePath("/app/publicacoes");
  redirect("/app/publicacoes");
}
