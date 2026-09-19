"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawImageContain, drawTemplateBackground } from "@/lib/media/canvas-renderer";
import { currentMediaTemplate, findTemplateVariant, type MediaFormat } from "@/lib/media/templates";
import { useTemplate } from "@/lib/use-template";
import type { TemplateConfig } from "@/lib/template-config";
import { TemplateEditor } from "@/components/template-editor";
import { useBrandKit } from "@/lib/brand-kit/client";

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

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initial: number,
  minimum: number,
  family: string,
  weight = 900,
) {
  let size = initial;
  while (size > minimum) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function splitProductName(value: string) {
  const words = value.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines = ["", "", ""];
  for (const word of words) {
    let target = 0;
    for (let i = 1; i < lines.length; i++) if (lines[i].length < lines[target].length) target = i;
    lines[target] = `${lines[target]} ${word}`.trim();
  }
  return lines;
}

function footerText(campaign: Campaign) {
  return campaign.end_date
    ? `Ofertas válidas até ${dateLabel(campaign.end_date)} ou enquanto durarem os estoques`
    : "Ofertas válidas enquanto durarem os estoques";
}

export default function OfficialTemplateGenerator({ campaign, items }: { campaign: Campaign; items: Item[] }) {
  const { logoUrl, fieldFonts, ready:brandReady, accentColor } = useBrandKit("campaign");
  const [format, setFormat] = useState<MediaFormat>("feed");
  const template=useTemplate(format==="story"?"digital-story":"digital-feed");
  const [artConfig, setArtConfig] = useState<TemplateConfig>(template.config);
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [manualProductName, setManualProductName] = useState(false);
  const [productLines, setProductLines] = useState<[string,string,string]>(["","",""]);
  const [unitLabel, setUnitLabel] = useState("UN");
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef(new Map<string, Promise<HTMLImageElement>>());

  useEffect(() => { if (template.ready) setArtConfig(structuredClone(template.config)); }, [template.ready, template.config.id, template.config.revision]);

  const item = useMemo(() => items.find((candidate) => candidate.id === itemId) ?? items[0] ?? null, [itemId, items]);
  const variant = useMemo(() => findTemplateVariant(currentMediaTemplate, format, "individual", 1), [format]);
  useEffect(() => { if (!manualProductName && item) setProductLines(splitProductName(item.name_snapshot || "Produto") as [string,string,string]); }, [item, manualProductName]);

  const loadImage = useCallback((url: string) => {
    const cached = imageCacheRef.current.get(url);
    if (cached) return cached;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.crossOrigin = "anonymous";
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

    await document.fonts.ready;
    await drawTemplateBackground(ctx, variant.width, variant.height, artConfig.backgroundUrl?{kind:"image",value:artConfig.backgroundUrl}:variant.background, loadImage);
    for(const [key,field] of Object.entries(artConfig.layout).sort(([,a],[,b])=>(a.layer??1)-(b.layer??1))){
      if(!field.visible)continue;
      const rect={x:field.x*variant.width/100,y:field.y*variant.height/100,width:field.width*variant.width/100,height:field.height*variant.height/100};
      if(key==="image"||key==="logo"){
        const url=key==="logo"?logoUrl:item.product_id?`/api/product-image/${encodeURIComponent(item.product_id)}`:null;
        if(url){try{drawImageContain(ctx,await loadImage(url),rect)}catch{if(key==="image"){ctx.fillStyle="#555";ctx.font="24px Arial";ctx.fillText("Imagem indisponível",rect.x,rect.y+rect.height/2)}}}
        continue;
      }
      const price=item.highlighted_price==="normal"?item.normal_price:item.offer_price??item.normal_price;
      const [priceReais, priceCents] = Number(price ?? 0).toFixed(2).split(".");
      const values:Record<string,string>={productLine1:productLines[0],productLine2:productLines[1],productLine3:productLines[2],currency:"R$",unit:unitLabel,brand:(item.brand_snapshot||"").toUpperCase(),specification:(item.specification_snapshot||"").toUpperCase(),priceReais,priceCents,footer:footerText(campaign)};
      ctx.save();
      ctx.globalAlpha=field.opacity??1;
      const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
      ctx.translate(cx,cy);ctx.rotate(((field.rotation??0)*Math.PI)/180);ctx.translate(-cx,-cy);
      ctx.beginPath();ctx.rect(rect.x,rect.y,rect.width,rect.height);ctx.clip();
      const family=fieldFonts[key]||fieldFonts.body;
      const size=fitFont(ctx,values[key]||"",rect.width,field.fontSize*variant.width/1000,12,family,field.weight);
      ctx.font=`${field.weight} ${size}px ${family}`;ctx.textBaseline="top";ctx.textAlign=field.align;
      ctx.fillStyle=field.color==="#ff9b36"?accentColor:field.color;
      ctx.strokeStyle=field.strokeColor??"#000000";ctx.lineWidth=field.strokeWidth??0;
      ctx.shadowColor=field.shadowColor??"transparent";ctx.shadowBlur=field.shadowBlur??0;ctx.shadowOffsetX=field.shadowX??0;ctx.shadowOffsetY=field.shadowY??0;
      const x=rect.x+(field.align==="center"?rect.width/2:field.align==="right"?rect.width:0);
      if((field.strokeWidth??0)>0)ctx.strokeText(values[key]||"",x,rect.y,rect.width);
      ctx.fillText(values[key]||"",x,rect.y,rect.width);ctx.restore();
    }

  }, [campaign, fieldFonts, format, item, loadImage, logoUrl, variant, artConfig, accentColor]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    if (!canvasRef.current || !item || !brandReady || !template.ready) return;
    let cancelled=false;
    const frame = requestAnimationFrame(() => {
      const target=document.createElement("canvas");
      void draw(target).then(()=>{if(!cancelled&&canvasRef.current){canvasRef.current.width=target.width;canvasRef.current.height=target.height;canvasRef.current.getContext("2d")?.drawImage(target,0,0)}}).catch(()=>{if(!cancelled)setStatus("Não foi possível montar a prévia.")});
    });
    return () => {cancelled=true;cancelAnimationFrame(frame)};
  }, [draw, item, brandReady, template.ready]);

  async function saveMaterial(download: boolean) {
    if (!canvasRef.current || !item || !brandReady || !template.ready) return;
    setBusy(true);
    setStatus(download ? "Preparando PNG..." : "Salvando material...");
    try {
      const output=document.createElement("canvas");
      await draw(output);
      const blob = await canvasBlob(output);
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
        body: JSON.stringify({ campaign_id: campaign.id, material_path: material.path, network, type: material.name.includes("story")?"story":"feed", caption: campaign.name }),
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
          <div className="muted" style={{ marginTop: 5 }}>Feed e Story com logo e tipografia definidos no Kit da Marca.</div>
        </div>
        <span className="pill">1 produto</span>
      </div>

      {template.error&&<p className="error">{template.error}</p>}
      <div className="card" style={{ marginBottom: 16, padding: 12 }}>
        <strong>Personalização desta arte</strong>
        <p className="muted" style={{ marginBottom: 10 }}>Ajustes feitos aqui afetam somente a arte atual. O Template Mestre não é alterado.</p>
        <button className="btn" type="button" onClick={() => setArtConfig(structuredClone(template.config))} disabled={!template.ready}>Restaurar do Template Mestre</button>
      </div>
      <TemplateEditor key={`art-${artConfig.id}`} config={artConfig} onChange={setArtConfig} onSaved={async()=>{}} canEdit={true} ready={template.ready} persist={false}/>
      <TemplateEditor key={`master-${template.config.id}`} config={template.config} onChange={template.setConfig} onSaved={template.reload} canEdit={template.canEdit} ready={template.ready} title="Template Mestre"/>
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

          <div className="card" style={{ padding: 12, display: "grid", gap: 8 }}>
            <label><input type="checkbox" checked={manualProductName} onChange={(e)=>setManualProductName(e.target.checked)} /> Dividir nome manualmente</label>
            {productLines.map((line,index)=><input key={index} className="input" value={line} disabled={!manualProductName} onChange={(e)=>setProductLines(old=>old.map((v,i)=>i===index?e.target.value:v) as [string,string,string])} placeholder={`Produto · linha ${index+1}`} />)}
            <label className="field"><span>Unidade</span><input className="input" value={unitLabel} onChange={(e)=>setUnitLabel(e.target.value.toUpperCase().slice(0,8))} /></label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button className="btn primary" type="button" disabled={busy || !item || !brandReady || !template.ready} onClick={() => void saveMaterial(false)}>Salvar no sistema</button>
            <button className="btn" type="button" disabled={busy || !item || !brandReady || !template.ready} onClick={() => void saveMaterial(true)}>Baixar PNG</button>
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
