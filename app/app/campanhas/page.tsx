import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addCampaignItem, createCampaign } from "./actions";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  approved: "Aprovada",
  archived: "Arquivada",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function Page() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const editable = canEdit(profile.role);

  const [{ data: campaigns, error }, { data: products }, { data: items }] = await Promise.all([
    supabase.from("campaigns").select("id,name,start_date,end_date,theme,format,status,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("products").select("id,ean,name,brand,specification,sale_price,active").eq("active", true).order("name").limit(500),
    supabase.from("campaign_items").select("id,campaign_id,product_id,normal_price,offer_price,highlighted_price,ean_snapshot,name_snapshot,brand_snapshot,specification_snapshot").order("sort_order").limit(1000),
  ]);

  const itemCount = new Map<string, number>();
  for (const item of items ?? []) itemCount.set(item.campaign_id, (itemCount.get(item.campaign_id) ?? 0) + 1);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Campanhas</h1>
          <div className="muted">Campanhas e ofertas do supermercado.</div>
        </div>
      </header>

      {editable && (
        <div className="grid" style={{ marginBottom: 16 }}>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Nova campanha</h2>
            <form action={createCampaign} className="form">
              <label className="field"><span>Nome</span><input className="input" name="name" required /></label>
              <div className="form-grid compact">
                <label className="field"><span>Data inicial</span><input className="input" type="date" name="start_date" /></label>
                <label className="field"><span>Data final</span><input className="input" type="date" name="end_date" /></label>
                <label className="field"><span>Tema</span><input className="input" name="theme" defaultValue="Padrão" /></label>
                <label className="field"><span>Formato</span><select className="input" name="format" defaultValue="Físico + Digital"><option>Físico + Digital</option><option>Físico</option><option>Digital</option></select></label>
              </div>
              <button className="btn primary" type="submit">Criar campanha</button>
            </form>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Adicionar produto</h2>
            <form action={addCampaignItem} className="form">
              <label className="field"><span>Campanha</span><select className="input" name="campaign_id" required defaultValue=""><option value="" disabled>Selecione</option>{(campaigns ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="field"><span>Produto</span><select className="input" name="product_id" required defaultValue=""><option value="" disabled>Selecione</option>{(products ?? []).map((p) => <option key={p.id} value={p.id}>{p.ean} — {p.name}{p.brand ? ` — ${p.brand}` : ""}</option>)}</select></label>
              <div className="form-grid compact">
                <label className="field"><span>Preço normal</span><input className="input" name="normal_price" inputMode="decimal" placeholder="Usa preço do cadastro se vazio" /></label>
                <label className="field"><span>Preço oferta</span><input className="input" name="offer_price" inputMode="decimal" required /></label>
              </div>
              <button className="btn primary" type="submit">Adicionar à campanha</button>
            </form>
          </section>
        </div>
      )}

      <section className="card">
        {error ? (
          <div className="error">Não foi possível carregar as campanhas: {error.message}</div>
        ) : !campaigns?.length ? (
          <div className="empty">Nenhuma campanha migrada ou criada ainda.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Campanha</th><th>Período</th><th>Tema</th><th>Formato</th><th>Itens</th><th>Status</th></tr></thead>
              <tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td>{campaign.name}</td><td>{formatDate(campaign.start_date)} — {formatDate(campaign.end_date)}</td><td>{campaign.theme}</td><td>{campaign.format}</td><td>{itemCount.get(campaign.id) ?? 0}</td><td><span className="pill">{statusLabel[campaign.status] ?? campaign.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
