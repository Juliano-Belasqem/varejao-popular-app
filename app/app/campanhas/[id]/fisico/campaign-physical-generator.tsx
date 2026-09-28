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
function validEan13(code:string){const digits=code.replace(/\D/g,"");if(digits.length!==13)return null;const sum=digits.slice(0,12).split("").reduce((acc,d,i)=>acc+Number(d)*(i%2===0?1:3),0);return (10-(sum%10))%10===Number(digits[12])?digits:null}
function eanBars(code:string){const d=validEan13(code);if(!d)return null;const L=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"],G=["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"],R=["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"],P=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL"];let bits="101";for(let i=1;i<=6;i++)bits+=(P[Number(d[0])][i-1]==="L"?L:G)[Number(d[i])];bits+="01010";for(let i=7;i<=12;i++)bits+=R[Number(d[i])];return bits+"101"}
function Barcode({code,scale,stretch}:{code:string;scale:number;stretch:number}){const bits=eanBars(code);const digits=validEan13(code);if(!bits||!digits)return <div className="barcode-fallback">{code||"EAN-13 inválido"}</div>;return <div style={{background:"#fff",padding:"2% 4%",transform:`scale(${scale})`,transformOrigin:"center"}}><svg className="barcode-svg" style={{height:"1.15em",minHeight:32,width:`${stretch*100}%`,maxWidth:"none",marginLeft:`${(1-stretch)*50}%`}} viewBox="0 0 113 60" preserveAspectRatio="none" shapeRendering="crispEdges"><rect width="113" height="60" fill="#fff"/>{bits.split("").map((b,i)=>b==="1"?<rect key={i} x={11+i} y="2" width="1" height={(i<3||(i>=45&&i<50)||i>=92)?46:41} fill="#000"/>:null)}</svg><div className="barcode-number">{digits}</div></div>}

export function CampaignPhysicalGenerator({campaign,items}:{campaign:Campaign;items:Item[]}){
 const templateOne=useTemplate("physical-one");
 const templateFour=useTemplate("physical-four");
 const {logoUrl,fieldFonts,ready}=useBrandKit("validity");
 const [mode,setMode]=useState<1|4>(4),[printCount,setPrintCount]=useState(4);
 const [selected,setSelected]=useState<string[]>(()=>items.slice(0,4).map(x=>x.id));
 const [priceScale,setPriceScale]=useState(1),[barcodeScale,setBarcodeScale]=useState(1),[barcodeStretch,setBarcodeStretch]=useState(1);
 const template=mode===1?templateOne:templateFour;
 const shown=useMemo(()=>selected.map(id=>items.find(x=>x.id===id)).filter((x):x is Item=>!!x).slice(0,mode===1?1:printCount),[selected,items,mode,printCount]);
 function choose(slot:number,id:string){setSelected(old=>{const n=[...old];n[slot]=id;return n})}
 function price(item:Item){const highlighted=item.highlighted_price==="normal"?item.normal_price:(item.offer_price??item.normal_price);const p=priceParts(highlighted);const auto=(p.major.length<=1?1.22:p.major.length===2?.76:p.major.length===3?.68:.58)*priceScale;return <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",height:"100%",lineHeight:.9,transform:`scale(${auto})`,transformOrigin:"center"}}><small style={{fontSize:".2em",marginTop:".15em"}}>R$</small><strong>{p.major}</strong><span style={{fontSize:".4em"}}>,{p.minor}<small style={{display:"block",fontSize:".55em"}}>UN</small></span></div>}
 function ticket(item:Item,key:string){return <ConfiguredTicket key={key} config={template.config} fonts={fieldFonts} logoUrl={logoUrl} values={{title:(campaign.theme||"OFERTA").toUpperCase(),product:(item.name_snapshot||"PRODUTO").toUpperCase(),brand:(item.brand_snapshot||"MARCA").toUpperCase(),specification:(item.specification_snapshot||"").toUpperCase(),validity:`VALIDADE ${dateLabel(campaign.end_date)}`,price:price(item),normalPrice:item.normal_price==null?"0,00":Number(item.normal_price).toFixed(2).replace(".",","),code:<Barcode code={item.ean_snapshot||""} scale={barcodeScale} stretch={barcodeStretch}/>,footer:campaign.end_date?`Oferta válida até ${dateLabel(campaign.end_date)}`:"Oferta válida enquanto durarem os estoques"}}/>}
 return <>
  <section className="card no-print" style={{marginBottom:18}}>
   <div className="section-title-row"><div><small className="eyebrow">MATERIAL FÍSICO DA CAMPANHA</small><h2>Folha A4</h2></div><button className="btn primary" disabled={!template.ready||!ready||!shown.length} onClick={()=>window.print()}>Imprimir / salvar PDF</button></div>
   <div className="form-grid compact" style={{marginTop:14}}>
    <label className="field"><span>Formato da folha</span><select className="input" value={mode} onChange={e=>setMode(Number(e.target.value) as 1|4)}><option value="1">1 produto · folha inteira</option><option value="4">4 produtos · uma folha</option></select></label>
    {mode===4&&<label className="field"><span>Quantidade para imprimir</span><select className="input" value={printCount} onChange={e=>setPrintCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>}
    <label className="field"><span>Ajuste do preço · {Math.round(priceScale*100)}%</span><input className="input" type="range" min=".7" max="1.4" step=".05" value={priceScale} onChange={e=>setPriceScale(Number(e.target.value))}/></label>
    <label className="field"><span>Altura do EAN · {Math.round(barcodeScale*100)}%</span><input className="input" type="range" min=".7" max="1.8" step=".05" value={barcodeScale} onChange={e=>setBarcodeScale(Number(e.target.value))}/></label>
    <label className="field"><span>Esticar EAN · {Math.round(barcodeStretch*100)}%</span><input className="input" type="range" min=".8" max="1.8" step=".05" value={barcodeStretch} onChange={e=>setBarcodeStretch(Number(e.target.value))}/></label>
   </div>
   <div className="validity-editor-grid" style={{marginTop:14}}>{Array.from({length:mode===1?1:printCount},(_,i)=><label className="field" key={i}><span>Produto {i+1}</span><select className="input" value={selected[i]??""} onChange={e=>choose(i,e.target.value)}><option value="">Selecione</option>{items.map(x=><option key={x.id} value={x.id}>{x.name_snapshot||"Produto"}{x.brand_snapshot?` · ${x.brand_snapshot}`:""}</option>)}</select></label>)}</div>
  </section>
  {!shown.length?<div className="empty">Adicione produtos à campanha para gerar o material físico.</div>:<div className="validity-sheet-wrap"><div className="validity-sheet" style={mode===1?{gridTemplateColumns:"1fr",gridTemplateRows:"1fr",padding:24}:{}}>{Array.from({length:mode===1?1:4},(_,i)=>shown[i]?ticket(shown[i],shown[i].id):<div key={i}/>)}</div></div>}
  <div className="no-print physical-template-editors" style={{marginTop:18}}>
   <TemplateEditor config={templateOne.config} onChange={templateOne.setConfig} onSaved={templateOne.reload} canEdit={templateOne.canEdit} ready={templateOne.ready} title="Template Mestre · 1 produto · folha inteira"/>
   <TemplateEditor config={templateFour.config} onChange={templateFour.setConfig} onSaved={templateFour.reload} canEdit={templateFour.canEdit} ready={templateFour.ready} title="Template Mestre · 4 produtos · uma folha"/>
  </div>
 </>;
}