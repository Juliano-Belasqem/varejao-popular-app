import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteDraftAction, publishNowAction, returnToDraftAction, savePublicationAction, schedulePublicationAction } from "../actions";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  publishing: "Publicando",
  published: "Publicada",
  error: "Erro",
  cancelled: "Cancelada",
};

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export default async function PublicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: publication, error }, { data: media }] = await Promise.all([
    supabase
      .from("publications")
      .select("id,campaign_id,network,type,status,caption,scheduled_at,published_at,error_message,created_at,updated_at,meta_media_id,meta_post_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("publication_media")
      .select("id,public_url,storage_path,media_type,sort_order")
      .eq("publication_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (error || !publication) notFound();

  const { data: campaign } = publication.campaign_id
    ? await supabase.from("campaigns").select("id,name").eq("id", publication.campaign_id).maybeSingle()
    : { data: null };

  const editable = canEdit(profile.role) && ["draft", "scheduled", "error", "cancelled"].includes(publication.status);
  const canDelete = canEdit(profile.role) && ["draft", "error", "cancelled"].includes(publication.status);
  const canPublishNow = canEdit(profile.role) && ["draft", "scheduled", "error"].includes(publication.status);
  const supportedNow = (publication.network === "instagram" && ["feed", "story"].includes(publication.type)) || (publication.network === "facebook" && publication.type === "feed");

  return (
    <>
      <header className="page-head">
        <div>
          <Link href="/app/publicacoes" className="muted">← Voltar para publicações</Link>
          <h1 style={{ marginTop: 8 }}>Editar publicação</h1>
          <div className="muted">{campaign?.name ?? "Sem campanha"}</div>
        </div>
        <span className="pill">{statusLabels[publication.status] ?? publication.status}</span>
      </header>

      <div className="grid" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Conteúdo</h2>
          {!media?.length ? (
            <div className="empty">Nenhuma mídia vinculada.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {media.map((item) => (
                <div key={item.id} style={{ borderRadius: 14, overflow: "hidden", background: "#f8fafc" }}>
                  {item.public_url ? <img src={item.public_url} alt="Material da publicação" style={{ width: "100%", display: "block", maxHeight: 620, objectFit: "contain" }} /> : <div className="empty">Prévia indisponível</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Configuração</h2>
          <form action={savePublicationAction} className="form">
            <input type="hidden" name="id" value={publication.id} />
            <label className="field">
              <span>Rede</span>
              <select className="input" name="network" defaultValue={publication.network} disabled={!editable}>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </label>
            <label className="field">
              <span>Tipo</span>
              <select className="input" name="type" defaultValue={publication.type} disabled={!editable}>
                <option value="feed">Feed</option>
                <option value="story">Story</option>
                <option value="carousel">Carrossel</option>
                <option value="reel">Reel</option>
              </select>
            </label>
            <label className="field">
              <span>Legenda</span>
              <textarea className="input" name="caption" defaultValue={publication.caption ?? ""} rows={8} disabled={!editable} placeholder="Escreva a legenda da publicação..." />
            </label>
            {editable && <button className="btn primary" type="submit">Salvar alterações</button>}
          </form>

          <div className="card" style={{ padding: 14, marginTop: 16 }}>
            <strong>Publicação na Meta</strong>
            <div className="muted" style={{ marginTop: 7 }}>
              Neste bloco: Instagram Feed/Story com imagem e Facebook Feed com imagem. Carrossel, Reel e Facebook Story entram no próximo bloco.
            </div>
            {canPublishNow && supportedNow && (
              <form action={publishNowAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={publication.id} />
                <button className="btn primary" type="submit">Publicar agora</button>
              </form>
            )}
            {canPublishNow && !supportedNow && <div className="muted" style={{ marginTop: 10 }}>Esta combinação ainda não é publicável automaticamente.</div>}
            {publication.status === "published" && (
              <div className="muted" style={{ marginTop: 10 }}>Publicado com sucesso{publication.meta_post_id ? ` · ID ${publication.meta_post_id}` : ""}.</div>
            )}
          </div>

          <div className="card" style={{ padding: 14, marginTop: 16 }}>
            <strong>Agendamento</strong>
            {editable ? (
              <form action={schedulePublicationAction} className="form" style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={publication.id} />
                <label className="field">
                  <span>Data e hora (horário de Brasília)</span>
                  <input className="input" type="datetime-local" name="scheduled_at" defaultValue={dateTimeLocal(publication.scheduled_at)} required />
                </label>
                <button className="btn" type="submit">{publication.status === "scheduled" ? "Atualizar agendamento" : "Agendar publicação"}</button>
              </form>
            ) : (
              <div className="muted" style={{ marginTop: 8 }}>Esta publicação não pode mais ser reagendada.</div>
            )}

            {publication.status === "scheduled" && canEdit(profile.role) && (
              <form action={returnToDraftAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={publication.id} />
                <button className="btn" type="submit">Voltar para rascunho</button>
              </form>
            )}
          </div>

          {publication.error_message && <div className="error" style={{ marginTop: 14 }}>{publication.error_message}</div>}

          {canDelete && (
            <div style={{ marginTop: 18, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
              <form action={deleteDraftAction}>
                <input type="hidden" name="id" value={publication.id} />
                <button className="btn" type="submit">Excluir rascunho</button>
              </form>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
