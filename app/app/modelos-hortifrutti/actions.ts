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

export async function uploadProducePdf(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para enviar modelos.");
  const id = value(formData,"id");
  const file = formData.get("pdf");
  if (!id || !(file instanceof File) || file.type !== "application/pdf" || file.size < 5 || file.size > 10*1024*1024)
    throw new Error("Selecione um PDF válido de até 10 MB.");
  const header = new Uint8Array(await file.slice(0,5).arrayBuffer());
  if (String.fromCharCode(...header) !== "%PDF-") throw new Error("O arquivo enviado não possui uma assinatura PDF válida.");
  const supabase = await createClient();
  const { data: product, error: lookupError } = await supabase.from("produce_template_products").select("id,pdf_path").eq("id",id).single();
  if (lookupError || !product) throw new Error("Produto não encontrado.");
  const path = `${id}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("produce-pdfs").upload(path,await file.arrayBuffer(),{contentType:"application/pdf",upsert:false});
  if (uploadError) throw new Error(uploadError.message);
  // Compare the previously read path to avoid overwriting another user's newer upload.
  let update = supabase.from("produce_template_products")
    .update({pdf_path:path,updated_by:profile.id}).eq("id",id);
  update = product.pdf_path ? update.eq("pdf_path",product.pdf_path) : update.is("pdf_path",null);
  const { data: saved, error: saveError } = await update.select("id").maybeSingle();
  if (saveError || !saved) {
    // The newly uploaded object is the only one eligible for compensation.
    // Preserve the old PDF and log a cleanup failure so an orphan can be recovered later.
    const { error: cleanupError } = await supabase.storage.from("produce-pdfs").remove([path]);
    if (cleanupError) {
      console.error("Could not clean up unregistered produce PDF", { id, path, error: cleanupError.message });
    }
    throw new Error(saveError?.message || "O PDF foi alterado em outra sessão. Recarregue antes de enviar novamente.");
  }
  // Retain previous PDF objects for recovery; a separate cleanup can remove orphaned files after backup.
  revalidatePath("/app/modelos-hortifrutti");
}
export async function removeProducePdf(formData: FormData) {
  const profile=await requireProfile();
  if(!canEdit(profile.role))throw new Error("Sem permissão.");
  const id=value(formData,"id");
  if (!id) return;
  const supabase=await createClient();
  const {data:product,error}=await supabase.from("produce_template_products").select("pdf_path").eq("id",id).single();
  if(error)throw new Error(error.message);
  if (!product.pdf_path) return;
  const {data:saved,error:saveError}=await supabase.from("produce_template_products")
    .update({pdf_path:null,updated_by:profile.id}).eq("id",id)
    .eq("pdf_path",product.pdf_path).select("id").maybeSingle();
  if(saveError||!saved)throw new Error(saveError?.message||"O PDF foi alterado em outra sessão. Recarregue antes de remover.");
  // Keep the detached object for recovery; do not delete files during the live edit.
  revalidatePath("/app/modelos-hortifrutti");
}
