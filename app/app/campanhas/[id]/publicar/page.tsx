import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { publicationTargets } from "@/lib/publications/targets";
import { createClient } from "@/lib/supabase/server";
import { createCampaignPublicationAction } from "./actions";

export default async function CampaignPublishPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const editable = canEdit(profile.role);
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id,name,theme")
    .eq("id", id)
    .maybeSingle();

  if (error || !campaign) notFound();

  const { data: files } = await supabase.storage
    .from("digital-materials")
    .list(campaign.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

  const materials = await Promise.all(
    (files ?? [])
      .filter((file) => file.name.toLowerCase().endsWith(".png"))
      .map(async (file) => {
        const path = `${campaign.id}/${file.name}`;
        const { data } = await supabase.storage.from("digital-materials").createSignedUrl(path, 3600);
        return { path, name: file.name, url: data?.signedUrl ?? null, created_at: file.created_at ?? null };
      }),
  );

  const imageTargets = publicationTargets.filter((target) => target.type !== "reel");

  return (
    <>
      <header className="page-head">
        <div>
          <Link href={`/app/campanhas/${campaign.id}`} className="muted">← Voltar para campanha</Link>
          <h1 style={{ marginTop: 8 }}>Montar publicação</h1>
          <div className="muted">{campaign.name} · transforme materiais salvos em rascunhos prontos para revisar ou agendar.</div>
        </div>
        <Link className="btn" href={`/app/campanhas/${campaign.id}/gerar`}>Gerar novo material</Link>
      </header>

      <section className="card" style={{ maxWidth: 1100 }}>
        {!editable ? (
          <div className="error">Seu perfil não possui permissão para criar publicações.</div>
        ) : !materials.length ? (
          <div className="empty">Nenhum material digital salvo nesta campanha. Gere e salve pelo menos um material antes de montar a publicação.</div>
        ) : (
          <form action={createCampaignPublicationAction} className="form">
            <input type="hidden" name="campaign_id" value={campaign.id} />

            <div className="form-grid compact">
              <label className="field">
                <span>Destino</span>
                <select className="input" name="target" defaultValue="instagram:feed" required>
                  {imageTargets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
                </select>
                <span className="muted" style={{ fontSize: 12 }}>Feed/Story usam 1 imagem. Carrossel do Instagram usa de 2 a 10.</span>
              </label>
              <label className="field">
                <span>Legenda</span>
                <textarea className="input" name="caption" rows={4} placeholder="Escreva a legenda que acompanhará a publicação..." />
              </label>
            </div>

            <div>
              <div className="page-head" style={{ marginBottom: 10 }}>
                <div><strong>Materiais salvos</strong><div className="muted" style={{ marginTop: 3 }}>Marque as imagens na ordem em que devem aparecer.</div></div>
                <span className="pill">{materials.length} disponível(is)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                {materials.map((material, index) => (
                  <label key={material.path} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 10, cursor: "pointer", display: "grid", gap: 8 }}>
                    <div style={{ aspectRatio: "1 / 1", background: "#f8fafc", borderRadius: 10, overflow: "hidden", display: "grid", placeItems: "center" }}>
                      {material.url ? <img src={material.url} alt={material.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="muted">Sem prévia</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <input type="checkbox" name="material_path" value={material.path} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{material.name}</div>
                        <div className="muted" style={{ fontSize: 11 }}>Material {index + 1}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <strong>Fluxo da Fase 6</strong>
              <div className="muted" style={{ marginTop: 5 }}>Ao continuar, o sistema cria um rascunho vinculado a esta campanha, copia as imagens para o armazenamento público da publicação e abre a tela final de revisão. Nada é publicado automaticamente.</div>
            </div>

            <button className="btn primary" type="submit">Criar rascunho para revisar</button>
          </form>
        )}
      </section>
    </>
  );
}
