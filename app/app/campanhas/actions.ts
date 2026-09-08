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

export async function createCampaign(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar campanhas.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nome da campanha é obrigatório.");

  const supabase = await createClient();
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

export async function addCampaignItem(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar campanhas.");

  const campaignId = String(formData.get("campaign_id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!campaignId || !productId) throw new Error("Campanha e produto são obrigatórios.");

  const supabase = await createClient();
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
}
