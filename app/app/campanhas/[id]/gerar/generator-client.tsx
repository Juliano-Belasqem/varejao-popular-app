"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Format = "feed" | "story";
type Mode = "composed" | "individual";
type Quantity = 1 | 2 | 4;

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

async function loadImage(url: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Falha ao carregar imagem"));
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar PNG"))), "image/png", 1);
  });
}

export default function GeneratorClient({ campaign, items }: { campaign: Campaign; items: Item[] }) {
  const [format, setFormat] = useState<Format>("feed");
  const [mode, setMode] = useState<Mode>("composed");
  const [qty, setQty] = useState<Quantity>(1);
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedItems = useMemo(() => {
    if (mode === "individual") {
      const found = items.find((item) => item.id === selectedId) ?? items[0];
      return found ? [found] : [];
    }
    return items.slice(0, qty);
  }, [items, mode, qty, selectedId]);

  async function draw(target: HTMLCanvasElement, drawItems: Item[]) {
    const width = 1080;
    const height = format === "story" ? 1920 : 1080;
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

    const pad = format === "story" ? 70 : 54;
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${format === "story" ? 54 : 46}px Arial, sans-serif`;
    ctx.fillText("VAREJÃO POPULAR", pad, pad + 48);
    ctx.font = `700 ${format === "story" ? 34 : 28}px Arial, sans-serif`;
    ctx.fillText(campaign.theme || "OFERTAS", pad, pad + 94);
    ctx.font = `400 ${format === "story" ? 24 : 20}px Arial, sans-serif`;
    const dates = `${campaign.start_date ? `De ${dateLabel(campaign.start_date)}` : ""}${campaign.end_date ? ` até ${dateLabel(campaign.end_date)}` : ""}`;
    if (dates.trim()) ctx.fillText(dates, pad, pad + 132);

    const headerH = format === "story" ? 210 : 170;
    const footerH = format === "story" ? 92 : 70;
    const contentTop = pad + headerH;
    const contentBottom = height - pad - footerH;
    const gap = format === "story" ? 28 : 22;
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
          const image = await loadImage(`/api/product-image/${encodeURIComponent(item.product_id)}`);
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
      ctx.font = `900 ${drawItems.length === 4 ? 28 : format === "story" ? 40 : 36}px Arial, sans-serif`;
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
      ctx.font = `950 ${drawItems.length === 4 ? 48 : format === "story" ? 76 : 66}px Arial, sans-serif`;
      ctx.fillText(money(highlighted), x + inner, priceY);
    }

    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = `400 ${format === "story" ? 20 : 17}px Arial, sans-serif`;
    ctx.fillText("Ofertas válidas enquanto durarem os estoques.", pad, height - pad);
  }

  useEffect(() => {
    if (!canvasRef.current || !selectedItems.length) return;
    draw(canvasRef.current, selectedItems).catch(() => setStatus("Não foi possível desenhar a prévia."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, mode, qty, selectedId, items]);

  async function saveBlob(blob: Blob, drawItems: Item[], saveMode: Mode) {
    const form = new FormData();
    const label = saveMode === "individual" ? drawItems[0]?.name_snapshot || "produto" : `${drawItems.length}-produtos`;
    const filename = `${slug(campaign.name)}-${slug(label)}-${format}.png`;
    form.append("file", new File([blob], filename, { type: "image/png" }));
    form.append("campaign_id", campaign.id);
    form.append("format", format);
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
    setStatus(null);
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
    setStatus(null);
    try {
      await draw(canvasRef.current, selectedItems);
      const blob = await canvasBlob(canvasRef.current);
      await saveBlob(blob, selectedItems, mode);
      setStatus("Material salvo em digital-materials.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao salvar material.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAllIndividual() {
    if (!items.length) return;
    setBusy(true);
    setStatus(`Gerando 0 de ${items.length}...`);
    try {
      const offscreen = document.createElement("canvas");
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setStatus(`Gerando ${i + 1} de ${items.length}: ${item.name_snapshot || "Produto"}`);
        await draw(offscreen, [item]);
        const blob = await canvasBlob(offscreen);
        await saveBlob(blob, [item], "individual");
      }
      setStatus(`${items.length} arte(s) individual(is) salvas em digital-materials.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gerar o lote individual.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid" style={{ alignItems: "start" }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Configuração</h2>
        <div className="form">
          <label className="field">
            <span>Formato</span>
            <select className="input" value={format} onChange={(event) => setFormat(event.target.value as Format)} disabled={busy}>
              <option value="feed">Feed · 1080 × 1080</option>
              <option value="story">Story · 1080 × 1920</option>
            </select>
          </label>

          <label className="field">
            <span>Modo de geração</span>
            <select className="input" value={mode} onChange={(event) => setMode(event.target.value as Mode)} disabled={busy}>
              <option value="composed">Peça composta</option>
              <option value="individual">Arte individual por produto</option>
            </select>
          </label>

          {mode === "composed" ? (
            <label className="field">
              <span>Produtos por peça</span>
              <select className="input" value={String(qty)} onChange={(event) => setQty(Number(event.target.value) as Quantity)} disabled={busy}>
                <option value="1">1 produto</option>
                <option value="2">2 produtos</option>
                <option value="4">4 produtos</option>
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Produto da prévia</span>
              <select className="input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={busy}>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name_snapshot || "Produto"}</option>)}
              </select>
            </label>
          )}

          <button className="btn primary" type="button" onClick={downloadCurrent} disabled={busy || !selectedItems.length}>Baixar PNG desta prévia</button>
          <button className="btn" type="button" onClick={saveCurrent} disabled={busy || !selectedItems.length}>Salvar esta prévia</button>
          {mode === "individual" && (
            <button className="btn" type="button" onClick={saveAllIndividual} disabled={busy || !items.length}>Gerar e salvar arte para todos os itens</button>
          )}
        </div>

        <div className="card" style={{ padding: 12, marginTop: 14 }}>
          <strong>Saída</strong>
          <div className="muted" style={{ marginTop: 6 }}>O PNG é gerado exatamente em 1080×1080 ou 1080×1920 e pode ser baixado ou salvo no bucket privado digital-materials.</div>
        </div>
        {status && <div className={status.toLowerCase().includes("falha") ? "error" : "muted"} style={{ marginTop: 12 }}>{status}</div>}
      </section>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Prévia</h2>
            <div className="muted">{format === "story" ? "Story 1080 × 1920" : "Feed 1080 × 1080"} · {mode === "individual" ? "1 arte por produto" : `${selectedItems.length} produto(s)`}</div>
          </div>
        </div>

        {!selectedItems.length ? (
          <div className="empty">Adicione produtos à campanha antes de gerar uma arte.</div>
        ) : (
          <div style={{ width: "100%", maxWidth: format === "story" ? 430 : 620, margin: "0 auto" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "auto", borderRadius: 18, boxShadow: "0 18px 50px rgba(15,23,42,.18)", display: "block" }} />
          </div>
        )}
      </section>
    </div>
  );
}
