import Link from "next/link";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createIndependentPublicationAction } from "../actions";

export default async function NewPublicationPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const editable = canEdit(profile.role);

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id,name,start_date,end_date")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <header className="page-head">
        <div>
          <Link href="/app/publicacoes" className="muted">← Voltar para publicações</Link>
          <h1 style={{ marginTop: 8 }}>Nova publicação</h1>
          <div className="muted">Crie um rascunho independente, com ou sem vínculo a uma campanha.</div>
        </div>
      </header>

      <section className="card" style={{ maxWidth: 760 }}>
        <h2 style={{ marginTop: 0 }}>Configuração inicial</h2>
        <div className="muted" style={{ marginBottom: 16 }}>
          Depois de criar o rascunho, você poderá enviar imagens ou vídeo, revisar a publicação, publicar na hora ou agendar.
        </div>

        {!editable ? (
          <div className="error">Seu perfil não possui permissão para criar publicações.</div>
        ) : (
          <form action={createIndependentPublicationAction} className="form">
            <label className="field">
              <span>Rede</span>
              <select className="input" name="network" defaultValue="instagram" required>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </label>

            <label className="field">
              <span>Tipo</span>
              <select className="input" name="type" defaultValue="feed" required>
                <option value="feed">Feed</option>
                <option value="story">Story</option>
                <option value="carousel">Carrossel</option>
                <option value="reel">Reel</option>
              </select>
            </label>

            <label className="field">
              <span>Campanha (opcional)</span>
              <select className="input" name="campaign_id" defaultValue="">
                <option value="">Sem campanha</option>
                {(campaigns ?? []).map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
              <span className="muted" style={{ fontSize: 12 }}>
                Use apenas se quiser manter esta publicação associada a uma campanha existente.
              </span>
            </label>

            <label className="field">
              <span>Legenda</span>
              <textarea
                className="input"
                name="caption"
                rows={8}
                placeholder="Escreva a legenda da publicação..."
              />
            </label>

            <button className="btn primary" type="submit">Criar rascunho e adicionar mídia</button>
          </form>
        )}
      </section>
    </>
  );
}
