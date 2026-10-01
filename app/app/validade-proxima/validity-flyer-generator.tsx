"use client";

import { TemplateEditor } from "@/components/template-editor";
import { ConfiguredTicket } from "@/components/configured-ticket";
import { useTemplate } from "@/lib/use-template";
import { useMemo, useState } from "react";
import { useBrandKit } from "@/lib/brand-kit/client";

type Product={id:string;ean:string|null;name:string;brand:string|null;specification:string|null;category:string|null;unit:string|null;sale_price:number|string|null};
type Entry={productId:string;name:string;brand:string;specification:string;normalPrice:string;offerPrice:string;expiry:string;ean:string;unit:string};
const emptyEntry=():Entry=>({productId:"",name:"",brand:"",specification:"",normalPrice:"",offerPrice:"",expiry:"",ean:"",unit:"UN"});

function splitPrice(value:string){const clean=value.replace(/[^0-9,]/g,"");const[a="0",b="00"]=clean.split(",");return{major:a||"0",minor:(b+"00").slice(0,2)}}
function ResponsivePrice({value,unit,manualScale=1}:{value:string;unit:string;manualScale?:number}){const price=splitPrice(value);const scale=(price.major.length<=1?1.22:price.major.length===2?.95:price.major.length===3?.76:.60)*manualScale;return <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",height:"100%",lineHeight:.9,transform:`scale(${scale})`,transformOrigin:"center center",paddingTop:".12em",boxSizing:"border-box"}}><small style={{fontSize:".2em",marginTop:".15em",color:"#c7192b"}}>R$</small><strong style={{fontSize:"1em"}}>{price.major}</strong><span style={{fontSize:".4em"}}>,{price.minor}<small style={{display:"block",fontSize:".55em",color:"#c7192b"}}>{unit}</small></span></div>}
function validEan13(code:string){const d=code.replace(/\D/g,"");if(d.length!==13)return null;const sum=d.slice(0,12).split("").reduce((acc,n,i)=>acc+Number(n)*(i%2===0?1:3),0);const check=(10-(sum%10))%10;return check===Number(d[12])?d:null}
function eanBars(code:string){const valid=validEan13(code);if(!valid)return null;const d=valid;const L=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"],G=["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"],R=["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"],P=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"][Number(d[0])];let bits="101";for(let i=1;i<=6;i++)bits+=(P[i-1]==="L"?L:G)[Number(d[i])];bits+="01010";for(let i=7;i<=12;i++)bits+=R[Number(d[i])];return bits+"101"}
function Barcode({code,width=100,height=100}:{code:string;width?:number;height?:number}){const bits=eanBars(code);const digits=validEan13(code);if(!bits||!digits)return <div className="barcode-fallback" style={{textAlign:"center",fontVariantNumeric:"tabular-nums",overflowWrap:"anywhere"}}>{code.replace(/\D/g,"")||"Informe o código"}<small style={{display:"block"}}>Para gerar barras EAN-13, informe 13 dígitos válidos.</small></div>;return <div className="validity-barcode" style={{background:"#fff",padding:"2% 4%"}}><svg className="barcode-svg" style={{height:`${height}%`,width:`${width}%`,maxWidth:"none",margin:"0 auto"}} viewBox="0 0 113 60" preserveAspectRatio="none" shapeRendering="crispEdges" aria-label={digits}><rect width="113" height="60" fill="#fff"/>{bits.split("").map((b,i)=>b==="1"?<rect key={i} x={11+i} y="2" width="1" height={(i<3||(i>=45&&i<50)||i>=92)?46:41} fill="#000"/>:null)}</svg><div className="barcode-number" style={{color:"#000",fontSize:".42em",lineHeight:1,letterSpacing:".12em",textAlign:"center"}}>{digits}</div></div>}

