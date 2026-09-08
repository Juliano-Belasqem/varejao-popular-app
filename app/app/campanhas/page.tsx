import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  await requireProfile();
  const supabase = await createClient();

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("id,name,start_date,end_date,theme,format,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Campanhas</h1>
          <div className="muted">Campanhas e ofertas do supermercado.</div>
        </div>
      </header>

      <section className="card">
        {error ? (
          <div className="error">Não foi possível carregar as campanhas: {error.message}</div>
        ) : !campaigns?.length ? (
          <div className="empty">Nenhuma campanha migrada ou criada ainda.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Período</th>
                  <th>Tema</th>
                  <th>Formato</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>{campaign.name}</td>
                    <td>{formatDate(campaign.start_date)} — {formatDate(campaign.end_date)}</td>
                    <td>{campaign.theme}</td>
                    <td>{campaign.format}</td>
                    <td><span className="pill">{statusLabel[campaign.status] ?? campaign.status}</span></td>
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
