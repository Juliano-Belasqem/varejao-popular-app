"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const networks = new Set(["instagram", "facebook"]);
const types = new Set(["feed", "story", "carousel", "reel"]);

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${normalized}-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

  await supabase.from("publication_media").delete().eq("publication_id", id);
  await supabase.from("publications").delete().eq("id", id);
  revalidatePath("/app/publicacoes");
  redirect("/app/publicacoes");
}
