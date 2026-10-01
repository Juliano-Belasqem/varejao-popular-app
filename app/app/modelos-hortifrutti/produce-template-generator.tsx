"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfiguredTicket } from "@/components/configured-ticket";
import { TemplateEditor } from "@/components/template-editor";
import { useBrandKit } from "@/lib/brand-kit/client";
import { useTemplate } from "@/lib/use-template";
import { deleteProduceProduct, saveProduceProduct, uploadProducePdf, removeProducePdf } from "./actions";
import { createClient } from "@/lib/supabase/client";

type Product={id:string;name:string;specification:string;unit:string;code:string;pdf_path:string|null};
type Slot={productId:string;productQuery:string;price:string;priceScale:number;priceX:number;priceY:number;pdfRegion:number};
const empty=():Slot=>({productId:"",productQuery:"",price:"",priceScale:1,priceX:50,priceY:70,pdfRegion:1});

function splitPrice(value:string){const clean=value.replace(/[^0-9,]/g,"");const[a="0",b="00"]=clean.split(",");return{major:a||"0",minor:(b+"00").slice(0,2)}}
function ProducePrice({value,manualScale=1}:{value:string;manualScale?:number}){const p=splitPrice(value);const scale=(p.major.length<=1?1.22:p.major.length===2?.95:p.major.length===3?.76:.60)*manualScale;return <div className="produce-price" style={{transform:"scale("+scale+")",transformOrigin:"center center",paddingTop:".12em",boxSizing:"border-box",width:"100%",height:"100%"}}><strong>{p.major}</strong><span>,{p.minor}</span></div>}


/** Render the first page of the private PDF as the actual ticket artwork, on screen and on paper. */
function UploadedPdfTicket({path,slot}:{path:string;slot:Slot}){
  const [preview,setPreview]=useState<{path:string;image:string}|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let cancelled=false;
    let task:{destroy:()=>Promise<void>}|undefined;
    async function load(){
      setError("");
      try{
        const {data,error:signedError}=await createClient().storage.from("produce-pdfs").createSignedUrl(path,300);
        if(signedError||!data?.signedUrl)throw new Error(signedError?.message||"PDF indisponível.");
        const pdfjs=await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";
        if(cancelled)return;
        const loading=pdfjs.getDocument({url:data.signedUrl});
        task=loading;
        const pdf=await loading.promise;
        const page=await pdf.getPage(1);
        const viewport=page.getViewport({scale:1});
        const scale=Math.min(3,Math.max(1.5,1000/viewport.width));
        const target=page.getViewport({scale});
        const canvas=document.createElement("canvas");
        canvas.width=Math.ceil(target.width);canvas.height=Math.ceil(target.height);
        const context=canvas.getContext("2d");
        if(!context)throw new Error("Não foi possível renderizar o PDF.");
        await page.render({canvas,canvasContext:context,viewport:target}).promise;
        const region=Math.max(0,Math.min(4,slot.pdfRegion));
        let image=canvas.toDataURL("image/png");
        if(region>0){
          const quadrant=region-1;
          const sx=Math.round((quadrant%2)*canvas.width/2);
          const sy=Math.round(Math.floor(quadrant/2)*canvas.height/2);
          const sw=Math.round(canvas.width/2),sh=Math.round(canvas.height/2);
          const cropped=document.createElement("canvas");
          cropped.width=sw;cropped.height=sh;
          const croppedContext=cropped.getContext("2d");
          if(!croppedContext)throw new Error("Não foi possível recortar o modelo PDF.");
          croppedContext.drawImage(canvas,sx,sy,sw,sh,0,0,sw,sh);
          image=cropped.toDataURL("image/png");
        }
        if(!cancelled)setPreview({path:path+":"+region,image});
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Falha ao carregar PDF.");}
    }
    void load();
    return()=>{cancelled=true;void task?.destroy().catch(()=>{});};
  },[path,slot.pdfRegion]);
  return <div className="produce-uploaded-ticket">
    {preview?.path===path+":"+slot.pdfRegion?<img src={preview.image} alt="Arte original do PDF cadastrado" />:<div className="produce-pdf-loading">{error||"Carregando arte PDF..."}</div>}
    {preview?.path===path+":"+slot.pdfRegion&&<div className="produce-pdf-price" style={{left:slot.priceX+"%",top:slot.priceY+"%",fontSize:(Math.min(30,Math.max(8,20*slot.priceScale*(slot.price.replace(/[^0-9]/g,"").length<=3?1:slot.price.replace(/[^0-9]/g,"").length===4?.85:.7))))+"cqw"}}>R$ {slot.price.trim()||"0,00"}</div>}
  </div>;
}

