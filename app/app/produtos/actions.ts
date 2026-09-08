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

export async function createProduct(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar produtos.");

  const ean = String(formData.get("ean") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!ean || !name) throw new Error("EAN e nome são obrigatórios.");

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    ean,
    name,
    brand: text(formData.get("brand")),
    specification: text(formData.get("specification")),
    category: text(formData.get("category")),
    unit: text(formData.get("unit")),
    sale_price: numberValue(formData.get("sale_price")),
    stock: numberValue(formData.get("stock")),
    erp_description: text(formData.get("erp_description")),
    code_type: text(formData.get("code_type")),
    gtin_valid: true,
    active: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/app/produtos");
  revalidatePath("/app");
}

export async function toggleProductActive(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar produtos.");

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "false") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active: !active }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/app/produtos");
  revalidatePath("/app");
}
