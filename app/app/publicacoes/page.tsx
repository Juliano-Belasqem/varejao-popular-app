import Link from "next/link";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelScheduledPublicationAction, retryPublicationAction } from "./actions";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  publishing: "Publicando",
  published: "Publicada",
  error: "Erro",
  cancelled: "Cancelada",
};

const networkLabels: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

const typeLabels: Record<string, string> = {
  feed: "Feed",
  story: "Story",
  carousel: "Carrossel",
  reel: "Reel",
};

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; network?: string; type?: string; source?: string }>;
}) {
  const profile = await requireProfile();
  const filters = await searchParams;
  const supabase = await createClient();

  const { data: publications, error } = await supabase
    .from("publications")
    .select("id,campaign_id,network,type,status,caption,scheduled_at,published_at,created_at,error_message")
    .order("created_at", { ascending: false })
    .limit(100);

  const campaignIds = [...new Set((publications ?? []).map((item) => item.campaign_id).filter(Boolean))] as string[];
  const publicationIds = (publications ?? []).map((item) => item.id);

  const [{ data: campaigns }, { data: media }] = await Promise.all([
    campaignIds.length ? supabase.from("campaigns").select("id,name").in("id", campaignIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    publicationIds.length ? supabase.from("publication_media").select("publication_id,public_url,sort_order").in("publication_id", publicationIds).order("sort_order", { ascending: true }) : Promise.resolve({ data: [] as { publication_id: string; public_url: string | null; sort_order: number }[] }),
  ]);

  const campaignName = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign.name]));
  const firstMedia = new Map<string, string>();
  for (const item of media ?? []) {
    if (item.public_url && !firstMedia.has(item.publication_id)) firstMedia.set(item.publication_id, item.public_url);
  }

  const counts = (publications ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  const filteredPublications = (publications ?? []).filter((publication) => {
    if (filters.status && filters.status !== "all" && publication.status !== filters.status) return false;
    if (filters.network && filters.network !== "all" && publication.network !== filters.network) return false;
    if (filters.type && filters.type !== "all" && publication.type !== filters.type) return false;
    if (filters.source === "campaign" && !publication.campaign_id) return false;
    if (filters.source === "independent" && publication.campaign_id) return false;
    return true;
  });

  const metaChecks = [
    { label: "Página do Facebook", ok: configured("META_FACEBOOK_PAGE_ID") },
    { label: "Conta do Instagram", ok: configured("META_INSTAGRAM_USER_ID") },
    { label: "Page Access Token", ok: configured("META_PAGE_ACCESS_TOKEN") },
    { label: "Supabase admin", ok: configured("SUPABASE_SECRET_KEY") },
    { label: "Segredo do scheduler", ok: configured("CRON_SECRET") },
  ];
  const metaReady = metaChecks.slice(0, 4).every((item) => item.ok);
  const schedulerReady = metaChecks[3].ok && metaChecks[4].ok;
  const hasFilters = [filters.status, filters.network, filters.type, filters.source].some((value) => value && value !== "all");

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Publicações</h1>
          <div className="muted">Gerencie rascunhos, agendamentos e o histórico de Instagram e Facebook.</div>
        </div>
        <Link className="btn primary" href="/app/publicacoes/nova">+ Nova publicação</Link>
      </header>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Integração Meta</h2>
            <div className="muted" style={{ marginTop: 4 }}>O sistema verifica apenas se cada configuração existe; nenhum segredo é exibido nesta tela.</div>
          </div>
          <span className="pill">{metaReady ? "Meta pronta" : "Configuração pendente"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 9 }}>
          {metaChecks.map((check) => (
            <div key={check.label} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 11, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{check.label}</span>
              <span className="pill">{check.ok ? "Configurado" : "Pendente"}</span>
            </div>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 11 }}>
          Publicação manual: {metaReady ? "pronta para teste" : "aguardando credenciais"}. Scheduler: {schedulerReady ? "endpoint pronto para automação" : "aguardando CRON_SECRET/Supabase admin"}.
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        <div className="card"><div className="muted">Rascunhos</div><div style={{ fontSize: 28, fontWeight: 900 }}>{counts.draft ?? 0}</div></div>
        <div className="card"><div className="muted">Agendadas</div><div style={{ fontSize: 28, fontWeight: 900 }}>{counts.scheduled ?? 0}</div></div>
        <div className="card"><div className="muted">Publicadas</div><div style={{ fontSize: 28, fontWeight: 900 }}>{counts.published ?? 0}</div></div>
        <div className="card"><div className="muted">Com erro</div><div style={{ fontSize: 28, fontWeight: 900 }}>{counts.error ?? 0}</div></div>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Filtros</h2>
            <div className="muted">Encontre rapidamente o que precisa de atenção.</div>
          </div>
          {hasFilters && <Link href="/app/publicacoes" className="btn">Limpar filtros</Link>}
        </div>
        <form method="get" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, alignItems: "end" }}>
          <label className="field">
            <span>Status</span>
            <select className="input" name="status" defaultValue={filters.status || "all"}>
              <option value="all">Todos</option>
              <option value="draft">Rascunhos</option>
              <option value="scheduled">Agendadas</option>
              <option value="published">Publicadas</option>
              <option value="error">Com erro</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </label>
          <label className="field">
            <span>Rede</span>
            <select className="input" name="network" defaultValue={filters.network || "all"}>
              <option value="all">Todas</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </label>
          <label className="field">
            <span>Tipo</span>
            <select className="input" name="type" defaultValue={filters.type || "all"}>
              <option value="all">Todos</option>
              <option value="feed">Feed</option>
              <option value="story">Story</option>
              <option value="carousel">Carrossel</option>
              <option value="reel">Reel</option>
            </select>
          </label>
          <label className="field">
            <span>Origem</span>
            <select className="input" name="source" defaultValue={filters.source || "all"}>
              <option value="all">Todas</option>
              <option value="campaign">Campanhas</option>
              <option value="independent">Independentes</option>
            </select>
          </label>
          <button className="btn primary" type="submit">Aplicar filtros</button>
        </form>
      </section>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Fila de publicações</h2>
            <div className="muted">{filteredPublications.length} resultado(s). Aqui aparecem materiais do gerador e publicações criadas manualmente.</div>
          </div>
        </div>

        {error ? (
          <div className="error">Não foi possível carregar as publicações.</div>
        ) : !filteredPublications.length ? (
          <div className="empty">Nenhuma publicação encontrada com estes filtros.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredPublications.map((publication) => {
              const preview = firstMedia.get(publication.id);
              return (
                <article key={publication.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: "72px 1fr auto", gap: 12, alignItems: "center" }}>
                  <Link href={`/app/publicacoes/${publication.id}`} style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", background: "#f8fafc", display: "grid", placeItems: "center", textDecoration: "none" }}>
                    {preview ? <img src={preview} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="muted" style={{ fontSize: 11 }}>Sem mídia</span>}
                  </Link>
                  <Link href={`/app/publicacoes/${publication.id}`} style={{ minWidth: 0, textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                      <strong>{networkLabels[publication.network] ?? publication.network}</strong>
                      <span className="pill">{typeLabels[publication.type] ?? publication.type}</span>
                      <span className="pill">{statusLabels[publication.status] ?? publication.status}</span>
                    </div>
                    <div style={{ fontWeight: 800, marginTop: 6 }}>{publication.campaign_id ? campaignName.get(publication.campaign_id) ?? "Campanha" : "Publicação independente"}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{publication.caption || "Sem legenda"}</div>
                    {publication.status === "scheduled" && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Agendada para {dateLabel(publication.scheduled_at)}</div>}
                    {publication.status === "error" && publication.error_message && <div className="error" style={{ marginTop: 5, fontSize: 12 }}>{publication.error_message}</div>}
                  </Link>
                  <div style={{ display: "grid", gap: 7, justifyItems: "end" }}>
                    <Link className="btn" href={`/app/publicacoes/${publication.id}`}>Abrir</Link>
                    {canEdit(profile.role) && publication.status === "scheduled" && (
                      <form action={cancelScheduledPublicationAction}>
                        <input type="hidden" name="id" value={publication.id} />
                        <button className="btn" type="submit">Cancelar</button>
                      </form>
                    )}
                    {canEdit(profile.role) && publication.status === "error" && (
                      <form action={retryPublicationAction}>
                        <input type="hidden" name="id" value={publication.id} />
                        <button className="btn primary" type="submit">Tentar novamente</button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
