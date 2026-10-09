"use server";

import { revalidatePath } from "next/cache";
import { canEdit, isAdmin, requireProfile } from "@/lib/auth";
import { parseRelationItems } from "@/lib/supplier-relations";
import { createClient } from "@/lib/supabase/server";

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || null;

async function editorContext() {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar relações.");
  return { profile, supabase: await createClient() };
}

async function saveItems(supabase: Awaited<ReturnType<typeof createClient>>, relationId: string, supplierId: string, items: ReturnType<typeof parseRelationItems>) {
  const productIds = [...new Set(items.map((item) => item.product_id))];
  const { data: products, error: productsError } = await supabase.from("products").select("id").in("id", productIds);
  if (productsError || products?.length !== productIds.length) throw new Error("Um ou mais produtos não foram encontrados.");
  const occurrenceIds = items.map((item) => item.occurrence_id).filter(Boolean) as string[];
  if (occurrenceIds.length) {
    const { data: occurrences, error } = await supabase.from("supplier_occurrences").select("id").eq("supplier_id", supplierId).in("id", occurrenceIds);
    if (error || occurrences?.length !== occurrenceIds.length) throw new Error("Ocorrência inválida para este fornecedor.");
  }
  const { error } = await supabase.from("supplier_relation_items").insert(items.map((item) => ({ relation_id: relationId, product_id: item.product_id, quantity: item.quantity, occurrence_id: item.occurrence_id })));
  if (error) throw new Error(error.message);
}

export async function createSupplier(formData: FormData) {
  const { profile, supabase } = await editorContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome do fornecedor é obrigatório.");
  const { error } = await supabase.from("suppliers").insert({ name, document: text(formData.get("document")), contact_name: text(formData.get("contact_name")), contact_phone: text(formData.get("contact_phone")), created_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/app/relacoes");
}

export async function createOccurrence(formData: FormData) {
  const { profile, supabase } = await editorContext();
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!supplierId || !text(formData.get("reference"))) throw new Error("Fornecedor e referência da ocorrência são obrigatórios.");
  const { error } = await supabase.from("supplier_occurrences").insert({ supplier_id: supplierId, reference: text(formData.get("reference")), occurred_on: text(formData.get("occurred_on")), notes: text(formData.get("notes")), created_by: profile.id });
  if (error) throw new Error(error.message);
  revalidatePath("/app/relacoes");
}

export async function createRelation(formData: FormData) {
  const { profile, supabase } = await editorContext();
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!supplierId) throw new Error("Selecione um fornecedor.");
  const items = parseRelationItems(formData.get("items_json"));
  const { data: relation, error } = await supabase.from("supplier_relations").insert({ supplier_id: supplierId, notes: text(formData.get("notes")), created_by: profile.id, updated_by: profile.id }).select("id").single();
  if (error || !relation) throw new Error(error?.message ?? "Não foi possível criar a relação.");
  try { await saveItems(supabase, relation.id, supplierId, items); } catch (error) { await supabase.from("supplier_relations").delete().eq("id", relation.id); throw error; }
  revalidatePath("/app/relacoes");
}

export async function finalizeRelation(formData: FormData) {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) throw new Error("Somente administradores podem finalizar relações.");
  const id = String(formData.get("id") ?? "");
  const { error } = await (await createClient()).rpc("finalize_supplier_relation", { p_relation_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/app/relacoes");
}

export async function cancelRelation(formData: FormData) {
  const profile = await requireProfile();
  if (!isAdmin(profile.role)) throw new Error("Somente administradores podem cancelar relações.");
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("Informe o motivo do cancelamento.");
  const { error } = await (await createClient()).rpc("cancel_supplier_relation", { p_relation_id: id, p_reason: reason });
  if (error) throw new Error(error.message);
  revalidatePath("/app/relacoes");
}
