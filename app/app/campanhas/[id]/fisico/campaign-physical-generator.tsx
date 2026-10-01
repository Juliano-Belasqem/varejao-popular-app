"use client";
import { useMemo, useState } from "react";
import { ConfiguredTicket } from "@/components/configured-ticket";
import { TemplateEditor } from "@/components/template-editor";
import { useBrandKit } from "@/lib/brand-kit/client";
import { useTemplate } from "@/lib/use-template";

type Campaign={id:string;name:string;start_date:string|null;end_date:string|null;theme:string|null};
type Item={id:string;product_id:string|null;normal_price:number|string|null;offer_price:number|string|null;highlighted_price:string|null;ean_snapshot:string|null;name_snapshot:string|null;brand_snapshot:string|null;specification_snapshot:string|null;sort_order:number|null;display_name:string|null;full_name:string|null;product_brand:string|null;product_specification:string|null};
type Draft={itemId:string;product:string;brand:string;specification:string;normalPrice:string;offerPrice:string;validity:string;ean:string;unit:string;barcodeWidth:number;barcodeHeight:number};

function splitProduct(item:Item|undefined){
 if(!item)return{product:"",brand:"",specification:""};
 const full=(item.display_name?.trim()||item.full_name?.trim()||item.name_snapshot||"").trim();
 let product=full;
 const brand=(item.product_brand||item.brand_snapshot||"").trim();
 let specification=(item.product_specification||item.specification_snapshot||"").trim();
 const match=product.match(/(?:\s|^)((?:\d+(?:[.,]\d+)?\s*)?(?:KG|G|MG|L|ML|UN|UND|UNID|UNIDADES|PACOTE|PCT|CX|CAIXA|LT|LITROS?|GR|GRAMAS?))\s*$/i);
 if(match){
  if(!specification)specification=match[1].trim();
  product=product.slice(0,match.index).trim();
 }
 for(const part of [brand,specification]){
  if(!part)continue;
  const pos=product.toLocaleLowerCase("pt-BR").indexOf(part.toLocaleLowerCase("pt-BR"));
  if(pos>=0)product=(product.slice(0,pos)+" "+product.slice(pos+part.length)).replace(/\s+/g," ").trim();
 }
 return{product:product||full,brand,specification};
}
function moneyInput(value:number|string|null){
 if(value==null||value==="")return"";
 const n=Number(value);
 return Number.isFinite(n)?n.toFixed(2).replace(".",","):String(value);
}
function draftFrom(item:Item|undefined,campaign:Campaign):Draft{const split=splitProduct(item);return{itemId:item?.id??"",product:split.product,brand:split.brand,specification:split.specification,normalPrice:moneyInput(item?.normal_price??null),offerPrice:moneyInput(item?.offer_price??item?.normal_price??null),validity:campaign.end_date??"",ean:item?.ean_snapshot??"",unit:"UN",barcodeWidth:100,barcodeHeight:100}}
function priceParts(value:string){const clean=value.replace(/[^0-9,]/g,"");const[a="0",b="00"]=clean.split(",");return{major:a||"0",minor:(b+"00").slice(0,2)}}
function majorPriceScale(major:string){const digits=major.replace(/\D/g,"").length;return digits<=1?1:digits===2?.78:digits===3?.62:.5}
function PhysicalPrice({major,minor,scale}:{major:string;minor:string;scale:number}){return <span className="physical-responsive-price" style={{fontSize:(scale*100)+"%"}}><strong>{major}</strong><span className="physical-responsive-cents">,{minor}</span></span>}
function dateLabel(v:string|null){if(!v)return"__/__/__";const[y,m,d]=v.split("-");return y&&m&&d?`${d}/${m}/${y.slice(-2)}`:v}
function validEan13(code:string){const digits=code.replace(/\D/g,"");if(digits.length!==13)return null;const sum=digits.slice(0,12).split("").reduce((acc,d,i)=>acc+Number(d)*(i%2===0?1:3),0);return(10-(sum%10))%10===Number(digits[12])?digits:null}
function eanBars(code:string){const d=validEan13(code);if(!d)return null;const L=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"],G=["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"],R=["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"],P=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];let bits="101";for(let i=1;i<=6;i++)bits+=(P[Number(d[0])][i-1]==="L"?L:G)[Number(d[i])];bits+="01010";for(let i=7;i<=12;i++)bits+=R[Number(d[i])];return bits+"101"}
function Barcode({code,width,height}:{code:string;width:number;height:number}){const bits=eanBars(code),digits=validEan13(code);if(!bits||!digits)return <div className="barcode-fallback">{code||"EAN-13 inválido"}</div>;return <div className="physical-barcode"><svg className="barcode-svg" style={{width:`${width}%`,height:`${height}%`}} viewBox="0 0 113 60" preserveAspectRatio="none" shapeRendering="crispEdges"><rect width="113" height="60" fill="#fff"/>{bits.split("").map((b,i)=>b==="1"?<rect key={i} x={11+i} y="2" width="1" height={(i<3||(i>=45&&i<50)||i>=92)?46:41} fill="#000"/>:null)}</svg><div className="barcode-number">{digits}</div></div>}

export function CampaignPhysicalGenerator({campaign,items}:{campaign:Campaign;items:Item[]}){
 const templateOne=useTemplate("physical-one"),templateFour=useTemplate("physical-four");
 const {logoUrl,fieldFonts,ready}=useBrandKit("validity");
 const [mode,setMode]=useState<1|4>(4),[printCount,setPrintCount]=useState(4);
 const [drafts,setDrafts]=useState<Draft[]>(()=>Array.from({length:4},(_,i)=>draftFrom(items[i],campaign)));

 const template=mode===1?templateOne:templateFour;
 const activeCount=mode===1?1:printCount;
 const active=drafts.slice(0,activeCount);
 const options=useMemo(()=>items.map(item=>({id:item.id,label:[item.display_name||item.full_name||item.name_snapshot].filter(Boolean).join(" · ")})),[items]);
 function patch(slot:number,values:Partial<Draft>){setDrafts(old=>old.map((draft,i)=>i===slot?{...draft,...values}:draft))}
 function choose(slot:number,id:string){const item=items.find(x=>x.id===id);setDrafts(old=>old.map((draft,i)=>i===slot?draftFrom(item,campaign):draft))}
 function restore(slot:number){const id=drafts[slot]?.itemId;choose(slot,id)}
 function clear(slot:number){setDrafts(old=>old.map((draft,i)=>i===slot?draftFrom(undefined,campaign):draft))}
 function duplicate(slot:number){if(slot>=3)return;setDrafts(old=>old.map((draft,i)=>i===slot+1?{...old[slot]}:draft));if(mode===4&&printCount<slot+2)setPrintCount(slot+2)}
 function ticket(draft:Draft,key:string){const p=priceParts(draft.offerPrice);return <ConfiguredTicket key={key} config={template.config} fonts={fieldFonts} logoUrl={logoUrl} values={{title:(campaign.theme||"OFERTA").toUpperCase(),product:(draft.product||"PRODUTO").toUpperCase(),brand:(draft.brand||"MARCA").toUpperCase(),specification:(draft.specification||"").toUpperCase(),validity:`VALIDADE ${dateLabel(draft.validity)}`,physicalCurrency:"R$",physicalPriceReais:<PhysicalPrice major={p.major} minor={p.minor} scale={majorPriceScale(p.major)}/>,physicalPriceCents:null,physicalUnit:draft.unit||"UN",normalPrice:draft.normalPrice||"0,00",code:<Barcode code={draft.ean} width={draft.barcodeWidth} height={draft.barcodeHeight}/>,footer:draft.validity?`Oferta válida até ${dateLabel(draft.validity)}`:"Oferta válida enquanto durarem os estoques"}}/>}
 return <>
  <section className="card no-print" style={{marginBottom:18}}>
   <div className="section-title-row"><div><small className="eyebrow">MATERIAL FÍSICO DA CAMPANHA</small><h2>{mode===1?"1 produto · folha inteira":`${printCount} ${printCount===1?"produto":"produtos"} · 1/4 de folha`}</h2></div><button className="btn primary" disabled={!template.ready||!ready||!active.some(x=>x.itemId||x.product)} onClick={()=>window.print()}>Imprimir / salvar PDF</button></div>
   <p className="muted">Os campos são preenchidos automaticamente com os dados da campanha. Você pode alterar qualquer informação somente para esta impressão.</p>
   <div className="form-grid compact" style={{marginTop:14}}>
    <label className="field"><span>Formato da folha</span><select className="input" value={mode} onChange={e=>setMode(Number(e.target.value) as 1|4)}><option value="1">1 produto · folha inteira</option><option value="4">1/4 de folha · até 4 produtos</option></select></label>
    {mode===4&&<label className="field"><span>Quantidade para imprimir</span><select className="input" value={printCount} onChange={e=>setPrintCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?"produto":"produtos"}</option>)}</select></label>}
   </div>
   <div className="physical-item-editors" style={{marginTop:14}}>{active.map((draft,i)=><details className="validity-editor physical-item-editor" key={i} open={i===0}><summary><strong>Peça {i+1}</strong><span className="muted">{[draft.product,draft.brand,draft.specification].filter(Boolean).join(" · ")||"Sem produto"}</span></summary>
    <label className="field"><span>Produto da campanha</span><select className="input" value={draft.itemId} onChange={e=>choose(i,e.target.value)}><option value="">Preencher manualmente</option>{options.map(o=><option key={o.id} value={o.id}>{o.label||"Produto"}</option>)}</select></label>
    <div className="form-grid compact">
     <label className="field"><span>Produto</span><input className="input" value={draft.product} onChange={e=>patch(i,{product:e.target.value})}/></label>
     <label className="field"><span>Marca</span><input className="input" value={draft.brand} onChange={e=>patch(i,{brand:e.target.value})}/></label>
     <label className="field"><span>Especificação</span><input className="input" value={draft.specification} onChange={e=>patch(i,{specification:e.target.value})}/></label>
     <label className="field"><span>Validade</span><input className="input" type="date" value={draft.validity} onChange={e=>patch(i,{validity:e.target.value})}/></label>
     <label className="field"><span>Preço normal</span><input className="input" inputMode="decimal" value={draft.normalPrice} onChange={e=>patch(i,{normalPrice:e.target.value})}/></label>
     <label className="field"><span>Preço oferta</span><input className="input" inputMode="decimal" value={draft.offerPrice} onChange={e=>patch(i,{offerPrice:e.target.value})}/></label>
     <label className="field"><span>Código de barras</span><input className="input" inputMode="numeric" value={draft.ean} onChange={e=>patch(i,{ean:e.target.value})}/></label>
     <label className="field"><span>Unidade</span><input className="input" value={draft.unit} onChange={e=>patch(i,{unit:e.target.value})}/></label>
    </div>
    {draft.ean&&!validEan13(draft.ean)&&<div className="error">EAN inválido. Informe um EAN-13 com dígito verificador correto.</div>}
    <div className="form-grid compact physical-piece-controls">
     <label className="field"><span>Largura do EAN · {draft.barcodeWidth}%</span><input className="input" type="range" min="50" max="100" step="5" value={draft.barcodeWidth} onChange={e=>patch(i,{barcodeWidth:Number(e.target.value)})}/></label>
     <label className="field"><span>Altura das barras · {draft.barcodeHeight}%</span><input className="input" type="range" min="50" max="150" step="5" value={draft.barcodeHeight} onChange={e=>patch(i,{barcodeHeight:Number(e.target.value)})}/></label>
    </div>
    <div className="preview-actions"><button className="btn" type="button" onClick={()=>restore(i)} disabled={!draft.itemId}>Restaurar dados da campanha</button>{i<3&&<button className="btn" type="button" onClick={()=>duplicate(i)}>Duplicar na próxima peça</button>}<button className="btn danger" type="button" onClick={()=>clear(i)}>Limpar peça</button></div>
   </details>)}</div>
  </section>
  {!active.some(x=>x.itemId||x.product)?<div className="empty">Adicione produtos à campanha para gerar o material físico.</div>:<div className="validity-sheet-wrap"><div className={`validity-sheet physical-sheet ${mode===1?"physical-sheet-one":"physical-sheet-four"}`}>{Array.from({length:mode===1?1:4},(_,i)=>i<activeCount&&active[i]?(active[i].itemId||active[i].product?ticket(active[i],`slot-${i}`):<div key={i}/>):<div key={i} className="print-empty-slot"/>)}</div></div>}
  <div className="no-print physical-template-editors" style={{marginTop:18}}>
   <TemplateEditor config={templateOne.config} onChange={templateOne.setConfig} onSaved={templateOne.reload} canEdit={templateOne.canEdit} ready={templateOne.ready} title="Template Mestre · 1 produto · folha inteira"/>
   <TemplateEditor config={templateFour.config} onChange={templateFour.setConfig} onSaved={templateFour.reload} canEdit={templateFour.canEdit} ready={templateFour.ready} title="Template Mestre · 1/4 de folha"/>
  </div>
 </>;
}