function sortedProducts(products:Product[],search:string,onlyPdf:boolean){const q=search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");return [...products].filter(p=>(!onlyPdf||!!p.pdf_path)&&[p.name,p.specification,p.code,p.unit].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").includes(q)).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"))}

export function ProduceTemplateGenerator({products}:{products:Product[]}){
  const template=useTemplate("produce");
  const {fieldFonts}=useBrandKit("validity");
  const [slots,setSlots]=useState<Slot[]>(()=>[empty(),empty(),empty(),empty()]);
  const [editing,setEditing]=useState<Product|null>(null);
  const [pdfError,setPdfError]=useState("");
  const [search,setSearch]=useState("");
  const [onlyPdf,setOnlyPdf]=useState(false);
  const [uploading,setUploading]=useState<string|null>(null);
  const filtered=useMemo(()=>sortedProducts(products,search,onlyPdf),[products,search,onlyPdf]);
  async function previewPdf(product:Product){if(!product.pdf_path)return;const {data,error}=await createClient().storage.from("produce-pdfs").createSignedUrl(product.pdf_path,120);if(error||!data?.signedUrl){setPdfError(error?.message??"Não foi possível abrir o PDF.");return}window.open(data.signedUrl,"_blank","noopener,noreferrer")}

  const [printCount,setPrintCount]=useState(4);
  const sorted=useMemo(()=>[...products].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")),[products]);
  const duplicate=(index:number)=>setSlots(old=>old.map((s,i)=>i===index+1?{...old[index]}:s));
  const patch=(index:number,values:Partial<Slot>)=>setSlots(old=>old.map((slot,i)=>i===index?{...slot,...values}:slot));
  const ticket=(slot:Slot)=>{const product=products.find(p=>p.id===slot.productId);if(product?.pdf_path)return <UploadedPdfTicket path={product.pdf_path} slot={slot}/>;return <ConfiguredTicket config={template.config} fonts={fieldFonts} logoUrl={null} values={{
    produceName:product?.name||"PRODUTO",
    produceSpecification:product ? (product.specification || "") : "ESPECIFICAÇÃO",
    produceCurrency:"R$",
    producePrice:<ProducePrice value={slot.price} manualScale={slot.priceScale}/>,
    produceUnit:product?.unit||"KG",
    produceCode:product?.code||"000",
  }}/>};

  return <>
    <section className="card no-print" style={{marginBottom:18}}>
      <div className="section-title-row"><div><small className="eyebrow">DADOS DA FOLHA</small><h2>{printCount} {printCount===1?"item":"itens"} de hortifrutti</h2></div><div className="preview-actions"><button className="btn" type="button" onClick={()=>document.getElementById("cadastro-hortifrutti")?.scrollIntoView({behavior:"smooth",block:"start"})}>+ Adicionar produto</button><button className="btn primary" type="button" disabled={!template.ready} onClick={()=>window.print()}>Imprimir / salvar PDF</button></div></div>
      <label className="field" style={{maxWidth:260,marginTop:14}}><span>Quantidade para imprimir</span><select className="input" value={printCount} onChange={e=>setPrintCount(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?"produto":"produtos"}</option>)}</select></label>
      <div className="validity-editor-grid" style={{marginTop:14}}>{slots.slice(0,printCount).map((slot,index)=><div className="validity-editor" key={index}>
        <strong>Item {index+1}</strong>
        <label className="field"><span>Produto</span><select className="input" value={slot.productId} onChange={e=>{const product=products.find(p=>p.id===e.target.value);patch(index,{productId:product?.id??"",productQuery:product?.name??""})}}><option value="">Selecione o produto exato...</option>{sorted.map(p=><option value={p.id} key={p.id}>{p.name}{p.specification?" · "+p.specification:""} · Cód. {p.code}</option>)}</select></label>
        <div className="preview-actions">{index<3&&<button className="btn" type="button" onClick={()=>{duplicate(index);if(printCount<index+2)setPrintCount(index+2)}}>Duplicar no próximo espaço</button>}{products.find(p=>p.id===slot.productId)?.pdf_path&&<button className="btn" type="button" onClick={()=>void previewPdf(products.find(p=>p.id===slot.productId)!)}>Abrir PDF original</button>}</div>
        {products.find(p=>p.id===slot.productId)?.pdf_path&&<label className="field"><span>Recorte do PDF (página 1)</span><select className="input" value={slot.pdfRegion} onChange={e=>patch(index,{pdfRegion:Number(e.target.value)})}><option value={1}>Superior esquerdo (padrão)</option><option value={0}>Página inteira (PDF com 1 modelo)</option><option value={2}>Superior direito (modelo 2)</option><option value={3}>Inferior esquerdo (modelo 3)</option><option value={4}>Inferior direito (modelo 4)</option></select><small className="muted">Para PDFs com quatro quadros (2 × 2), escolha um dos quatro modelos. O arquivo original não será alterado.</small></label>}
        <label className="field"><span>Preço</span><input className="input" inputMode="decimal" placeholder="9,99" value={slot.price} onChange={e=>patch(index,{price:e.target.value})}/></label><label className="field"><span>Ajuste do preço · {Math.round(slot.priceScale*100)}%</span><input className="input" type="range" min=".7" max="1.4" step=".05" value={slot.priceScale} onChange={e=>patch(index,{priceScale:Number(e.target.value)})}/></label>
      </div>)}</div>
    </section>

    <div className="validity-sheet-wrap"><div className="validity-sheet produce-sheet">{slots.map((slot,index)=><div key={index} className="produce-slot">{index<printCount?ticket(slot):null}</div>)}</div></div>

    <section id="cadastro-hortifrutti" className="card no-print" style={{marginTop:18}}>
      <div className="section-title-row"><div><small className="eyebrow">BANCO PRÓPRIO</small><h2>{editing?"Editar produto":"Adicionar produto ao cadastro"}</h2><div className="muted" style={{marginTop:4}}>Cadastre aqui itens que ainda não aparecem na seleção da folha.</div></div><span className="pill">{products.length} cadastrados</span></div>
      <form action={saveProduceProduct} className="form-grid" style={{marginTop:14}}>
        <input type="hidden" name="id" value={editing?.id??""}/>
        <label className="field"><span>Nome</span><input className="input" name="name" required defaultValue={editing?.name??""} key={"name-"+(editing?.id??"new")}/></label>
        <label className="field"><span>Especificação</span><input className="input" name="specification" defaultValue={editing?.specification??""} key={"spec-"+(editing?.id??"new")} placeholder="Ex.: Rosa, 2ª"/></label>
        <label className="field"><span>Unidade</span><input className="input" name="unit" required defaultValue={editing?.unit??"KG"} key={"unit-"+(editing?.id??"new")}/></label>
        <label className="field"><span>Código</span><input className="input" name="code" required inputMode="numeric" defaultValue={editing?.code??""} key={"code-"+(editing?.id??"new")}/></label>
        <div className="preview-actions"><button className="btn primary" type="submit">{editing?"Salvar alterações":"Cadastrar produto"}</button>{editing&&<button className="btn" type="button" onClick={()=>setEditing(null)}>Cancelar</button>}</div>
      </form>
      <div className="form-grid compact" style={{marginTop:14}}><label className="field"><span>Pesquisar no acervo</span><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, código ou especificação"/></label><label className="field"><span>Filtrar modelos</span><select className="input" value={onlyPdf?"pdf":"all"} onChange={e=>setOnlyPdf(e.target.value==="pdf")}><option value="all">Todos os produtos</option><option value="pdf">Somente com PDF</option></select></label></div><p className="muted">{filtered.length} produto(s) encontrados · {products.filter(p=>p.pdf_path).length} com PDF cadastrado.</p>
      {pdfError&&<div className="error">{pdfError}</div>}<p className="muted">Modelos PDF são armazenados privadamente por produto (até 10 MB). Ao selecionar um produto com PDF, escolha a página inteira ou um dos quatro quadrantes da primeira página (grade 2 × 2). O recorte é aplicado apenas na geração, sem modificar o PDF original. Produtos sem PDF usam o template dinâmico.</p><div className="produce-product-list" style={{marginTop:16}}>{filtered.length===0&&<div className="card"><p>Nenhum produto encontrado para os filtros selecionados.</p><button className="btn" type="button" onClick={()=>{setSearch("");setOnlyPdf(false)}}>Limpar filtros</button></div>}{filtered.map(product=><article className="card" key={product.id} style={{padding:12}}>
        <strong>{product.name}</strong> {product.pdf_path&&<span className="pill">PDF cadastrado</span>}<div className="muted">{[product.specification,product.unit,"Cód. "+product.code].filter(Boolean).join(" · ")}</div>
        <form action={async data=>{setUploading(product.id);setPdfError("");try{await uploadProducePdf(data)}catch(error){setPdfError(error instanceof Error?error.message:"Falha ao enviar PDF.")}finally{setUploading(null)}}} className="preview-actions" style={{marginTop:8}}><input type="hidden" name="id" value={product.id}/><label className="field"><span>{product.pdf_path?"Substituir modelo PDF":"Enviar modelo PDF"}</span><input className="input" name="pdf" type="file" accept="application/pdf,.pdf" required/></label><button className="btn" type="submit" disabled={uploading!==null}>{uploading===product.id?"Enviando PDF...":"Salvar PDF"}</button></form><div className="preview-actions" style={{marginTop:8}}>{product.pdf_path&&<><button className="btn" type="button" onClick={()=>void previewPdf(product)}>Visualizar PDF</button><form action={removeProducePdf} onSubmit={e=>{if(!window.confirm(`Remover o PDF cadastrado de ${product.name}?`))e.preventDefault()}}><input type="hidden" name="id" value={product.id}/><button className="btn" type="submit">Remover PDF</button></form></>}<button className="btn" type="button" onClick={()=>setEditing(product)}>Editar</button><form action={deleteProduceProduct} onSubmit={e=>{if(!window.confirm(`Excluir o produto ${product.name} do cadastro?`))e.preventDefault()}}><input type="hidden" name="id" value={product.id}/><button className="btn danger" type="submit">Excluir</button></form></div>
      </article>)}</div>
    </section>

    <div className="grid no-print" style={{alignItems:"start",marginTop:18}}>
      <TemplateEditor config={template.config} onChange={template.setConfig} onSaved={template.reload} canEdit={template.canEdit} ready={template.ready} title="Configurar template e campos do Hortifrutti"/>
      <section className="card"><small className="eyebrow">PRÉVIA AO VIVO</small><h2 style={{marginTop:0}}>Template Hortifrutti</h2><div style={{aspectRatio:"1 / 1.414",maxHeight:560,margin:"14px auto 0"}}>{ticket(slots[0])}</div></section>
    </div>
  </>;
}
