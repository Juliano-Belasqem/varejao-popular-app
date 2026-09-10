"use server";

import { revalidatePath } from "next/cache";
import { canEdit, requireProfile } from "@/lib/auth";
import { publishPublication } from "@/lib/meta/publisher";
import { createClient } from "@/lib/supabase/server";

function selectedIds(formData: FormData) {
  return [...new Set(formData.getAll("publication_id").map((value) => String(value).trim()).filter(Boolean))].slice(0, 50);
}

async function audit(actorId: string, action: string, ids: string[], details?: Record<string, unknown>) {
  const supabase = await createClient();
  if (!ids.length) return;
  await supabase.from("audit_logs").insert(ids.map((id) => ({
    actor_id: actorId,
    action,
    entity_type: "publication",
    entity_id: id,
    details: details ?? {},
  })));
}

export async function bulkPublicationAction(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) return;

  const ids = selectedIds(formData);
  const action = String(formData.get("bulk_action") ?? "");
  if (!ids.length) return;

  const supabase = await createClient();

  if (action === "cancel") {
    const { data } = await supabase
      .from("publications")
      .update({ status: "cancelled", scheduled_at: null, error_message: null, updated_by: profile.id, updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "scheduled")
      .select("id");
    await audit(profile.id, "publication_bulk_cancelled", (data ?? []).map((item) => item.id));
  }

  if (action === "delete_drafts") {
    const { data: eligible } = await supabase
      .from("publications")
      .select("id")
      .in("id", ids)
      .in("status", ["draft", "cancelled", "error"]);
    const eligibleIds = (eligible ?? []).map((item) => item.id);
    if (eligibleIds.length) {
      const { data: media } = await supabase
        .from("publication_media")
        .select("publication_id,storage_path")
        .in("publication_id", eligibleIds);
      await supabase.from("publication_media").delete().in("publication_id", eligibleIds);
      await supabase.from("publications").delete().in("id", eligibleIds);
      const paths = (media ?? []).map((item) => item.storage_path).filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from("social-media").remove(paths);
      await audit(profile.id, "publication_bulk_deleted", eligibleIds);
    }
  }

  if (action === "retry_errors") {
    const { data: eligible } = await supabase
      .from("publications")
      .select("id")
      .in("id", ids)
      .eq("status", "error");
    const eligibleIds = (eligible ?? []).map((item) => item.id);
    for (const id of eligibleIds) {
      try {
        await publishPublication(id, ["error"]);
      } catch (error) {
        console.error("bulk retry publication failed", id, error);
      }
    }
    await audit(profile.id, "publication_bulk_retry", eligibleIds);
  }

  revalidatePath("/app");
  revalidatePath("/app/publicacoes");
}
