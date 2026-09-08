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

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

function detectCsvDelimiter(csv: string) {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim()).slice(0, 12);
  const candidates = ["|", ";", "\t", ","];
  let best = ";";
  let bestScore = -1;

  for (const delimiter of candidates) {
    const counts = lines.map((line) => countDelimiter(line, delimiter));
    const positive = counts.filter((count) => count > 0);
    if (!positive.length) continue;
    const average = positive.reduce((sum, count) => sum + count, 0) / positive.length;
    const consistency = positive.length / Math.max(lines.length, 1);
    const score = average * consistency;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }

  return best;
}

function parseDelimitedText(input: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
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

function looksLikeHeaderlessErpRow(row: unknown[]) {
  if (row.length < 2) return false;
  const code = String(row[0] ?? "").trim();
  const description = String(row[1] ?? "").trim();
  return /^\d{4,14}$/.test(code) && description.length >= 3;
}

function isValidGtin(value: string) {
  const digits = value.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1);
  const check = Number(digits.at(-1));
  let sum = 0;
  let weight = 3;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === check;
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
    let rows: unknown[][];

    if (extension === "csv") {
      const csv = decodeCsv(buffer);
      const delimiter = detectCsvDelimiter(csv);
      rows = parseDelimitedText(csv, delimiter);
    } else {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames.includes("ERP_Produtos") ? "ERP_Produtos" : workbook.SheetNames[0];
      if (!sheetName) throw new Error("O arquivo não possui dados legíveis.");
      rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    }

    if (rows.length < 1) throw new Error("Nenhum produto encontrado no arquivo.");

    const headerRowIndex = detectHeaderRow(rows);
    const headerless = extension === "csv" && headerRowIndex < 0 && looksLikeHeaderlessErpRow(rows[0]);

    let codeIndex: number;
    let descriptionIndex: number;
    let priceIndex: number;
    let stockIndex: number;
    let unitIndex: number;
    let typeIndex: number;
    let gtinIndex: number;
    let imageIndex: number;
    let dataRows: unknown[][];

    if (headerless) {
      codeIndex = 0;
      descriptionIndex = 1;
      priceIndex = 2;
      stockIndex = 3;
      unitIndex = 4;
      typeIndex = -1;
      gtinIndex = -1;
      imageIndex = -1;
      dataRows = rows;
    } else {
      if (headerRowIndex < 0) {
        const preview = rows.slice(0, 5).flatMap((row) => row.map((value) => String(value ?? "").trim()).filter(Boolean)).slice(0, 12).join(" | ");
        throw new Error(`Não encontrei as colunas de código e descrição. Cabeçalhos lidos: ${preview || "nenhum"}`);
      }
      const header = rows[headerRowIndex].map(normalizeHeader);
      codeIndex = findHeaderIndex(header, ["código", "codigo", "cod", "cód", "codigo produto", "cod produto", "ean", "gtin", "codigo de barras", "cod barras"]);
      descriptionIndex = findHeaderIndex(header, ["descrição erp", "descricao erp", "descrição", "descricao", "produto", "nome", "nome produto", "descricao produto"]);
      priceIndex = findHeaderIndex(header, ["preço de venda", "preco de venda", "preço", "preco", "valor", "valor venda"]);
      stockIndex = findHeaderIndex(header, ["estoque", "saldo", "qtd estoque", "quantidade estoque"]);
      unitIndex = findHeaderIndex(header, ["unidade", "un", "und"]);
      typeIndex = findHeaderIndex(header, ["tipo de código", "tipo de codigo", "tipo codigo"]);
      gtinIndex = findHeaderIndex(header, ["gtin válido", "gtin valido", "gtin válido?", "gtin valido?"]);
      imageIndex = findHeaderIndex(header, ["pesquisar imagem", "pesquisar imagem?", "buscar imagem", "buscar imagem?"]);
      dataRows = rows.slice(headerRowIndex + 1);
    }

    const syncStarted = new Date().toISOString();
    const byCode = new Map<string, {
      code: string; description: string; sale_price: number | null; stock: number | null; unit: string | null;
      code_type: string | null; gtin_valid: boolean | null; search_image: boolean; imported_at: string; updated_at: string; last_seen_at: string;
    }>();

    for (const row of dataRows) {
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
        gtin_valid: gtinIndex >= 0 ? yesNo(row[gtinIndex]) : headerless ? isValidGtin(code) : null,
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
    const mode = headerless ? "CSV sem cabeçalho" : "arquivo";
    destination = `/app/produtos?import_ok=${encodeURIComponent(`${parsed.length} produtos sincronizados com sucesso (${mode}).`)}`;
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
