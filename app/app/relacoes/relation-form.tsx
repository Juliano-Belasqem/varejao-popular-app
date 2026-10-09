"use client";

import { useState } from "react";

type Product = { id: string; ean: string; name: string; brand: string | null; stock: number | null };
type Occurrence = { id: string; supplier_id: string; reference: string | null; occurred_on: string | null };
type Item = { product_id: string; quantity: string; occurrence_id: string };

export function RelationForm({ suppliers, products, occurrences, action }: { suppliers: { id: string; name: string }[]; products: Product[]; occurrences: Occurrence[]; action: (formData: FormData) => void }) {
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<Item[]>([{ product_id: "", quantity: "", occurrence_id: "" }]);
  const relevantOccurrences = occurrences.filter((item) => item.supplier_id === supplierId);
  return <form action={action} className="form" onSubmit={(event) => {
    const form = event.currentTarget;
    const hidden = form.elements.namedItem("items_json") as HTMLInputElement;
    hidden.value = JSON.stringify(items.map((item) => ({ product_id: item.product_id, quantity: item.quantity, occurrence_id: item.occurrence_id || null })));
  }}>
    <label className="field"><span>Fornecedor</span><select className="input" name="supplier_id" required value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setItems((current) => current.map((item) => ({ ...item, occurrence_id: "" }))); }}><option value="">Selecione</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
    <input type="hidden" name="items_json" />
    <label className="field"><span>Observações</span><textarea className="input" name="notes" rows={2} /></label>
    <div className="relation-items">{items.map((item, index) => <div className="relation-item" key={index}>
      <label className="field"><span>Produto</span><select className="input" required value={item.product_id} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, product_id: event.target.value } : row))}><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.ean} — {product.name}{product.brand ? ` — ${product.brand}` : ""}</option>)}</select></label>
      <label className="field"><span>Quantidade</span><input className="input" required min="0.001" step="0.001" inputMode="decimal" value={item.quantity} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></label>
      <label className="field"><span>Ocorrência (opcional)</span><select className="input" value={item.occurrence_id} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, occurrence_id: event.target.value } : row))}><option value="">Sem vínculo</option>{relevantOccurrences.map((occurrence) => <option key={occurrence.id} value={occurrence.id}>{occurrence.reference}{occurrence.occurred_on ? ` — ${occurrence.occurred_on}` : ""}</option>)}</select></label>
      {items.length > 1 && <button className="btn" type="button" onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remover</button>}
    </div>)}</div>
    <div className="row-actions"><button className="btn" type="button" onClick={() => setItems((current) => [...current, { product_id: "", quantity: "", occurrence_id: "" }])}>+ Adicionar item</button><button className="btn primary" type="submit">Salvar rascunho</button></div>
  </form>;
}

export function SupplierSelect({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  return <>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</>;
}
