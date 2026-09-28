"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

export function CampaignItemsSpacing({children}:{children:ReactNode}) {
  const [spacing,setSpacing]=useState(10);
  return <div style={{"--campaign-column-gap":spacing+"px"} as CSSProperties}>
    <div className="no-print campaign-column-spacing">
      <label className="field">
        <span>Espaçamento entre colunas · {spacing}px</span>
        <input className="input" type="range" min="2" max="24" step="1" value={spacing} onChange={e=>setSpacing(Number(e.target.value))}/>
      </label>
    </div>
    {children}
  </div>;
}
