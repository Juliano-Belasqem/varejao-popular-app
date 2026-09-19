"use client";
import { useMemo, useState } from "react";
import { ConfiguredTicket } from "@/components/configured-ticket";
import { TemplateEditor } from "@/components/template-editor";
import { useBrandKit } from "@/lib/brand-kit/client";
import { useTemplate } from "@/lib/use-template";

type Campaign={id:string;name:string;start_date:string|null;end_date:string|null;theme:string|null};
type Item={id:string;product_id:string|null;normal_price:number|string|null;offer_price:number|string|null;highlighted_price:string|null;ean_snapshot:string|null;name_snapshot:string|null;brand_snapshot:string|null;specification_snapshot:string|null;sort_order:number|null};
function priceParts(value:number|string|null){const n=Number(value??0);const [major,minor]=Number.isFinite(n)?n.toFixed(2).split("."):["0","00"];return{major,minor}}
function dateLabel(v:string|null){if(!v)return "__/__/__";const [y,m,d]=v.split("-");return y&&m&&d?`${d}/${m}/${y.slice(-2)}`:v}
function Barcode({code}:{code:string}){return <div style={{fontSize:"clamp(8px,1.8cqw,18px)",letterSpacing:1,textAlign:"center"}}>{code||"EAN/GTIN"}</div>}

export function CampaignPhysicalGenerator({campaign,items}:{campaign:Campaign;items:Item[]}){
 const template=useTemplate("validity"); const {logoUrl,fieldFonts,ready}=useBrandKit("validity");
 const [mode,setMode]=useState<1|4>(4); const [selected,setSelected]=useState<string[]>(()=>items.slice(0,4).map(x=>x.id));
 const shown=useMemo(()=>selected.map(id=>items.find(x=>x.id===id)).filter((x):x is Item=>!!x).slice(0,mode),[selected,items,mode]);
 function choose(slot:number,id:string){setSelected(old=>{const n=[...old];n[slot]=id;return n})}
 return <>
  {template.error&&<div className="error no-print">{template.error}</div>}
  <TemplateEditor config={template.config} onChange={template.setConfig} onSaved={template.reload} canEdit={template.canEdit} ready={template.ready} title="Template Mestre · Material físico"/>
  <section className="card no-print" style={{marginBottom:18}}>
   <div className="section-title-row"><div><small className="eyebrow">MATERIAL FÍSICO DA CAMPANHA</small><h2>Folha A4</h2></div><button className="btn primary" disabled={!template.ready||!ready||!shown.length} onClick={()=>window.print()}>Imprimir / salvar PDF</button></div>
   <div className="form-grid compact" style={{marginTop:14}}><label className="field"><span>Formato da folha</span><select className="input" value={mode} onChange={e=>{const m=Number(e.target.value) as 1|4;setMode(m);setSelected(old=>[...old,...items.map(x=>x.id).filter(id=>!old.includes(id))].slice(0,m))}}><option value="1">1 produto · folha inteira</option><option value="4">4 produtos · uma folha</option></select></label></div>
   <div className="validity-editor-grid" style={{marginTop:14}}>{Array.from({length:mode},(_,i)=><label className="field" key={i}><span>Produto {i+1}</span><select className="input" value={selected[i]??""} onChange={e=>choose(i,e.target.value)}><option value="">Selecione</option>{items.map(x=><option key={x.id} value={x.id}>{x.name_snapshot||"Produto"}{x.brand_snapshot?` · ${x.brand_snapshot}`:""}</option>)}</select></label>)}</div>
   <p className="muted">Nome, marca, especificação, preços, EAN e validade são preenchidos automaticamente com os dados da campanha. O layout usa o mesmo Template Mestre do material de validade.</p>
  </section>
  {!shown.length?<div className="empty">Adicione produtos à campanha para gerar o material físico.</div>:<div className="validity-sheet-wrap"><div className="validity-sheet" style={mode===1?{gridTemplateColumns:"1fr",gridTemplateRows:"1fr",padding:24}:{}}>
   {shown.map(item=>{const highlighted=item.highlighted_price==="normal"?item.normal_price:(item.offer_price??item.normal_price);const p=priceParts(highlighted);return <ConfiguredTicket key={item.id} config={template.config} fonts={fieldFonts} logoUrl={logoUrl} values={{
    title:(campaign.theme||"OFERTA").toUpperCase(),product:(item.name_snapshot||"PRODUTO").toUpperCase(),brand:(item.brand_snapshot||"MARCA").toUpperCase(),specification:(item.specification_snapshot||"").toUpperCase(),validity:`VALIDADE ${dateLabel(campaign.end_date)}`,
    price:<div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",height:"100%",lineHeight:.9}}><small style={{fontSize:".2em",marginTop:".15em",color:"#c7192b"}}>R$</small><strong style={{fontSize:"1em"}}>{p.major}</strong><span style={{fontSize:".4em"}}>,{p.minor}<small style={{display:"block",fontSize:".55em",color:"#c7192b"}}>UN</small></span></div>,
    normalPrice:item.normal_price==null?"0,00":Number(item.normal_price).toFixed(2).replace(".",","),code:<Barcode code={item.ean_snapshot||""}/>,footer:campaign.end_date?`Oferta válida até ${dateLabel(campaign.end_date)}`:"Oferta válida enquanto durarem os estoques"
   }}/>})}
  </div></div>}
 </>;
}