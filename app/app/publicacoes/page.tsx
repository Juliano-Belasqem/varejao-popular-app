import Link from "next/link";
import ConfirmSubmitButton from "@/components/confirm-submit-button";
import { canEdit, requireProfile } from "@/lib/auth";
import { getMetaTokenHealth } from "@/lib/meta/token-health";
import { createClient } from "@/lib/supabase/server";
import { cancelScheduledPublicationAction, retryPublicationAction } from "./actions";
import { bulkPublicationAction } from "./bulk-actions";

const PAGE_SIZE = 20;

const statusLabels: Record<string, string> = { draft: "Rascunho", scheduled: "Agendada", publishing: "Publicando", published: "Publicada", error: "Erro", cancelled: "Cancelada" };
const networkLabels: Record<string, string> = { instagram: "Instagram", facebook: "Facebook" };
const typeLabels: Record<string, string> = { feed: "Feed", story: "Story", carousel: "Carrossel", reel: "Reel" };

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function pageHref(filters: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== "all") params.set(key, value);
  params.set("page", String(page));
  return `/app/publicacoes?${params.toString()}`;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; network?: string; type?: string; source?: string; q?: string; page?: string }> }) {
  const profile = await requireProfile();
  const filters = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number.parseInt(filters.page || "1", 10) || 1);
  const q = String(filters.q ?? "").trim().slice(0, 80);

  const [{ data: matchingCampaigns }, tokenHealth, draftCount, scheduledCount, publishedCount, errorCount] = await Promise.all([
    q ? supabase.from("campaigns").select("id").ilike("name", `%${q.replace(/[%_,()]/g, " ")}%`).limit(50) : Promise.resolve({ data: [] as { id: string }[] }),
    getMetaTokenHealth(),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("publications").select("*", { count: "exact", head: true }).eq("status", "error"),
  ]);

  let query = supabase
    .from("publications")
    .select("id,campaign_id,network,type,status,caption,scheduled_at,published_at,created_at,error_message", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.network && filters.network !== "all") query = query.eq("network", filters.network);
  if (filters.type && filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.source === "campaign") query = query.not("campaign_id", "is", null);
  if (filters.source === "independent") query = query.is("campaign_id", null);

  if (q) {
    const safeQ = q.replace(/[%_,()]/g, " ");
    const campaignIds = (matchingCampaigns ?? []).map((item) => item.id);
    query = campaignIds.length
      ? query.or(`caption.ilike.%${safeQ}%,campaign_id.in.(${campaignIds.join(",")})`)
      : query.ilike("caption", `%${safeQ}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: publications, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const campaignIds = [...new Set((publications ?? []).map((item) => item.campaign_id).filter(Boolean))] as string[];
  const publicationIds = (publications ?? []).map((item) => item.id);
  const [{ data: campaigns }, { data: media }] = await Promise.all([
    campaignIds.length ? supabase.from("campaigns").select("id,name").in("id", campaignIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    publicationIds.length ? supabase.from("publication_media").select("publication_id,public_url,sort_order").in("publication_id", publicationIds).order("sort_order", { ascending: true }) : Promise.resolve({ data: [] as { publication_id: string; public_url: string | null; sort_order: number }[] }),
  ]);

  const campaignName = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign.name]));
  const firstMedia = new Map<string, string>();
  for (const item of media ?? []) if (item.public_url && !firstMedia.has(item.publication_id)) firstMedia.set(item.publication_id, item.public_url);

  const metaChecks = [
    { label: "Página do Facebook", ok: configured("META_FACEBOOK_PAGE_ID") },
    { label: "Conta do Instagram", ok: configured("META_INSTAGRAM_USER_ID") },
    { label: "Page Access Token", ok: configured("META_PAGE_ACCESS_TOKEN") },
    { label: "Supabase admin", ok: configured("SUPABASE_SECRET_KEY") },
    { label: "Segredo do scheduler", ok: configured("CRON_SECRET") },
  ];
  const metaReady = metaChecks.slice(0, 4).every((item) => item.ok) && tokenHealth.valid !== false;
  const schedulerReady = metaChecks[3].ok && metaChecks[4].ok;
  const hasFilters = Boolean(q) || [filters.status, filters.network, filters.type, filters.source].some((value) => value && value !== "all");
  const tokenStatus = tokenHealth.valid === true ? "Token válido" : tokenHealth.valid === false ? "Token inválido" : "Não verificado";

  return (
    <>
      <header className="page-head">
        <div><h1>Publicações</h1><div className="muted">Gerencie rascunhos, agendamentos e o histórico de Instagram e Facebook.</div></div>
        <Link className="btn primary" href="/app/publicacoes/nova">+ Nova publicação</Link>
      </header>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div><h2 style={{ margin: 0 }}>Integração Meta</h2><div className="muted" style={{ marginTop: 4 }}>Configuração e validade do token sem exibir segredos.</div></div>
          <span className="pill">{metaReady ? "Meta pronta" : "Configuração pendente"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 9 }}>
          {metaChecks.map((check) => <div key={check.label} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 11, display: "flex", justifyContent: "space-between", gap: 10 }}><span style={{ fontWeight: 700 }}>{check.label}</span><span className="pill">{check.ok ? "Configurado" : "Pendente"}</span></div>)}
        </div>
        <div className={tokenHealth.valid === false ? "error" : "card"} style={{ marginTop: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>Saúde do Page Access Token</strong><span className="pill">{tokenStatus}</span></div>
          <div className="muted" style={{ marginTop: 6 }}>{tokenHealth.message}</div>
        </div>
        <div className="muted" style={{ marginTop: 11 }}>Publicação manual: {metaReady ? "pronta" : "requer atenção"}. Scheduler: {schedulerReady ? "pronto" : "requer configuração"}.</div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 }}>
        <Link href="/app/publicacoes?status=draft" className="card" style={{ color: "inherit", textDecoration: "none" }}><div className="muted">Rascunhos</div><div style={{ fontSize: 28, fontWeight: 900 }}>{draftCount.count ?? 0}</div></Link>
        <Link href="/app/publicacoes?status=scheduled" className="card" style={{ color: "inherit", textDecoration: "none" }}><div className="muted">Agendadas</div><div style={{ fontSize: 28, fontWeight: 900 }}>{scheduledCount.count ?? 0}</div></Link>
        <Link href="/app/publicacoes?status=published" className="card" style={{ color: "inherit", textDecoration: "none" }}><div className="muted">Publicadas</div><div style={{ fontSize: 28, fontWeight: 900 }}>{publishedCount.count ?? 0}</div></Link>
        <Link href="/app/publicacoes?status=error" className="card" style={{ color: "inherit", textDecoration: "none" }}><div className="muted">Com erro</div><div style={{ fontSize: 28, fontWeight: 900 }}>{errorCount.count ?? 0}</div></Link>
      </div>

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="page-head" style={{ marginBottom: 12 }}><div><h2 style={{ margin: 0 }}>Filtros e busca</h2><div className="muted">A busca encontra texto da legenda ou nome da campanha.</div></div>{hasFilters && <Link href="/app/publicacoes" className="btn">Limpar filtros</Link>}</div>
        <form method="get" style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) repeat(4,minmax(130px,1fr)) auto", gap: 10, alignItems: "end" }}>
          <label className="field"><span>Buscar</span><input className="input" name="q" defaultValue={q} placeholder="Legenda ou campanha" /></label>
          <label className="field"><span>Status</span><select className="input" name="status" defaultValue={filters.status || "all"}><option value="all">Todos</option><option value="draft">Rascunhos</option><option value="scheduled">Agendadas</option><option value="published">Publicadas</option><option value="error">Com erro</option><option value="cancelled">Canceladas</option></select></label>
          <label className="field"><span>Rede</span><select className="input" name="network" defaultValue={filters.network || "all"}><option value="all">Todas</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label>
          <label className="field"><span>Tipo</span><select className="input" name="type" defaultValue={filters.type || "all"}><option value="all">Todos</option><option value="feed">Feed</option><option value="story">Story</option><option value="carousel">Carrossel</option><option value="reel">Reel</option></select></label>
          <label className="field"><span>Origem</span><select className="input" name="source" defaultValue={filters.source || "all"}><option value="all">Todas</option><option value="campaign">Campanhas</option><option value="independent">Independentes</option></select></label>
          <button className="btn primary" type="submit">Aplicar</button>
        </form>
      </section>

      {canEdit(profile.role) && (
        <form id="bulk-publications-form" action={bulkPublicationAction} className="card" style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong>Ações em lote:</strong>
          <ConfirmSubmitButton className="btn" name="bulk_action" value="cancel" message="Cancelar as publicações agendadas selecionadas?">Cancelar agendadas</ConfirmSubmitButton>
          <ConfirmSubmitButton className="btn" name="bulk_action" value="retry_errors" message="Tentar publicar novamente os erros selecionados?">Tentar erros novamente</ConfirmSubmitButton>
          <ConfirmSubmitButton className="btn danger" name="bulk_action" value="delete_drafts" message="Excluir definitivamente os rascunhos, cancelados ou erros selecionados e suas mídias?">Excluir elegíveis</ConfirmSubmitButton>
          <span className="muted" style={{ fontSize: 12 }}>Selecione até 50 itens na página atual.</span>
        </form>
      )}

      <section className="card">
        <div className="page-head" style={{ marginBottom: 14 }}><div><h2 style={{ margin: 0 }}>Fila de publicações</h2><div className="muted">{total} resultado(s) · página {Math.min(page, totalPages)} de {totalPages}</div></div></div>
        {error ? <div className="error">Não foi possível carregar as publicações.</div> : !(publications ?? []).length ? <div className="empty">Nenhuma publicação encontrada.</div> : (
          <div style={{ display: "grid", gap: 10 }}>
            {(publications ?? []).map((publication) => {
              const preview = firstMedia.get(publication.id);
              return (
                <article key={publication.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, display: "grid", gridTemplateColumns: canEdit(profile.role) ? "28px 72px 1fr auto" : "72px 1fr auto", gap: 12, alignItems: "center" }}>
                  {canEdit(profile.role) && <input form="bulk-publications-form" type="checkbox" name="publication_id" value={publication.id} aria-label="Selecionar publicação" />}
                  <Link href={`/app/publicacoes/${publication.id}`} style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", background: "#f8fafc", display: "grid", placeItems: "center", textDecoration: "none" }}>{preview ? <img src={preview} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="muted" style={{ fontSize: 11 }}>Sem mídia</span>}</Link>
                  <Link href={`/app/publicacoes/${publication.id}`} style={{ minWidth: 0, textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}><strong>{networkLabels[publication.network] ?? publication.network}</strong><span className="pill">{typeLabels[publication.type] ?? publication.type}</span><span className="pill">{statusLabels[publication.status] ?? publication.status}</span></div>
                    <div style={{ fontWeight: 800, marginTop: 6 }}>{publication.campaign_id ? campaignName.get(publication.campaign_id) ?? "Campanha" : "Publicação independente"}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{publication.caption || "Sem legenda"}</div>
                    {publication.status === "scheduled" && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>Agendada para {dateLabel(publication.scheduled_at)}</div>}
                    {publication.status === "error" && publication.error_message && <div className="error" style={{ marginTop: 5, fontSize: 12 }}>{publication.error_message}</div>}
                  </Link>
                  <div style={{ display: "grid", gap: 7, justifyItems: "end" }}>
                    <Link className="btn" href={`/app/publicacoes/${publication.id}`}>Abrir</Link>
                    <Link className="btn" href={`/app/publicacoes/${publication.id}/historico`}>Histórico</Link>
                    {canEdit(profile.role) && publication.status === "scheduled" && <form action={cancelScheduledPublicationAction}><input type="hidden" name="id" value={publication.id} /><ConfirmSubmitButton message="Cancelar este agendamento?">Cancelar</ConfirmSubmitButton></form>}
                    {canEdit(profile.role) && publication.status === "error" && <form action={retryPublicationAction}><input type="hidden" name="id" value={publication.id} /><ConfirmSubmitButton className="btn primary" message="Tentar publicar novamente?">Tentar novamente</ConfirmSubmitButton></form>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {totalPages > 1 && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 16 }}><div>{page > 1 ? <Link className="btn" href={pageHref(filters, page - 1)}>← Anterior</Link> : <span />}</div><span className="muted">Página {Math.min(page, totalPages)} de {totalPages}</span><div>{page < totalPages ? <Link className="btn" href={pageHref(filters, page + 1)}>Próxima →</Link> : <span />}</div></div>}
      </section>
    </>
  );
}
