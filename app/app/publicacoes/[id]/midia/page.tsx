import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removePublicationMediaAction } from "../../actions";
import DirectMediaUploader from "../direct-media-uploader";

export default async function PublicationMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: publication, error }, { data: media }] = await Promise.all([
    supabase
      .from("publications")
      .select("id,campaign_id,network,type,status,caption")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("publication_media")
      .select("id,public_url,storage_path,media_type,sort_order")
      .eq("publication_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  if (error || !publication) notFound();

  const editable = canEdit(profile.role) && ["draft", "scheduled", "error", "cancelled"].includes(publication.status);

  return (
    <>
      <header className="page-head">
        <div>
          <Link href={`/app/publicacoes/${publication.id}`} className="muted">← Voltar para publicação</Link>
          <h1 style={{ marginTop: 8 }}>Adicionar mídia</h1>
          <div className="muted">{publication.network === "instagram" ? "Instagram" : "Facebook"} · {publication.type}</div>
        </div>
      </header>

      <section className="card" style={{ maxWidth: 900 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Mídias da publicação</h2>
            <div className="muted" style={{ marginTop: 4 }}>{media?.length ?? 0} arquivo(s) vinculado(s)</div>
          </div>
        </div>

        {!media?.length ? (
          <div className="empty">Nenhuma mídia adicionada ainda.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            {media.map((item, index) => (
              <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "#f8fafc" }}>
                <div style={{ aspectRatio: item.media_type === "video" ? "9 / 16" : "1 / 1", background: "#0f172a", display: "grid", placeItems: "center" }}>
                  {item.public_url && item.media_type === "video" ? (
                    <video src={item.public_url} controls preload="metadata" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : item.public_url ? (
                    <img src={item.public_url} alt={`Mídia ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f8fafc" }} />
                  ) : (
                    <span className="muted">Prévia indisponível</span>
                  )}
                </div>
                <div style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
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

        {editable && (
          <DirectMediaUploader
            publicationId={publication.id}
            campaignId={publication.campaign_id}
            currentCount={media?.length ?? 0}
          />
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <Link className="btn primary" href={`/app/publicacoes/${publication.id}`}>Continuar para revisar publicação</Link>
          <Link className="btn" href="/app/publicacoes">Voltar para fila</Link>
        </div>
      </section>
    </>
  );
}
