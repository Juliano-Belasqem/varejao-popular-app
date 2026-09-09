"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Format = "feed" | "story";
type Mode = "composed" | "individual";
type Quantity = 1 | 2 | 4;
type Network = "instagram" | "facebook";

type Campaign = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  theme: string | null;
};

type Item = {
  id: string;
  product_id: string | null;
  normal_price: number | string | null;
  offer_price: number | string | null;
  highlighted_price: string | null;
  ean_snapshot: string | null;
  name_snapshot: string | null;
  brand_snapshot: string | null;
  specification_snapshot: string | null;
};

type SavedMaterial = {
  name: string;
  path: string;
  created_at: string | null;
  size: number | null;
  url: string | null;
};

function money(value: number | string | null) {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parsed);
}

function dateLabel(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function savedDate(value: string | null) {
  if (!value) return "Data indisponível";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR");
}

function savedSize(value: number | null) {
  if (!value || !Number.isFinite(value)) return "";
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "produto";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar PNG"))), "image/png", 0.96);
  });
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

export default function GeneratorClientOptimized({ campaign, items }: { campaign: Campaign; items: Item[] }) {
  const [format, setFormat] = useState<Format>("feed");
  const [mode, setMode] = useState<Mode>("composed");
  const [qty, setQty] = useState<Quantity>(1);
  const [individualId, setIndividualId] = useState(items[0]?.id ?? "");
  const [composedIds, setComposedIds] = useState<string[]>(items.slice(0, 1).map((item) => item.id));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef(new Map<string, Promise<HTMLImageElement>>());

  const normalizeComposedSelection = useCallback((nextQty: Quantity, currentIds: string[]) => {
    const validIds = currentIds.filter((id) => items.some((item) => item.id === id)).slice(0, nextQty);
    const fill = items.map((item) => item.id).filter((id) => !validIds.includes(id));
    return [...validIds, ...fill].slice(0, Math.min(nextQty, items.length));
  }, [items]);

  const selectedItems = useMemo(() => {
    if (mode === "individual") {
      const found = items.find((item) => item.id === individualId) ?? items[0];
      return found ? [found] : [];
    }
    return composedIds.map((id) => items.find((item) => item.id === id)).filter((item): item is Item => Boolean(item));
  }, [items, mode, individualId, composedIds]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/digital-materials?campaign_id=${encodeURIComponent(campaign.id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar histórico");
      setMaterials(Array.isArray(payload.materials) ? payload.materials : []);
    } catch {
      setMaterials([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [campaign.id]);

  const loadImageCached = useCallback((url: string) => {
    const cached = imageCacheRef.current.get(url);
    if (cached) return cached;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => {
        imageCacheRef.current.delete(url);
        reject(new Error("Falha ao carregar imagem"));
      };
      image.src = url;
    });
    imageCacheRef.current.set(url, promise);
    return promise;
  }, []);

  const draw = useCallback(async (target: HTMLCanvasElement, drawItems: Item[], drawFormat: Format = format) => {
    const width = 1080;
    const height = drawFormat === "story" ? 1920 : 1080;
    target.width = width;
    target.height = height;
    const ctx = target.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0b3a78");
    gradient.addColorStop(0.56, "#1559a8");
    gradient.addColorStop(0.561, "#f7941d");
    gradient.addColorStop(1, "#f7a733");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const pad = drawFormat === "story" ? 70 : 54;
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${drawFormat === "story" ? 54 : 46}px Arial, sans-serif`;
    ctx.fillText("VAREJÃO POPULAR", pad, pad + 48);
    ctx.font = `700 ${drawFormat === "story" ? 34 : 28}px Arial, sans-serif`;
    ctx.fillText(campaign.theme || "OFERTAS", pad, pad + 94);
    ctx.font = `400 ${drawFormat === "story" ? 24 : 20}px Arial, sans-serif`;
    const dates = `${campaign.start_date ? `De ${dateLabel(campaign.start_date)}` : ""}${campaign.end_date ? ` até ${dateLabel(campaign.end_date)}` : ""}`;
    if (dates.trim()) ctx.fillText(dates, pad, pad + 132);

    const headerH = drawFormat === "story" ? 210 : 170;
    const footerH = drawFormat === "story" ? 92 : 70;
    const contentTop = pad + headerH;
    const contentBottom = height - pad - footerH;
    const gap = drawFormat === "story" ? 28 : 22;
    const cols = drawItems.length === 1 ? 1 : 2;
    const rows = Math.ceil(drawItems.length / cols);
    const cardW = (width - pad * 2 - gap * (cols - 1)) / cols;
    const cardH = (contentBottom - contentTop - gap * (rows - 1)) / rows;

    for (let index = 0; index < drawItems.length; index++) {
      const item = drawItems[index];
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = pad + col * (cardW + gap);
      const y = contentTop + row * (cardH + gap);

      ctx.fillStyle = "rgba(255,255,255,.98)";
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 28);
      ctx.fill();

      const inner = drawItems.length === 4 ? 22 : 34;
      const imageBox = Math.min(cardW - inner * 2, cardH * (drawItems.length === 1 ? 0.54 : 0.48));
      const imageX = x + (cardW - imageBox) / 2;
      const imageY = y + inner;

      if (item.product_id) {
        try {
          const image = await loadImageCached(`/api/product-image/${encodeURIComponent(item.product_id)}`);
          const scale = Math.min(imageBox / image.naturalWidth, imageBox / image.naturalHeight);
          const w = image.naturalWidth * scale;
          const h = image.naturalHeight * scale;
          ctx.drawImage(image, imageX + (imageBox - w) / 2, imageY + (imageBox - h) / 2, w, h);
        } catch {
          ctx.fillStyle = "#94a3b8";
          ctx.font = `600 ${drawItems.length === 4 ? 22 : 28}px Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("SEM IMAGEM", x + cardW / 2, imageY + imageBox / 2);
          ctx.textAlign = "left";
        }
      }

      const textY = imageY + imageBox + (drawItems.length === 4 ? 22 : 30);
      ctx.fillStyle = "#0f172a";
      ctx.font = `900 ${drawItems.length === 4 ? 28 : drawFormat === "story" ? 40 : 36}px Arial, sans-serif`;
      const nameLines = wrapText(ctx, item.name_snapshot || "Produto", cardW - inner * 2, 2);
      nameLines.forEach((line, i) => ctx.fillText(line, x + inner, textY + i * (drawItems.length === 4 ? 32 : 44)));

      const meta = [item.brand_snapshot, item.specification_snapshot].filter(Boolean).join(" · ");
      if (meta) {
        ctx.fillStyle = "#64748b";
        ctx.font = `500 ${drawItems.length === 4 ? 20 : 26}px Arial, sans-serif`;
        ctx.fillText(meta.slice(0, 55), x + inner, textY + nameLines.length * (drawItems.length === 4 ? 32 : 44) + 22);
      }

      const highlighted = item.highlighted_price === "normal" ? item.normal_price : item.offer_price ?? item.normal_price;
      const normal = item.normal_price == null ? null : Number(item.normal_price);
      const offer = item.offer_price == null ? null : Number(item.offer_price);
      const priceY = y + cardH - inner - (drawItems.length === 4 ? 14 : 18);
      if (normal != null && offer != null && Number.isFinite(normal) && Number.isFinite(offer) && normal !== offer) {
        ctx.fillStyle = "#64748b";
        ctx.font = `500 ${drawItems.length === 4 ? 20 : 24}px Arial, sans-serif`;
        ctx.fillText(`De ${money(item.normal_price)}`, x + inner, priceY - (drawItems.length === 4 ? 52 : 70));
      }
      ctx.fillStyle = "#e66c00";
      ctx.font = `950 ${drawItems.length === 4 ? 48 : drawFormat === "story" ? 76 : 66}px Arial, sans-serif`;
      ctx.fillText(money(highlighted), x + inner, priceY);
    }

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = `400 ${drawFormat === "story" ? 20 : 17}px Arial, sans-serif`;
    ctx.fillText("Ofertas válidas enquanto durarem os estoques.", pad, height - pad);
  }, [campaign.end_date, campaign.start_date, campaign.theme, format, loadImageCached]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setComposedIds((current) => normalizeComposedSelection(qty, current));
  }, [qty, normalizeComposedSelection]);

  useEffect(() => {
    if (!canvasRef.current || !selectedItems.length) return;
    const canvas = canvasRef.current;
    const frame = requestAnimationFrame(() => {
      void draw(canvas, selectedItems).catch(() => setStatus("Não foi possível desenhar a prévia."));
    });
    return () => cancelAnimationFrame(frame);
  }, [draw, selectedItems]);

  function selectComposedItem(itemId: string) {
    setComposedIds((current) => {
      if (qty === 1) return [itemId];
      if (current.includes(itemId)) {
        if (current.length <= 1) return current;
        return current.filter((id) => id !== itemId);
      }
      if (current.length >= qty) return [...current.slice(1), itemId];
      return [...current, itemId];
    });
  }

  async function saveBlob(blob: Blob, drawItems: Item[], saveMode: Mode, saveFormat: Format = format) {
    const form = new FormData();
    const label = saveMode === "individual" ? drawItems[0]?.name_snapshot || "produto" : `${drawItems.length}-produtos`;
    const filename = `${slug(campaign.name)}-${slug(label)}-${saveFormat}.png`;
    form.append("file", new File([blob], filename, { type: "image/png" }));
    form.append("campaign_id", campaign.id);
    form.append("format", saveFormat);
    form.append("mode", saveMode);
    form.append("item_ids", JSON.stringify(drawItems.map((item) => item.id)));

    const response = await fetch("/api/digital-materials", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Falha ao salvar material");
    return payload as { path: string };
  }

  async function downloadCurrent() {
    if (!canvasRef.current || !selectedItems.length) return;
    setBusy(true);
    setStatus("Preparando PNG...");
    await yieldToBrowser();
    try {
      await draw(canvasRef.current, selectedItems);
      const blob = await canvasBlob(canvasRef.current);
      const label = mode === "individual" ? selectedItems[0]?.name_snapshot || "produto" : `${selectedItems.length}-produtos`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug(campaign.name)}-${slug(label)}-${format}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("PNG gerado e baixado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gerar PNG.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrent() {
    if (!canvasRef.current || !selectedItems.length) return;
    setBusy(true);
    setStatus("Preparando material...");
    await yieldToBrowser();
    try {
      await draw(canvasRef.current, selectedItems);
      const blob = await canvasBlob(canvasRef.current);
      await saveBlob(blob, selectedItems, mode);
      await loadHistory();
      setStatus("Material salvo. Ele já aparece em Materiais salvos.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao salvar material.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAllIndividual() {
    if (!items.length) return;
    setBusy(true);
    setStatus(`Preparando ${items.length} arte(s)...`);
    await yieldToBrowser();
    try {
      const offscreen = document.createElement("canvas");
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setStatus(`Gerando ${i + 1} de ${items.length}: ${item.name_snapshot || "Produto"}`);
        await yieldToBrowser();
        await draw(offscreen, [item]);
        const blob = await canvasBlob(offscreen);
        await saveBlob(blob, [item], "individual");
      }
      await loadHistory();
      setStatus(`${items.length} arte(s) individual(is) salvas.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gerar o lote individual.");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(material: SavedMaterial, network: Network) {
    setBusy(true);
    setStatus(`Criando rascunho para ${network === "instagram" ? "Instagram" : "Facebook"}...`);
    await yieldToBrowser();
    try {
      const publicationType: Format = material.name.toLowerCase().includes("story") ? "story" : "feed";
      const response = await fetch("/api/publication-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaign.id,
          material_path: material.path,
          network,
          type: publicationType,
          caption: campaign.name,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao criar rascunho");
      setStatus(`Rascunho criado com sucesso para ${network === "instagram" ? "Instagram" : "Facebook"}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao criar rascunho.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div className="grid" style={{ alignItems: "start" }}>
        <section className="card">
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>Configurar material</h2>
            <div className="muted" style={{ marginTop: 5 }}>Escolha o tipo, formato e exatamente quais produtos aparecem na arte.</div>
          </div>

          <div className="form">
            <div className="card" style={{ padding: 14 }}>
              <strong>1. Tipo de arte</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <button className={`btn ${mode === "composed" ? "primary" : ""}`} type="button" onClick={() => setMode("composed")} disabled={busy}>Peça composta</button>
                <button className={`btn ${mode === "individual" ? "primary" : ""}`} type="button" onClick={() => setMode("individual")} disabled={busy}>Arte individual</button>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <strong>2. Formato</strong>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <button className={`btn ${format === "feed" ? "primary" : ""}`} type="button" onClick={() => setFormat("feed")} disabled={busy}>Feed 1080×1080</button>
                <button className={`btn ${format === "story" ? "primary" : ""}`} type="button" onClick={() => setFormat("story")} disabled={busy}>Story 1080×1920</button>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <strong>3. Produtos da prévia</strong>
              {mode === "composed" ? (
                <>
                  <label className="field" style={{ marginTop: 10 }}>
                    <span>Quantidade na peça</span>
                    <select className="input" value={String(qty)} onChange={(event) => setQty(Number(event.target.value) as Quantity)} disabled={busy}>
                      <option value="1">1 produto</option>
                      <option value="2">2 produtos</option>
                      <option value="4">4 produtos</option>
                    </select>
                  </label>
                  <div className="muted" style={{ margin: "10px 0 8px" }}>Selecione até {qty} item(ns). Se o limite estiver cheio, o próximo clique substitui o mais antigo.</div>
                  <div style={{ display: "grid", gap: 8, maxHeight: 310, overflowY: "auto" }}>
                    {items.map((item) => {
                      const selected = composedIds.includes(item.id);
                      return (
                        <button key={item.id} type="button" onClick={() => selectComposedItem(item.id)} disabled={busy} style={{ border: selected ? "2px solid #1559a8" : "1px solid #d8dee8", background: selected ? "#eef6ff" : "white", borderRadius: 12, padding: 10, display: "grid", gridTemplateColumns: "50px 1fr auto", gap: 10, alignItems: "center", textAlign: "left", cursor: "pointer" }}>
                          <div style={{ width: 50, height: 50, borderRadius: 8, overflow: "hidden", background: "#fff", border: "1px solid #edf0f4" }}>
                            {item.product_id ? <img src={`/api/product-image/${encodeURIComponent(item.product_id)}`} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800 }}>{item.name_snapshot || "Produto"}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{[item.brand_snapshot, item.specification_snapshot].filter(Boolean).join(" · ")}</div>
                          </div>
                          <span className="pill">{selected ? `${composedIds.indexOf(item.id) + 1}º` : "Adicionar"}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <label className="field" style={{ marginTop: 10 }}>
                  <span>Produto exibido</span>
                  <select className="input" value={individualId} onChange={(event) => setIndividualId(event.target.value)} disabled={busy}>
                    {items.map((item) => <option key={item.id} value={item.id}>{item.name_snapshot || "Produto"}</option>)}
                  </select>
                </label>
              )}
            </div>

            <div className="card" style={{ padding: 14 }}>
              <strong>4. Ações</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <button className="btn primary" type="button" onClick={() => void downloadCurrent()} disabled={busy || !selectedItems.length}>Baixar PNG da prévia</button>
                <button className="btn" type="button" onClick={() => void saveCurrent()} disabled={busy || !selectedItems.length}>Salvar prévia no sistema</button>
                {mode === "individual" && <button className="btn" type="button" onClick={() => void saveAllIndividual()} disabled={busy || !items.length}>Gerar e salvar todos os itens</button>}
              </div>
            </div>
          </div>

          {status && <div className={status.toLowerCase().includes("falha") ? "error" : "muted"} style={{ marginTop: 12 }}>{status}</div>}
        </section>

        <section className="card">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Prévia atual</h2>
              <div className="muted">{format === "story" ? "Story 1080 × 1920" : "Feed 1080 × 1080"} · {selectedItems.length} produto(s)</div>
            </div>
            <span className="pill">Não salva automaticamente</span>
          </div>

          {!selectedItems.length ? (
            <div className="empty">Selecione pelo menos um produto da campanha.</div>
          ) : (
            <div style={{ width: "100%", maxWidth: format === "story" ? 430 : 620, margin: "0 auto" }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "auto", borderRadius: 18, boxShadow: "0 18px 50px rgba(15,23,42,.18)", display: "block" }} />
            </div>
          )}
          <div className="muted" style={{ marginTop: 12 }}>A prévia é temporária. Ela só vira arquivo permanente ao salvar.</div>
        </section>
      </div>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Materiais salvos</h2>
            <div className="muted">Além de visualizar e baixar, agora você pode transformar um material salvo em rascunho de publicação.</div>
          </div>
          <button className="btn" type="button" onClick={() => void loadHistory()} disabled={historyLoading}>Atualizar</button>
        </div>

        {historyLoading ? (
          <div className="muted">Carregando materiais...</div>
        ) : materials.length === 0 ? (
          <div className="empty">Nenhum material desta campanha foi salvo ainda.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
            {materials.map((material) => (
              <article key={material.path} className="card" style={{ padding: 10 }}>
                <div style={{ aspectRatio: "1 / 1", borderRadius: 10, background: "#f8fafc", overflow: "hidden", display: "grid", placeItems: "center" }}>
                  {material.url ? <img src={material.url} alt={material.name} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="muted">Prévia indisponível</span>}
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, marginTop: 8, overflowWrap: "anywhere" }}>{material.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{savedDate(material.created_at)}{savedSize(material.size) ? ` · ${savedSize(material.size)}` : ""}</div>
                {material.url && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 }}>
                    <a className="btn" href={material.url} target="_blank" rel="noreferrer">Visualizar</a>
                    <a className="btn" href={material.url} download={material.name}>Baixar</a>
                  </div>
                )}
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  <button className="btn" type="button" disabled={busy} onClick={() => void createDraft(material, "instagram")}>Criar rascunho Instagram</button>
                  <button className="btn" type="button" disabled={busy} onClick={() => void createDraft(material, "facebook")}>Criar rascunho Facebook</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
