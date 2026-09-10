"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawImageContain, drawTemplateBackground } from "@/lib/media/canvas-renderer";
import { currentMediaTemplate, findTemplateVariant, type MediaFormat } from "@/lib/media/templates";

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

function moneyParts(value: number | string | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return { integer: "—", cents: "00" };
  const [integer, cents] = number.toFixed(2).split(".");
  return { integer, cents };
}

function dateLabel(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : value;
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

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar PNG"))), "image/png", 0.96);
  });
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, initial: number, minimum: number, weight = 900) {
  let size = initial;
  while (size > minimum) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
) {
  const size = fitFont(ctx, text, maxWidth, initialSize, Math.max(24, Math.round(initialSize * 0.56)));
  ctx.save();
  ctx.font = `900 ${size}px Arial, sans-serif`;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.strokeText(text, x, y, maxWidth);
  ctx.fillText(text, x, y, maxWidth);
  ctx.restore();
}

function drawPrice(ctx: CanvasRenderingContext2D, value: number | string | null, format: MediaFormat) {
  const { integer, cents } = moneyParts(value);
  const story = format === "story";
  const x = story ? 650 : 625;
  const y = story ? 1518 : 773;
  const integerSize = story ? 158 : 126;
  const centsSize = story ? 66 : 54;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(15,23,42,.26)";
  ctx.lineWidth = story ? 9 : 7;
  ctx.lineJoin = "round";
  ctx.textBaseline = "top";

  ctx.font = `900 ${story ? 38 : 30}px Arial, sans-serif`;
  ctx.strokeText("R$", x, y + (story ? 30 : 22));
  ctx.fillText("R$", x, y + (story ? 30 : 22));

  ctx.font = `950 ${integerSize}px Arial, sans-serif`;
  ctx.strokeText(integer, x + (story ? 55 : 45), y);
  ctx.fillText(integer, x + (story ? 55 : 45), y);

  const integerWidth = ctx.measureText(integer).width;
  const centsX = x + (story ? 65 : 55) + integerWidth;
  ctx.font = `900 ${centsSize}px Arial, sans-serif`;
  ctx.strokeText(`,${cents}`, centsX, y + (story ? 20 : 16));
  ctx.fillText(`,${cents}`, centsX, y + (story ? 20 : 16));

  ctx.font = `900 ${story ? 36 : 30}px Arial, sans-serif`;
  ctx.strokeText("un", centsX + (story ? 18 : 14), y + (story ? 90 : 74));
  ctx.fillText("un", centsX + (story ? 18 : 14), y + (story ? 90 : 74));
  ctx.restore();
}

function footerText(campaign: Campaign) {
  return campaign.end_date
    ? `Ofertas válidas até ${dateLabel(campaign.end_date)} ou enquanto durarem os estoques`
    : "Ofertas válidas enquanto durarem os estoques";
}

