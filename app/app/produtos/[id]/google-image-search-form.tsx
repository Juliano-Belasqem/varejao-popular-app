"use client";

import { useEffect, useState } from "react";

type Props = {
  defaultQuery: string;
  initialTransparent?: boolean;
  initialType?: string;
  initialRatio?: string;
  initialSize?: string;
};

const STORAGE_KEY = "varejao:google-image-filters";

export function GoogleImageSearchForm({
  defaultQuery,
  initialTransparent = false,
  initialType = "",
  initialRatio = "",
  initialSize = "",
}: Props) {
  const [transparent, setTransparent] = useState(initialTransparent);
  const [type, setType] = useState(initialType);
  const [ratio, setRatio] = useState(initialRatio);
  const [size, setSize] = useState(initialSize);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { transparent?: boolean; type?: string; ratio?: string; size?: string };
      setTransparent(Boolean(parsed.transparent));
      setType(parsed.type || "");
      setRatio(parsed.ratio || "");
      setSize(parsed.size || "");
    } catch {
      // Ignora dados antigos/inválidos da sessão.
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ transparent, type, ratio, size }));
    } catch {
      // A persistência é apenas uma conveniência e não deve bloquear a busca.
    }
  }, [transparent, type, ratio, size]);

  return (
    <form method="get" className="form" style={{ flex: "1 1 520px" }}>
      <input type="hidden" name="image_source" value="google_images" />
      <input type="hidden" name="image_trans" value={transparent ? "1" : "0"} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label className="field" style={{ flex: "1 1 320px" }}>
          <span>Termo de busca</span>
          <input className="input" name="image_q" defaultValue={defaultQuery} aria-label="Termo de busca no Google Imagens" />
        </label>

        <label className="field" style={{ minWidth: 150 }}>
          <span>Tipo</span>
          <select className="input" name="image_type" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Qualquer</option>
            <option value="photo">Foto</option>
            <option value="clipart">Clipart</option>
          </select>
        </label>

        <label className="field" style={{ minWidth: 150 }}>
          <span>Formato</span>
          <select className="input" name="image_ratio" value={ratio} onChange={(event) => setRatio(event.target.value)}>
            <option value="">Qualquer</option>
            <option value="s">Quadrado</option>
            <option value="t">Vertical</option>
            <option value="w">Horizontal</option>
          </select>
        </label>

        <label className="field" style={{ minWidth: 150 }}>
          <span>Tamanho mínimo</span>
          <select className="input" name="image_size" value={size} onChange={(event) => setSize(event.target.value)}>
            <option value="">Qualquer</option>
            <option value="m">Médio</option>
            <option value="l">Grande</option>
          </select>
        </label>
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={transparent} onChange={(event) => setTransparent(event.target.checked)} />
        <span>Fundo transparente</span>
      </label>

      <button className="btn" type="submit">Buscar no Google Imagens</button>
    </form>
  );
}
