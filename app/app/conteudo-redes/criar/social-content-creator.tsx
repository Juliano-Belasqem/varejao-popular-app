"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const typeLabels: Record<string, string> = {
  anuncio: "Anúncio",
  comunicado: "Comunicado",
  sazonal: "Sazonal",
  homenagem: "Institucional / Homenagem",
};

type Props = { initialType: string };

type GenerationResponse = {
  image?: string;
  error?: string;
};

export function SocialContentCreator({ initialType }: Props) {
  const [type, setType] = useState(initialType);
  const [occasion, setOccasion] = useState(type === "homenagem" ? "Dia das Mães" : "");
  const [objective, setObjective] = useState("");
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [style, setStyle] = useState("acolhedor e elegante");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => typeLabels[type] ?? "Conteúdo para redes", [type]);

  async function generate() {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/openai/generate-social-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, occasion, objective, message, format, style, quality }),
      });

      const data = (await response.json()) as GenerationResponse;
      if (!response.ok || !data.image) throw new Error(data.error || "Não foi possível gerar a imagem.");
      setImage(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao gerar a imagem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <Link className="muted back-link" href="/app/conteudo-redes">← Conteúdo para Redes</Link>
          <h1>Criar {title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Preencha um briefing simples. A chave da OpenAI permanece somente no servidor.
          </p>
        </div>
        <span className="pill">GPT Image</span>
      </header>

      <div className="creator-layout">
        <section className="card">
          <div className="section-title-row">
            <div>
              <small className="eyebrow">BRIEFING</small>
              <h2>Proposta da arte</h2>
            </div>
          </div>

          <div className="form">
            <label className="field">
              <span>Tipo de conteúdo</span>
              <select className="input" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="anuncio">Anúncio</option>
                <option value="comunicado">Comunicado</option>
                <option value="sazonal">Sazonal</option>
                <option value="homenagem">Institucional / Homenagem</option>
              </select>
            </label>

            <label className="field">
              <span>Ocasião / tema</span>
              <input className="input" value={occasion} onChange={(event) => setOccasion(event.target.value)} placeholder="Ex.: Dia das Mães, horário de feriado..." />
            </label>

            <label className="field">
              <span>Objetivo</span>
              <textarea className="input" rows={3} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="O que esta publicação precisa comunicar?" />
            </label>

            <label className="field">
              <span>Mensagem principal</span>
              <textarea className="input" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ex.: Feliz Dia das Mães para todas as nossas clientes." />
            </label>

            <div className="form-grid compact">
              <label className="field">
                <span>Formato</span>
                <select className="input" value={format} onChange={(event) => setFormat(event.target.value as "feed" | "story")}>
                  <option value="feed">Feed · quadrado</option>
                  <option value="story">Story · vertical</option>
                </select>
              </label>

              <label className="field">
                <span>Qualidade</span>
                <select className="input" value={quality} onChange={(event) => setQuality(event.target.value as "low" | "medium" | "high")}>
                  <option value="low">Baixa · rascunho</option>
                  <option value="medium">Média · recomendada</option>
                  <option value="high">Alta · final</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>Direção visual</span>
              <input className="input" value={style} onChange={(event) => setStyle(event.target.value)} placeholder="Ex.: acolhedor, elegante, festivo..." />
            </label>

            {error ? <div className="error">{error}</div> : null}

            <button className="btn primary" onClick={generate} disabled={loading || !occasion.trim()} type="button">
              {loading ? "Gerando imagem..." : image ? "Gerar nova versão" : "Gerar imagem com IA"}
            </button>
          </div>
        </section>

        <section className="card creator-preview">
          <div className="section-title-row">
            <div>
              <small className="eyebrow">PRÉVIA</small>
              <h2>{format === "feed" ? "Feed" : "Story"}</h2>
            </div>
            <span className="pill">{quality}</span>
          </div>

          <div className={`social-preview ${format}`}>
            {image ? <img src={image} alt="Arte gerada por IA" /> : <div className="preview-placeholder">A imagem gerada aparecerá aqui.</div>}
          </div>

          {image ? (
            <a className="btn" href={image} download={`varejao-${type}-${format}.png`}>
              Baixar imagem gerada
            </a>
          ) : null}

          <p className="muted preview-note">
            Nesta primeira versão a IA gera o visual. A etapa seguinte será aplicar logo, textos e templates oficiais de forma controlada pelo aplicativo.
          </p>
        </section>
      </div>
    </div>
  );
}