export default function OfficialTemplateGenerator({ campaign, items }: { campaign: Campaign; items: Item[] }) {
  const [format, setFormat] = useState<MediaFormat>("feed");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef(new Map<string, Promise<HTMLImageElement>>());

  const item = useMemo(() => items.find((candidate) => candidate.id === itemId) ?? items[0] ?? null, [itemId, items]);
  const variant = useMemo(() => findTemplateVariant(currentMediaTemplate, format, "individual", 1), [format]);

  const loadImage = useCallback((url: string) => {
    const cached = imageCacheRef.current.get(url);
    if (cached) return cached;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => {
        imageCacheRef.current.delete(url);
        reject(new Error(`Falha ao carregar ${url}`));
      };
      image.src = url;
    });
    imageCacheRef.current.set(url, promise);
    return promise;
  }, []);

  const loadMaterials = useCallback(async () => {
    try {
      const response = await fetch(`/api/digital-materials?campaign_id=${encodeURIComponent(campaign.id)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar materiais");
      setMaterials(Array.isArray(payload.materials) ? payload.materials : []);
    } catch {
      setMaterials([]);
    }
  }, [campaign.id]);

  const draw = useCallback(async (target: HTMLCanvasElement) => {
    if (!item || !variant) return;
    target.width = variant.width;
    target.height = variant.height;
    const ctx = target.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");

    await drawTemplateBackground(ctx, variant.width, variant.height, variant.background, loadImage);
    const slot = variant.products[0];

    const category = (item.name_snapshot || "Produto").toUpperCase();
    const brand = (item.brand_snapshot || "").toUpperCase();
    const specification = (item.specification_snapshot || "").toUpperCase();

    outlinedText(ctx, category, slot.name.x, slot.name.y, slot.name.width, slot.name.fontSize, "#ff9b36", "#ffffff", format === "story" ? 8 : 6);
    if (brand && slot.brand) outlinedText(ctx, brand, slot.brand.x, slot.brand.y, slot.brand.width, slot.brand.fontSize, "#ffffff", "#ff8a2a", format === "story" ? 10 : 8);
    if (specification && slot.specification) outlinedText(ctx, specification, slot.specification.x, slot.specification.y, slot.specification.width, slot.specification.fontSize, "#ff9b36", "#ffffff", format === "story" ? 7 : 5);

    if (item.product_id) {
      try {
        const productImage = await loadImage(`/api/product-image/${encodeURIComponent(item.product_id)}`);
        drawImageContain(ctx, productImage, slot.image);
      } catch {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,.9)";
        ctx.font = `700 ${format === "story" ? 34 : 28}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("SEM IMAGEM", slot.image.x + slot.image.width / 2, slot.image.y + slot.image.height / 2);
        ctx.restore();
      }
    }

    const price = item.highlighted_price === "normal" ? item.normal_price : item.offer_price ?? item.normal_price;
    drawPrice(ctx, price, format);

    const footer = footerText(campaign);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${format === "story" ? 33 : 30}px Arial, sans-serif`;
    ctx.lineJoin = "round";
    ctx.lineWidth = format === "story" ? 10 : 8;
    ctx.strokeStyle = "#222222";
    ctx.fillStyle = "#ffffff";
    const footerY = format === "story" ? 1825 : 1018;
    ctx.strokeText(footer, variant.width / 2, footerY, variant.width - 90);
    ctx.fillText(footer, variant.width / 2, footerY, variant.width - 90);
    ctx.restore();
  }, [campaign, format, item, loadImage, variant]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    if (!canvasRef.current || !item) return;
    const frame = requestAnimationFrame(() => {
      if (canvasRef.current) void draw(canvasRef.current).catch(() => setStatus("Não foi possível montar a prévia."));
    });
    return () => cancelAnimationFrame(frame);
  }, [draw, item]);

  async function saveMaterial(download: boolean) {
    if (!canvasRef.current || !item) return;
    setBusy(true);
    setStatus(download ? "Preparando PNG..." : "Salvando material...");
    try {
      await draw(canvasRef.current);
      const blob = await canvasBlob(canvasRef.current);
      const filename = `${slug(campaign.name)}-${slug(item.name_snapshot || "produto")}-${format}.png`;

      if (download) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setStatus("PNG gerado.");
        return;
      }

      const form = new FormData();
      form.append("file", new File([blob], filename, { type: "image/png" }));
      form.append("campaign_id", campaign.id);
      form.append("format", format);
      form.append("mode", "individual");
      form.append("item_ids", JSON.stringify([item.id]));
      const response = await fetch("/api/digital-materials", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao salvar material");
      await loadMaterials();
      setStatus("Material salvo no sistema.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao gerar material.");
    } finally {
      setBusy(false);
    }
  }

  async function createDraft(material: SavedMaterial, network: "instagram" | "facebook") {
    setBusy(true);
    setStatus("Criando rascunho...");
    try {
      const response = await fetch("/api/publication-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaign.id, material_path: material.path, network, type: format, caption: campaign.name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Falha ao criar rascunho");
      setStatus("Rascunho criado com sucesso.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha ao criar rascunho.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginBottom: 18 }}>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>Template oficial · Super Ofertas</h2>
          <div className="muted" style={{ marginTop: 5 }}>Feed e Story com o layout aprovado do Varejão Popular.</div>
        </div>
        <span className="pill">1 produto</span>
      </div>

      <div className="grid" style={{ alignItems: "start" }}>
        <div className="form">
          <label className="field">
            <span>Formato</span>
            <select className="input" value={format} onChange={(event) => setFormat(event.target.value as MediaFormat)} disabled={busy}>
              <option value="feed">Feed · 1080 × 1080</option>
              <option value="story">Story · 1080 × 1920</option>
            </select>
          </label>

          <label className="field">
            <span>Produto</span>
            <select className="input" value={item?.id ?? ""} onChange={(event) => setItemId(event.target.value)} disabled={busy || !items.length}>
              {items.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name_snapshot || "Produto"}</option>)}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button className="btn primary" type="button" disabled={busy || !item} onClick={() => void saveMaterial(false)}>Salvar no sistema</button>
            <button className="btn" type="button" disabled={busy || !item} onClick={() => void saveMaterial(true)}>Baixar PNG</button>
          </div>

          {status ? <div className={status.toLowerCase().includes("falha") ? "error" : "muted"}>{status}</div> : null}

          {materials.length ? (
            <div className="card" style={{ padding: 12 }}>
              <strong>Materiais recentes</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {materials.slice(0, 3).map((material) => (
                  <div key={material.path} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <div className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{material.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
                      <button className="btn" type="button" disabled={busy} onClick={() => void createDraft(material, "instagram")}>Instagram</button>
                      <button className="btn" type="button" disabled={busy} onClick={() => void createDraft(material, "facebook")}>Facebook</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div>
          {!item ? (
            <div className="empty">Adicione produtos à campanha para gerar uma arte.</div>
          ) : (
            <div style={{ width: "100%", maxWidth: format === "story" ? 430 : 620, margin: "0 auto" }}>
              <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block", borderRadius: 14, boxShadow: "0 18px 50px rgba(15,23,42,.16)" }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
