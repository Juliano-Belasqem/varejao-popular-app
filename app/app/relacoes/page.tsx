import { canEdit, isAdmin, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelRelation, createOccurrence, createRelation, createSupplier, finalizeRelation } from "./actions";
import { RelationForm, SupplierSelect } from "./relation-form";

const labels: Record<string, string> = { draft: "Rascunho", finalized: "Finalizada", cancelled: "Cancelada" };

export default async function Page() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }, { data: occurrences }, { data: relations }] = await Promise.all([
    supabase.from("suppliers").select("id,name").eq("active", true).order("name"),
    supabase.from("products").select("id,ean,name,brand,stock").eq("active", true).order("name").limit(1000),
    supabase.from("supplier_occurrences").select("id,supplier_id,reference,occurred_on").order("occurred_on", { ascending: false }).limit(500),
    supabase.from("supplier_relations").select("id,supplier_id,status,notes,created_at,finalized_at,cancellation_reason,suppliers(name),supplier_relation_items(id,product_id,quantity,products(name,ean))").order("created_at", { ascending: false }).limit(200),
  ]);
  const editable = canEdit(profile.role);
  return <>
    <header className="page-head"><div><h1>Relações de fornecedores</h1><div className="muted">Rascunhos não reservam. A reserva acontece somente na finalização administrativa.</div></div></header>
    {editable && <div className="grid" style={{ marginBottom: 16 }}>
      <section className="card"><h2 style={{ marginTop: 0 }}>Nova relação</h2><RelationForm suppliers={suppliers ?? []} products={products ?? []} occurrences={occurrences ?? []} action={createRelation} /></section>
      <div className="grid">
        <section className="card"><h2 style={{ marginTop: 0 }}>Novo fornecedor</h2><form action={createSupplier} className="form"><label className="field"><span>Nome</span><input className="input" name="name" required /></label><div className="form-grid compact"><label className="field"><span>CNPJ / documento</span><input className="input" name="document" /></label><label className="field"><span>Contato</span><input className="input" name="contact_name" /></label><label className="field"><span>Telefone</span><input className="input" name="contact_phone" /></label></div><button className="btn primary" type="submit">Cadastrar fornecedor</button></form></section>
        <section className="card"><h2 style={{ marginTop: 0 }}>Nova ocorrência</h2><form action={createOccurrence} className="form"><label className="field"><span>Fornecedor</span><select className="input" name="supplier_id" required defaultValue=""><option value="">Selecione</option><SupplierSelect suppliers={suppliers ?? []} /></select></label><div className="form-grid compact"><label className="field"><span>Referência</span><input className="input" name="reference" placeholder="Ex.: NF/entrega" required /></label><label className="field"><span>Data</span><input className="input" type="date" name="occurred_on" /></label></div><label className="field"><span>Observações</span><textarea className="input" name="notes" rows={2} /></label><button className="btn" type="submit">Registrar ocorrência</button></form></section>
      </div>
    </div>}
    <section className="card"><h2 style={{ marginTop: 0 }}>Relações recentes</h2>{!relations?.length ? <div className="empty">Nenhuma relação cadastrada.</div> : <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Fornecedor</th><th>Itens</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>{relations.map((relation: any) => <tr key={relation.id}><td><strong>{relation.suppliers?.name ?? "—"}</strong>{relation.notes && <div className="muted">{relation.notes}</div>}</td><td>{relation.supplier_relation_items?.map((item: any) => <div key={item.id}>{item.products?.ean} — {item.products?.name} · <strong>{item.quantity}</strong></div>)}</td><td><span className="pill">{labels[relation.status] ?? relation.status}</span>{relation.cancellation_reason && <div className="muted">{relation.cancellation_reason}</div>}</td><td>{new Intl.DateTimeFormat("pt-BR").format(new Date(relation.created_at))}</td><td>{relation.status === "draft" && editable && <form action={finalizeRelation}><input type="hidden" name="id" value={relation.id} /><button className="btn primary" type="submit" disabled={!isAdmin(profile.role)}>Finalizar</button></form>}{relation.status === "finalized" && isAdmin(profile.role) && <form action={cancelRelation} className="form"><input type="hidden" name="id" value={relation.id} /><input className="input" name="reason" required placeholder="Motivo do cancelamento" /><button className="btn" type="submit">Cancelar e liberar</button></form>}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
