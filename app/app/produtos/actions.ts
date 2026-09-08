"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function text(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function numberValue(value: FormDataEntryValue | null | unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const decimal = normalized.includes(",") ? normalized.replace(/\./g, "").replace(",", ".") : normalized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
}

function yesNo(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return ["sim", "s", "true", "1", "yes"].includes(normalized);
}

function importMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Falha inesperada durante a sincronização do ERP.";
}

function decodeCsv(buffer: Buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const decoded = utf8.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
  return decoded.replace(/^\uFEFF/, "");
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findHeaderIndex(header: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return header.findIndex((cell) => normalizedAliases.includes(cell));
}

function detectHeaderRow(rows: unknown[][]) {
  const codeAliases = ["código", "codigo", "cod", "cód", "codigo produto", "cod produto", "ean", "gtin", "codigo de barras", "cod barras"];
  const descriptionAliases = ["descrição erp", "descricao erp", "descrição", "descricao", "produto", "nome", "nome produto", "descricao produto"];
  const maxRows = Math.min(rows.length, 15);
  for (let i = 0; i < maxRows; i += 1) {
    const header = rows[i].map(normalizeHeader);
    if (findHeaderIndex(header, codeAliases) >= 0 && findHeaderIndex(header, descriptionAliases) >= 0) return i;
  }
  return -1;
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

export async function importErpSpreadsheet(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para importar o ERP.");
  let destination = "/app/produtos";
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo do ERP.");
    if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 10 MB.");
    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["xlsx", "xls", "csv"].includes(extension)) throw new Error("Formato não suportado. Use XLSX, XLS ou CSV.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = extension === "csv" ? XLSX.read(decodeCsv(buffer), { type: "string" }) : XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames.includes("ERP_Produtos") ? "ERP_Produtos" : workbook.SheetNames[0];
    if (!sheetName) throw new Error("O arquivo não possui dados legíveis.");

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    if (rows.length < 2) throw new Error("Nenhum produto encontrado no arquivo.");

    const headerRowIndex = detectHeaderRow(rows);
    if (headerRowIndex < 0) {
      const preview = rows.slice(0, 5).flatMap((row) => row.map((value) => String(value ?? "").trim()).filter(Boolean)).slice(0, 12).join(" | ");
      throw new Error(`Não encontrei as colunas de código e descrição. Cabeçalhos lidos: ${preview || "nenhum"}`);
    }

    const header = rows[headerRowIndex].map(normalizeHeader);
    const codeIndex = findHeaderIndex(header, ["código", "codigo", "cod", "cód", "codigo produto", "cod produto", "ean", "gtin", "codigo de barras", "cod barras"]);
    const descriptionIndex = findHeaderIndex(header, ["descrição erp", "descricao erp", "descrição", "descricao", "produto", "nome", "nome produto", "descricao produto"]);
    const priceIndex = findHeaderIndex(header, ["preço de venda", "preco de venda", "preço", "preco", "valor", "valor venda"]);
    const stockIndex = findHeaderIndex(header, ["estoque", "saldo", "qtd estoque", "quantidade estoque"]);
    const unitIndex = findHeaderIndex(header, ["unidade", "un", "und"]);
    const typeIndex = findHeaderIndex(header, ["tipo de código", "tipo de codigo", "tipo codigo"]);
    const gtinIndex = findHeaderIndex(header, ["gtin válido", "gtin valido", "gtin válido?", "gtin valido?"]);
    const imageIndex = findHeaderIndex(header, ["pesquisar imagem", "pesquisar imagem?", "buscar imagem", "buscar imagem?"]);

    const syncStarted = new Date().toISOString();
    const byCode = new Map<string, {
      code: string; description: string; sale_price: number | null; stock: number | null; unit: string | null;
      code_type: string | null; gtin_valid: boolean | null; search_image: boolean; imported_at: string; updated_at: string; last_seen_at: string;
    }>();

    for (const row of rows.slice(headerRowIndex + 1)) {
      const code = String(row[codeIndex] ?? "").trim();
      const description = String(row[descriptionIndex] ?? "").trim();
      if (!code || !description) continue;
      byCode.set(code, {
        code,
        description,
        sale_price: priceIndex >= 0 ? numberValue(row[priceIndex]) : null,
        stock: stockIndex >= 0 ? numberValue(row[stockIndex]) : null,
        unit: unitIndex >= 0 ? String(row[unitIndex] ?? "").trim() || null : null,
        code_type: typeIndex >= 0 ? String(row[typeIndex] ?? "").trim() || null : null,
        gtin_valid: gtinIndex >= 0 ? yesNo(row[gtinIndex]) : null,
        search_image: imageIndex >= 0 ? yesNo(row[imageIndex]) ?? false : false,
        imported_at: syncStarted,
        updated_at: syncStarted,
        last_seen_at: syncStarted,
      });
    }

    const parsed = [...byCode.values()];
    if (!parsed.length) throw new Error("Nenhuma linha válida foi encontrada para importar.");
    const supabase = await createClient();
    const chunkSize = 250;
    for (let i = 0; i < parsed.length; i += chunkSize) {
      const { error } = await supabase.from("erp_products").upsert(parsed.slice(i, i + chunkSize), { onConflict: "code" });
      if (error) throw new Error(`Falha na importação do ERP: ${error.message}`);
    }
    const { error: cleanupError } = await supabase.from("erp_products").delete().lt("last_seen_at", syncStarted);
    if (cleanupError) throw new Error(`Importação concluída, mas a limpeza falhou: ${cleanupError.message}`);
    revalidatePath("/app/produtos");
    revalidatePath("/app");
    destination = `/app/produtos?import_ok=${encodeURIComponent(`${parsed.length} produtos sincronizados com sucesso.`)}`;
  } catch (error) {
    destination = `/app/produtos?import_error=${encodeURIComponent(importMessage(error))}`;
  }
  redirect(destination);
}

export async function addErpProductToCatalog(formData: FormData) {
  const profile = await requireProfile();
  if (!canEdit(profile.role)) throw new Error("Sem permissão para editar produtos.");
  const code = String(formData.get("code") ?? "").trim();
  if (!code) throw new Error("Código do ERP não informado.");
  const supabase = await createClient();
  const { data: erp, error: erpError } = await supabase.from("erp_products").select("code,description,sale_price,stock,unit,code_type,gtin_valid").eq("code", code).single();
  if (erpError || !erp) throw new Error("Produto não encontrado na base do ERP.");
  const { data: existing } = await supabase.from("products").select("id").eq("ean", erp.code).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("products").update({
      erp_description: erp.description, sale_price: erp.sale_price, stock: erp.stock, unit: erp.unit,
      code_type: erp.code_type, gtin_valid: erp.gtin_valid, active: true,
    }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("products").insert({
      ean: erp.code, name: erp.description, erp_description: erp.description, sale_price: erp.sale_price,
      stock: erp.stock, unit: erp.unit, code_type: erp.code_type, gtin_valid: erp.gtin_valid, active: true,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/app/produtos");
  revalidatePath("/app");
}
