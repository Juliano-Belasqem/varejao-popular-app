"use server";

import { revalidatePath } from "next/cache";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function numberValue(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function editorContext() {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar campanhas.");
  return { profile, supabase: await createClient() };
}

export async function createCampaign(formData: FormData) {
  const { profile, supabase } = await editorContext();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome da campanha é obrigatório.");

  const { error } = await supabase.from("campaigns").insert({
    name,
    start_date: text(formData.get("start_date")),
    end_date: text(formData.get("end_date")),
    theme: text(formData.get("theme")) ?? "Padrão",
    format: text(formData.get("format")) ?? "Físico + Digital",
    status: "draft",
    created_by: profile.id,
    updated_by: profile.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/app/campanhas");
  revalidatePath("/app");
}

export async function updateCampaign(formData: FormData) {
  const { profile, supabase } = await editorContext();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  if (!id || !name) throw new Error("Campanha inválida.");
  if (!["draft", "approved", "archived"].includes(status)) throw new Error("Status inválido.");

  const { error } = await supabase.from("campaigns").update({
    name,
    start_date: text(formData.get("start_date")),
    end_date: text(formData.get("end_date")),
    theme: text(formData.get("theme")) ?? "Padrão",
    format: text(formData.get("format")) ?? "Físico + Digital",
    status,
    updated_by: profile.id,
  }).eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/app/campanhas");
  revalidatePath(`/app/campanhas/${id}`);
  revalidatePath("/app");
}

export async function addCampaignItem(formData: FormData) {
  const { supabase } = await editorContext();
  const campaignId = String(formData.get("campaign_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!campaignId || !productId) throw new Error("Campanha e produto são obrigatórios.");

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("ean,name,brand,specification,sale_price")
    .eq("id", productId)
    .single();

  if (productError || !product) throw new Error("Produto não encontrado.");

  const normalPrice = numberValue(formData.get("normal_price")) ?? product.sale_price;
  const offerPrice = numberValue(formData.get("offer_price"));

  const { error } = await supabase.from("campaign_items").insert({
    campaign_id: campaignId,
    product_id: productId,
    normal_price: normalPrice,
    offer_price: offerPrice,
    highlighted_price: "offer",
    ean_snapshot: product.ean,
    name_snapshot: product.name,
    brand_snapshot: product.brand,
    specification_snapshot: product.specification,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/app/campanhas");
  revalidatePath(`/app/campanhas/${campaignId}`);
}

export async function updateCampaignItem(formData: FormData) {
  const { supabase } = await editorContext();
  const id = String(formData.get("id") ?? "");
  const campaignId = String(formData.get("campaign_id") ?? "");
  const highlightedPrice = String(formData.get("highlighted_price") ?? "offer");
  if (!id || !campaignId) throw new Error("Item inválido.");
  if (!["offer", "normal"].includes(highlightedPrice)) throw new Error("Destaque de preço inválido.");

  const { error } = await supabase.from("campaign_items").update({
    normal_price: numberValue(formData.get("normal_price")),
    offer_price: numberValue(formData.get("offer_price")),
    highlighted_price: highlightedPrice,
    sort_order: numberValue(formData.get("sort_order")) ?? 0,
  }).eq("id", id).eq("campaign_id", campaignId);

  if (error) throw new Error(error.message);
  revalidatePath("/app/campanhas");
  revalidatePath(`/app/campanhas/${campaignId}`);
}

export async function removeCampaignItem(formData: FormData) {
  const { supabase } = await editorContext();
  const id = String(formData.get("id") ?? "");
  const campaignId = String(formData.get("campaign_id") ?? "");
  if (!id || !campaignId) throw new Error("Item inválido.");

  const { error } = await supabase.from("campaign_items").delete().eq("id", id).eq("campaign_id", campaignId);
  if (error) throw new Error(error.message);

  revalidatePath("/app/campanhas");
  revalidatePath(`/app/campanhas/${campaignId}`);
}
