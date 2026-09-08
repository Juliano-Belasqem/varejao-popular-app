import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    campaigns,
    products,
    publications,
    scheduled,
  ] = await Promise.all([
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("publications").select("*", { count: "exact", head: true }),
    supabase
      .from("publications")
      .select("*", { count: "exact", head: true })
      .eq("status", "scheduled"),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Visão geral</h1>
          <div className="muted">
            Olá, {profile.full_name}. Esta é a nova base do sistema.
          </div>
        </div>
      </header>

      <section className="stats">
        <div className="card stat">
          <div className="muted">Campanhas</div>
          <strong>{campaigns.count ?? 0}</strong>
        </div>
        <div className="card stat">
          <div className="muted">Produtos</div>
          <strong>{products.count ?? 0}</strong>
        </div>
        <div className="card stat">
          <div className="muted">Publicações</div>
          <strong>{publications.count ?? 0}</strong>
        </div>
        <div className="card stat">
          <div className="muted">Agendadas</div>
          <strong>{scheduled.count ?? 0}</strong>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>Estado da migração</h2>
          <p className="muted">
            Base criada. O Apps Script permanece ativo até cada módulo ser
            validado aqui.
          </p>
        </div>
        <div className="card">
          <h2>Próximo módulo</h2>
          <p className="muted">
            Importação de Produtos e Campanhas preservando EAN, preços,
            imagens e histórico.
          </p>
        </div>
      </section>
    </>
  );
}
