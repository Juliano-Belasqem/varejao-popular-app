import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { validatePublicationMedia } from "@/lib/publications/validation";
import { createClient } from "@/lib/supabase/server";
import {
  addPublicationMediaAction,
  deleteDraftAction,
  publishNowAction,
  removePublicationMediaAction,
  returnToDraftAction,
  savePublicationAction,
  schedulePublicationAction,
} from "../actions";
import { duplicatePublicationAction } from "../duplicate-action";
import PublishSubmitButton from "./publish-submit-button";
import VideoUploader from "./video-uploader";

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
  const validation = validatePublicationMedia(publication, media ?? []);

  let availableMaterials: Array<{ name: string; path: string; url: string | null }> = [];
  if (editable && publication.campaign_id && publication.type !== "reel") {
    const { data: files } = await supabase.storage
      .from("digital-materials")
      .list(publication.campaign_id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

    availableMaterials = await Promise.all(
      (files ?? [])
        .filter((file) => file.name.toLowerCase().endsWith(".png"))
        .map(async (file) => {
          const path = `${publication.campaign_id}/${file.name}`;
          const { data } = await supabase.storage.from("digital-materials").createSignedUrl(path, 1800);
          return { name: file.name, path, url: data?.signedUrl ?? null };
        }),
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <Link href="/app/publicacoes" className="muted">← Voltar para publicações</Link>
          <h1 style={{ marginTop: 8 }}>Editar publicação</h1>
          <div className="muted">{campaign?.name ?? "Sem campanha"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {canEdit(profile.role) && (
            <form action={duplicatePublicationAction}>
              <input type="hidden" name="id" value={publication.id} />
              <button className="btn" type="submit">Duplicar publicação</button>
            </form>
          )}
          <span className="pill">{statusLabels[publication.status] ?? publication.status}</span>
        </div>
      </header>

      <div className="grid" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Conteúdo</h2>
              <div className="muted">{media?.length ?? 0} mídia(s) vinculada(s)</div>
            </div>
            <span className="pill">{validation.ok ? "Mídia pronta" : "Mídia pendente"}</span>
          </div>

          {!media?.length ? (
            <div className="empty">Nenhuma mídia vinculada.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              {media.map((item, index) => (
                <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "#f8fafc" }}>
                  <div style={{ aspectRatio: item.media_type === "video" ? "9 / 16" : "1 / 1", display: "grid", placeItems: "center", background: "#0f172a" }}>
                    {item.public_url && item.media_type === "video" ? (
                      <video src={item.public_url} controls preload="metadata" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : item.public_url ? (
                      <img src={item.public_url} alt={`Material ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f8fafc" }} />
                    ) : (
                      <div className="empty">Prévia indisponível</div>
                    )}
                  </div>
                  <div style={{ padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span className="pill">{index + 1}º · {item.media_type === "video" ? "Vídeo" : "Imagem"}</span>
                    {editable && (
                      <form action={removePublicationMediaAction}>
                        <input type="hidden" name="id" value={publication.id} />
                        <input type="hidden" name="media_id" value={item.id} />
                        <button className="btn" type="submit">Remover</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!validation.ok && <div className="error" style={{ marginTop: 12 }}>{validation.message}</div>}

          {editable && publication.type === "reel" && (
            <VideoUploader publicationId={publication.id} campaignId={publication.campaign_id} />
          )}

          {editable && publication.campaign_id && publication.type !== "reel" && (
            <div className="card" style={{ padding: 14, marginTop: 16 }}>
              <strong>Adicionar mídia da campanha</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Para carrossel do Instagram, use de 2 a 10 imagens. A ordem segue a sequência em que você adiciona as mídias.
              </div>
              {!availableMaterials.length ? (
                <div className="empty" style={{ marginTop: 10 }}>Nenhum material salvo disponível nesta campanha.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginTop: 12 }}>
                  {availableMaterials.map((material) => (
                    <form key={material.path} action={addPublicationMediaAction} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 8 }}>
                      <input type="hidden" name="id" value={publication.id} />
                      <input type="hidden" name="material_path" value={material.path} />
                      <div style={{ aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", background: "#f8fafc", display: "grid", placeItems: "center" }}>
                        {material.url ? <img src={material.url} alt={material.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="muted">Sem prévia</span>}
                      </div>
                      <button className="btn" type="submit" style={{ width: "100%", marginTop: 8 }} disabled={(media?.length ?? 0) >= 10}>Adicionar</button>
                    </form>
                  ))}
                </div>
              )}
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
              Suporte atual: Instagram Feed, Story, Carrossel e Reel; Facebook Feed, Story com imagem e Reel com vídeo.
            </div>
            <div className={validation.ok ? "muted" : "error"} style={{ marginTop: 10 }}>
              {validation.message}
            </div>
            {canPublishNow && validation.ok && (
              <form action={publishNowAction} style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={publication.id} />
                <PublishSubmitButton />
              </form>
            )}
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
                <button className="btn" type="submit" disabled={!validation.ok}>{publication.status === "scheduled" ? "Atualizar agendamento" : "Agendar publicação"}</button>
                {!validation.ok && <div className="muted" style={{ fontSize: 12 }}>Corrija a mídia antes de agendar.</div>}
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
