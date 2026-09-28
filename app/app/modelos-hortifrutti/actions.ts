"use server";

import { revalidatePath } from "next/cache";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function saveProduceProduct(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar o cadastro de hortifrutti.");
  const id = value(formData, "id");
  const name = value(formData, "name");
  const specification = value(formData, "specification");
  const unit = value(formData, "unit").toUpperCase();
  const code = value(formData, "code");
  if (!name || !unit || !code) throw new Error("Nome, unidade e código são obrigatórios.");
  if (name.length > 160 || specification.length > 160 || unit.length > 24 || code.length > 64) throw new Error("Um dos campos excede o tamanho permitido.");
  const supabase = await createClient();
  const payload = { name, specification, unit, code, active: true, updated_by: profile.id };
  const result = id
    ? await supabase.from("produce_template_products").update(payload).eq("id", id)
    : await supabase.from("produce_template_products").insert({ ...payload, created_by: profile.id });
  if (result.error) {
    if (result.error.code === "23505") throw new Error("Já existe um item de hortifrutti com esse código.");
    if (result.error.code === "23514" || result.error.code === "22001") throw new Error("Revise nome, unidade e código: um dos valores não é aceito pelo cadastro.");
    throw new Error(`Não foi possível salvar o item: ${result.error.message}`);
  }
  revalidatePath("/app/modelos-hortifrutti");
}

export async function deleteProduceProduct(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar o cadastro de hortifrutti.");
  const id = value(formData, "id");
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("produce_template_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/app/modelos-hortifrutti");
}
