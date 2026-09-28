"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

const columns=[
  ["order","Ordem",85,60,150],["ean","EAN",150,100,240],["product","Produto",280,180,520],["image","Imagem",145,110,260],
  ["normal","Preço normal",150,110,240],["offer","Preço oferta",150,110,240],["highlight","Destaque",140,110,220],["actions","Ações",190,150,300],
] as const;

export function CampaignItemsSpacing({children}:{children:ReactNode}) {
  const [widths,setWidths]=useState<Record<string,number>>(()=>Object.fromEntries(columns.map(([id,,value])=>[id,value])));
  const style=Object.fromEntries(columns.map(([id])=>[`--campaign-col-${id}`,`${widths[id]}px`])) as CSSProperties;
  return <div style={style}>
    <details className="no-print campaign-column-resizer">
      <summary>Ajustar largura das colunas</summary>
      <div className="campaign-column-resizer-grid">
        {columns.map(([id,label,,min,max])=><label className="field" key={id}><span>{label} · {widths[id]}px</span><input type="range" min={min} max={max} step="5" value={widths[id]} onChange={e=>setWidths(old=>({...old,[id]:Number(e.target.value)}))}/></label>)}
      </div>
    </details>
    {children}
  </div>;
}