export function ValidityFlyerGenerator({products}:{products:Product[]}){
  const template=useTemplate("validity");
  const {logoUrl,fieldFonts,ready:brandReady}=useBrandKit("validity");
  const[entries,setEntries]=useState<Entry[]>(()=>[emptyEntry(),emptyEntry(),emptyEntry(),emptyEntry()]);
  const[priceScale,setPriceScale]=useState(1);
  const[printCount,setPrintCount]=useState(4);
  const[barcodeWidth,setBarcodeWidth]=useState(100);
  const[barcodeHeight,setBarcodeHeight]=useState(100);
  const options=useMemo(()=>products.map(p=>({value:p.id,label:[p.name,p.brand,p.specification].filter(Boolean).join(" · ")})),[products]);
  function patch(index:number,values:Partial<Entry>){setEntries(old=>old.map((e,i)=>i===index?{...e,...values}:e))}
  function selectProduct(index:number,id:string){
    const p=products.find(x=>x.id===id);
    if(!p){setEntries(old=>old.map((e,i)=>i===index?emptyEntry():e));return}
    const price=p.sale_price==null?"":Number(p.sale_price).toFixed(2).replace(".",",");
    patch(index,{productId:id,name:p.name,brand:p.brand??"",specification:p.specification??p.unit??"",normalPrice:price,ean:p.ean??"",unit:p.unit??"UN"});
  }

  return <>
    {template.error&&<div className="error no-print">{template.error}</div>}
    <section className="card no-print" style={{marginBottom:18}}>
      <div className="section-title-row"><div><small className="eyebrow">DADOS DA FOLHA</small><h2>{printCount} {printCount===1?"oferta":"ofertas"} de validade</h2></div><button className="btn primary" type="button" disabled={!template.ready||!brandReady} onClick={()=>window.print()}>Imprimir / salvar PDF</button></div>
      <p className="muted">Selecione produtos do catálogo ou ajuste qualquer informação manualmente. Logo e fontes seguem o Kit da Marca.</p><label className="field" style={{maxWidth:260,marginBottom:14}}><span>Quantidade para imprimir</span><select className="input" value={printCount} onChange={e=>setPrintCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?"produto":"produtos"}</option>)}</select></label>
      <div className="validity-editor-grid">{entries.slice(0,printCount).map((e,index)=><div className="validity-editor" key={index}><strong>Oferta {index+1}</strong><label className="field"><span>Produto do catálogo</span><select className="input" value={e.productId} onChange={ev=>selectProduct(index,ev.target.value)}><option value="">Preencher manualmente</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><div className="form-grid compact"><label className="field"><span>Produto / tipo</span><input className="input" value={e.name} onChange={ev=>patch(index,{name:ev.target.value})}/></label><label className="field"><span>Marca</span><input className="input" value={e.brand} onChange={ev=>patch(index,{brand:ev.target.value})}/></label><label className="field"><span>Especificação</span><input className="input" value={e.specification} onChange={ev=>patch(index,{specification:ev.target.value})}/></label><label className="field"><span>Validade</span><input className="input" placeholder="20/05/26" value={e.expiry} onChange={ev=>patch(index,{expiry:ev.target.value})}/></label><label className="field"><span>Preço normal</span><input className="input" inputMode="decimal" value={e.normalPrice} onChange={ev=>patch(index,{normalPrice:ev.target.value})}/></label><label className="field"><span>Preço oferta</span><input className="input" inputMode="decimal" value={e.offerPrice} onChange={ev=>patch(index,{offerPrice:ev.target.value})}/></label><label className="field"><span>Código de barras · {e.ean.length} dígitos</span><input className="input" inputMode="numeric" pattern="[0-9]*" maxLength={32} value={e.ean} onChange={ev=>patch(index,{ean:ev.target.value.replace(/\D/g,"").slice(0,32)})}/><small className="muted" style={{color:e.ean.length===13&&!validEan13(e.ean)?"#c7192b":undefined}}>{!e.ean?"Informe o código numérico.":validEan13(e.ean)?"EAN-13 válido: barras prontas para impressão.":e.ean.length===13?"EAN-13 inválido: confira o dígito verificador.":`${e.ean.length} dígitos informados. O número será exibido como texto; barras exigem EAN-13 válido.`}</small></label><label className="field"><span>Unidade</span><input className="input" value={e.unit} onChange={ev=>patch(index,{unit:ev.target.value})}/></label></div></div>)}</div><div className="form-grid compact" style={{marginTop:14}}><label className="field"><span>Ajuste do tamanho do preço · {Math.round(priceScale*100)}%</span><input className="input" type="range" min=".7" max="1.4" step=".05" value={priceScale} onChange={e=>setPriceScale(Number(e.target.value))}/></label><label className="field"><span>Largura do código de barras · {barcodeWidth}%</span><input className="input" type="range" min="50" max="100" step="5" value={barcodeWidth} onChange={e=>setBarcodeWidth(Number(e.target.value))}/></label><label className="field"><span>Altura das barras · {barcodeHeight}%</span><input className="input" type="range" min="50" max="150" step="5" value={barcodeHeight} onChange={e=>setBarcodeHeight(Number(e.target.value))}/></label></div>
    </section>
    <div className="validity-sheet-wrap"><div className="validity-sheet">{entries.map((e,index)=>index<printCount?<ConfiguredTicket key={index} config={template.config} fonts={fieldFonts} logoUrl={logoUrl} values={{
      title:"OFERTA",product:e.name||"PRODUTO",brand:e.brand||"MARCA",specification:e.specification||"ESPECIFICAÇÃO",validity:`VALIDADE ${e.expiry||"__/__/__"}`,
      price:<ResponsivePrice value={e.offerPrice} unit={e.unit||"UN"} manualScale={priceScale}/>,
      normalPrice:e.normalPrice||"0,00",code:<Barcode code={e.ean} width={barcodeWidth} height={barcodeHeight}/>,footer:"Oferta válida enquanto durarem os estoques",
    }}/>:<div key={index} className="configured-ticket print-empty-slot" />)}</div></div>
    <div className="validity-template-workbench no-print" style={{marginTop:18}}>
      <TemplateEditor config={template.config} onChange={template.setConfig} onSaved={template.reload} canEdit={template.canEdit} ready={template.ready}/>
      <section className="card">
        <div className="section-title-row"><div><small className="eyebrow">PRÉVIA AO VIVO</small><h2>Template Mestre</h2></div></div>
        <div style={{aspectRatio:"1 / 1.414",maxHeight:560,margin:"14px auto 0"}}><ConfiguredTicket config={template.config} fonts={fieldFonts} logoUrl={logoUrl} values={{title:"OFERTA",product:"PRODUTO EXEMPLO",brand:"MARCA",specification:"500G",validity:"VALIDADE 30/09/26",price:<ResponsivePrice value="9,99" unit="UN" manualScale={priceScale}/>,normalPrice:"15,99",code:<Barcode code="7891000100103" width={barcodeWidth} height={barcodeHeight}/>,footer:"Oferta válida enquanto durarem os estoques"}}/></div>
      </section>
    </div>
  </>;
}
