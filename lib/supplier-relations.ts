export type RelationDraftItem = {
  product_id: string;
  quantity: number;
  occurrence_id?: string | null;
};

export function parseRelationItems(value: unknown): RelationDraftItem[] {
  if (typeof value !== "string") throw new Error("Inclua ao menos um item na relação.");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Itens da relação estão inválidos."); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Inclua ao menos um item na relação.");
  const items = parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Item de relação inválido.");
    const row = item as Record<string, unknown>;
    const product_id = String(row.product_id ?? "").trim();
    const quantity = Number(String(row.quantity ?? "").replace(",", "."));
    const occurrence_id = String(row.occurrence_id ?? "").trim() || null;
    if (!product_id || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Produto e quantidade positiva são obrigatórios.");
    return { product_id, quantity, occurrence_id };
  });
  const keys = new Set<string>();
  for (const item of items) {
    const key = `${item.product_id}:${item.occurrence_id ?? ""}`;
    if (keys.has(key)) throw new Error("Não repita o mesmo produto e ocorrência na relação.");
    keys.add(key);
  }
  return items;
}

export function availableStock(stock: number | null | undefined, reserved: number | null | undefined) {
  return Math.max(0, Number(stock ?? 0) - Number(reserved ?? 0));
}
