import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const networkLabels: Record<string, string> = { instagram: "Instagram", facebook: "Facebook" };
const typeLabels: Record<string, string> = { feed: "Feed", story: "Story", carousel: "Carrossel", reel: "Reel" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [campaigns, products, publications, scheduled, errors, drafts, published, upcoming, recentErrors] = await Promise.all([
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("publications").select("*", { count: "exact", head: true }),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "error"),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase
      .from("publications")
      .select("id,network,type,caption,scheduled_at")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("publications")
      .select("id,network,type,caption,error_message,updated_at")
      .eq("status", "error")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Visão geral</h1>
          <div className="muted">Olá, {profile.full_name}. Acompanhe campanhas, produtos e o fluxo de publicações em um só lugar.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href="/app/campanhas">Campanhas</Link>
          <Link className="btn primary" href="/app/publicacoes/nova">+ Nova publicação</Link>
        </div>
      </header>

      <section className="stats">
        <div className="card stat"><div className="muted">Campanhas</div><strong>{campaigns.count ?? 0}</strong></div>
        <div className="card stat"><div className="muted">Produtos</div><strong>{products.count ?? 0}</strong></div>
        <div className="card stat"><div className="muted">Publicações</div><strong>{publications.count ?? 0}</strong></div>
        <div className="card stat"><div className="muted">Agendadas</div><strong>{scheduled.count ?? 0}</strong></div>
      </section>

      <section className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Operação de publicações</h2>
              <div className="muted" style={{ marginTop: 4 }}>Resumo do que exige atenção agora.</div>
            </div>
            <Link className="btn" href="/app/publicacoes">Abrir fila</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}><div className="muted">Rascunhos</div><strong style={{ fontSize: 24 }}>{drafts.count ?? 0}</strong></div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}><div className="muted">Com erro</div><strong style={{ fontSize: 24 }}>{errors.count ?? 0}</strong></div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}><div className="muted">Publicadas</div><strong style={{ fontSize: 24 }}>{published.count ?? 0}</strong></div>
          </div>
          {(errors.count ?? 0) > 0 && (
            <div className="error" style={{ marginTop: 12 }}>
              Há {errors.count} publicação(ões) com erro. Abra a fila para revisar ou usar “Tentar novamente”.
            </div>
          )}
        </div>

        <div className="card">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Próximas agendadas</h2>
              <div className="muted" style={{ marginTop: 4 }}>As próximas 5 publicações que o scheduler tentará enviar.</div>
            </div>
          </div>
          {!upcoming.data?.length ? (
            <div className="empty">Nenhuma publicação agendada.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {upcoming.data.map((item) => (
                <Link key={item.id} href={`/app/publicacoes/${item.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <strong>{networkLabels[item.network] ?? item.network}</strong>
                    <span className="pill">{typeLabels[item.type] ?? item.type}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{dateLabel(item.scheduled_at)}</div>
                  <div style={{ marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.caption || "Sem legenda"}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Erros recentes</h2>
            <div className="muted" style={{ marginTop: 4 }}>Últimas publicações que precisam de revisão.</div>
          </div>
          {(errors.count ?? 0) > 0 && <Link className="btn" href="/app/publicacoes?status=error">Ver todos os erros</Link>}
        </div>
        {!recentErrors.data?.length ? (
          <div className="empty">Nenhum erro de publicação no momento.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentErrors.data.map((item) => (
              <Link key={item.id} href={`/app/publicacoes/${item.id}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <strong>{networkLabels[item.network] ?? item.network}</strong>
                  <span className="pill">{typeLabels[item.type] ?? item.type}</span>
                </div>
                <div className="error" style={{ marginTop: 6, fontSize: 12 }}>{item.error_message || "Falha sem mensagem detalhada."}</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>Atualizado em {dateLabel(item.updated_at)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
