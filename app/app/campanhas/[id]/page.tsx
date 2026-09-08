import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addCampaignItem, removeCampaignItem, updateCampaign, updateCampaignItem } from "../actions";

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const editable = canEdit(profile.role);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: campaign, error }, { data: items }, { data: products }] = await Promise.all([
    supabase.from("campaigns").select("id,name,start_date,end_date,theme,format,status").eq("id", id).single(),
    supabase.from("campaign_items").select("id,campaign_id,product_id,normal_price,offer_price,highlighted_price,sort_order,ean_snapshot,name_snapshot,brand_snapshot,specification_snapshot").eq("campaign_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("products").select("id,ean,name,brand,sale_price,active").eq("active", true).order("name").limit(1000),
  ]);

  if (error || !campaign) notFound();

  return (
    <>
      <header className="page-head">
        <div>
          <Link href="/app/campanhas" className="muted">← Campanhas</Link>
          <h1 style={{ marginTop: 8 }}>{campaign.name}</h1>
          <div className="muted">Edite os dados da campanha, preços e ordem dos produtos.</div>
        </div>
        <span className="pill">{campaign.status === "draft" ? "Rascunho" : campaign.status === "approved" ? "Aprovada" : "Arquivada"}</span>
      </header>

      <div className="grid" style={{ marginBottom: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Dados da campanha</h2>
          {editable ? (
            <form action={updateCampaign} className="form">
              <input type="hidden" name="id" value={campaign.id} />
              <label className="field"><span>Nome</span><input className="input" name="name" required defaultValue={campaign.name} /></label>
              <div className="form-grid compact">
                <label className="field"><span>Data inicial</span><input className="input" type="date" name="start_date" defaultValue={campaign.start_date ?? ""} /></label>
                <label className="field"><span>Data final</span><input className="input" type="date" name="end_date" defaultValue={campaign.end_date ?? ""} /></label>
                <label className="field"><span>Tema</span><input className="input" name="theme" defaultValue={campaign.theme} /></label>
                <label className="field"><span>Formato</span><select className="input" name="format" defaultValue={campaign.format}><option>Físico + Digital</option><option>Físico</option><option>Digital</option></select></label>
                <label className="field"><span>Status</span><select className="input" name="status" defaultValue={campaign.status}><option value="draft">Rascunho</option><option value="approved">Aprovada</option><option value="archived">Arquivada</option></select></label>
              </div>
              <button className="btn primary" type="submit">Salvar campanha</button>
            </form>
          ) : (
            <div className="muted">Modo somente leitura.</div>
          )}
        </section>

        {editable && (
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Adicionar produto</h2>
            <form action={addCampaignItem} className="form">
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <label className="field"><span>Produto</span><select className="input" name="product_id" required defaultValue=""><option value="" disabled>Selecione</option>{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.ean} — {p.name}{p.brand ? ` — ${p.brand}` : ""}</option>)}</select></label>
              <div className="form-grid compact">
                <label className="field"><span>Preço normal</span><input className="input" name="normal_price" inputMode="decimal" placeholder="Usa preço do cadastro se vazio" /></label>
                <label className="field"><span>Preço oferta</span><input className="input" name="offer_price" inputMode="decimal" required /></label>
              </div>
              <button className="btn primary" type="submit">Adicionar produto</button>
            </form>
          </section>
        )}
      </div>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 8 }}>
          <div><h2 style={{ margin: 0 }}>Produtos da campanha</h2><div className="muted">{items?.length ?? 0} item(ns)</div></div>
        </div>

        {!items?.length ? (
          <div className="empty">Nenhum produto adicionado a esta campanha.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Ordem</th><th>EAN</th><th>Produto</th><th>Preço normal</th><th>Preço oferta</th><th>Destaque</th>{editable && <th>Ações</th>}</tr></thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    {editable ? (
                      <>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <form action={updateCampaignItem} style={{ display: "grid", gridTemplateColumns: "85px 150px minmax(260px,1fr) 150px 150px 140px auto", alignItems: "center" }}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="campaign_id" value={campaign.id} />
                            <div style={{ padding: 10 }}><input className="input" style={{ padding: 8 }} type="number" name="sort_order" defaultValue={item.sort_order ?? index} /></div>
                            <div style={{ padding: 10 }}>{item.ean_snapshot || "—"}</div>
                            <div style={{ padding: 10 }}><strong>{item.name_snapshot || "Produto"}</strong>{item.brand_snapshot && <div className="muted">{item.brand_snapshot}{item.specification_snapshot ? ` · ${item.specification_snapshot}` : ""}</div>}</div>
                            <div style={{ padding: 10 }}><input className="input" style={{ padding: 8 }} name="normal_price" inputMode="decimal" defaultValue={item.normal_price ?? ""} /></div>
                            <div style={{ padding: 10 }}><input className="input" style={{ padding: 8 }} name="offer_price" inputMode="decimal" defaultValue={item.offer_price ?? ""} /></div>
                            <div style={{ padding: 10 }}><select className="input" style={{ padding: 8 }} name="highlighted_price" defaultValue={item.highlighted_price}><option value="offer">Oferta</option><option value="normal">Normal</option></select></div>
                            <div style={{ padding: 10, display: "flex", gap: 8 }}><button className="btn" type="submit">Salvar</button><button className="btn danger" formAction={removeCampaignItem}>Remover</button></div>
                          </form>
                        </td>
                      </>
                    ) : (
                      <><td>{item.sort_order ?? index}</td><td>{item.ean_snapshot || "—"}</td><td><strong>{item.name_snapshot || "Produto"}</strong>{item.brand_snapshot && <div className="muted">{item.brand_snapshot}</div>}</td><td>{money(item.normal_price)}</td><td>{money(item.offer_price)}</td><td>{item.highlighted_price === "normal" ? "Normal" : "Oferta"}</td></>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
