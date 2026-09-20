"use server";

import { revalidatePath } from "next/cache";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  validateVisualDocument,
  type VisualDocument,
} from "@/lib/visual-engine";

export async function saveVisualTemplate(input: {
  templateId?: string | null;
  name: string;
  category?: string;
  document: VisualDocument;
}) {
  const profile = await requireProfile();
  if (!canEdit(profile.role))
    throw new Error("Sem permissão para salvar templates.");
  const document = validateVisualDocument(input.document);
  const name = input.name.trim();
  if (!name) throw new Error("Nome do template é obrigatório.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_visual_template", {
    p_template_id: input.templateId || null,
    p_name: name,
    p_category: input.category?.trim() || "custom",
    p_document: document,
    p_user_id: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/editor-visual");
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved?.template_id || !saved?.version)
    throw new Error("Resposta inválida ao salvar template.");
  return {
    templateId: String(saved.template_id),
    version: Number(saved.version),
  };
}

export async function listVisualTemplates(page = 0) {
  await requireProfile();
  const db = await createClient();
  const offset = Math.max(0, Math.floor(page)) * 30;
  const { data, error } = await db
    .from("visual_templates")
    .select("id,name,category,current_version")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .order("id")
    .range(offset, offset + 30);
  if (error) throw new Error("Não foi possível carregar os templates.");
  return {
    items: (data ?? []).slice(0, 30),
    hasMore: (data?.length ?? 0) > 30,
  };
}
export async function listVisualVersions(templateId: string, page = 0) {
  await requireProfile();
  const db = await createClient(),
    offset = Math.max(0, Math.floor(page)) * 30;
  const { data, error } = await db
    .from("visual_template_versions")
    .select("version,created_at")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
    .range(offset, offset + 30);
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return {
    items: (data ?? []).slice(0, 30),
    hasMore: (data?.length ?? 0) > 30,
  };
}
export async function loadVisualTemplate(templateId: string, version?: number) {
  await requireProfile();
  const db = await createClient();
  const { data: template, error } = await db
    .from("visual_templates")
    .select("id,name,category,current_version")
    .eq("id", templateId)
    .eq("active", true)
    .single();
  if (error || !template)
    throw new Error("Template não encontrado ou sem acesso.");
  const { data: saved, error: versionError } = await db
    .from("visual_template_versions")
    .select("document,version")
    .eq("template_id", templateId)
    .eq("version", version ?? template.current_version)
    .single();
  if (versionError || !saved)
    throw new Error("Versão não encontrada ou sem acesso.");
  return {
    template,
    document: validateVisualDocument(saved.document),
    version: Number(saved.version),
  };
}
export async function listVisualOffers(page = 0) {
  await requireProfile();
  const db = await createClient(),
    offset = Math.max(0, Math.floor(page)) * 30;
  const { data, error } = await db
    .from("offers")
    .select(
      "id,product_id,normal_price,offer_price,unit,starts_on,ends_on,products(name,brand,specification,ean),campaigns(name)",
    )
    .eq("active", true)
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 30);
  if (error) throw new Error("Não foi possível carregar as ofertas.");
  return {
    items: (data ?? []).slice(0, 30).map((row) => {
      const p = Array.isArray(row.products) ? row.products[0] : row.products,
        c = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns,
        price = Number(row.offer_price).toFixed(2).replace(".", ",");
      return {
        id: row.id,
        name: p?.name ?? "Oferta",
        data: {
          product: { ...p, image: `/api/product-image/${row.product_id}` },
          offer: {
            normalPrice:
              row.normal_price == null
                ? ""
                : Number(row.normal_price).toFixed(2).replace(".", ","),
            price,
            priceReais: price.split(",")[0],
            priceCents: price.split(",")[1],
            unit: row.unit ?? "",
            startsOn: row.starts_on?.split("-").reverse().join("/") ?? "",
            endsOn: row.ends_on?.split("-").reverse().join("/") ?? "",
          },
          campaign: { name: c?.name ?? "" },
        },
      };
    }),
    hasMore: (data?.length ?? 0) > 30,
  };
}
