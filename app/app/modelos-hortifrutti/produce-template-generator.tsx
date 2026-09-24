"use client";

import { useMemo, useState } from "react";
import { ConfiguredTicket } from "@/components/configured-ticket";
import { TemplateEditor } from "@/components/template-editor";
import { useBrandKit } from "@/lib/brand-kit/client";
import { useTemplate } from "@/lib/use-template";
import { deleteProduceProduct, saveProduceProduct } from "./actions";

type Product={id:string;name:string;specification:string;unit:string;code:string};
type Slot={productId:string;price:string;priceScale:number};
const empty=():Slot=>({productId:"",price:"",priceScale:1});

function splitPrice(value:string){const clean=value.replace(/[^0-9,]/g,"");const[a="0",b="00"]=clean.split(",");return{major:a||"0",minor:(b+"00").slice(0,2)}}
function ProducePrice({value,manualScale=1}:{value:string;manualScale?:number}){const p=splitPrice(value);const scale=(p.major.length<=1?1.22:p.major.length===2?.76:p.major.length===3?.68:.58)*manualScale;return <div className="produce-price" style={{transform:"scale("+scale+")",transformOrigin:"center center",paddingTop:".12em",boxSizing:"border-box",width:"100%",height:"100%"}}><small>R$</small><strong>{p.major}</strong><span>,{p.minor}</span></div>}

export function ProduceTemplateGenerator({products}:{products:Product[]}){
  const template=useTemplate("produce");
  const {fieldFonts}=useBrandKit("validity");
  const [slots,setSlots]=useState<Slot[]>(()=>[empty(),empty(),empty(),empty()]);
  const [editing,setEditing]=useState<Product|null>(null);
  const sorted=useMemo(()=>[...products].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")),[products]);
  const patch=(index:number,values:Partial<Slot>)=>setSlots(old=>old.map((slot,i)=>i===index?{...slot,...values}:slot));
  const ticket=(slot:Slot)=>{const product=products.find(p=>p.id===slot.productId);return <ConfiguredTicket config={template.config} fonts={fieldFonts} logoUrl={null} values={{
    produceName:product?.name||"PRODUTO",
    produceSpecification:product?.specification||"ESPECIFICAÇÃO",
    producePrice:<ProducePrice value={slot.price} manualScale={slot.priceScale}/>,
    produceUnit:product?.unit||"KG",
    produceCode:product?.code||"000",
  }}/>};

  return <>
    <section className="card no-print" style={{marginBottom:18}}>
      <div className="section-title-row"><div><small className="eyebrow">DADOS DA FOLHA</small><h2>4 itens de hortifrutti</h2></div><div className="preview-actions"><button className="btn" type="button" onClick={()=>document.getElementById("cadastro-hortifrutti")?.scrollIntoView({behavior:"smooth",block:"start"})}>+ Adicionar produto</button><button className="btn primary" type="button" disabled={!template.ready} onClick={()=>window.print()}>Imprimir / salvar PDF</button></div></div>
      <div className="validity-editor-grid" style={{marginTop:14}}>{slots.map((slot,index)=><div className="validity-editor" key={index}>
        <strong>Item {index+1}</strong>
        <label className="field"><span>Produto</span><select className="input" value={slot.productId} onChange={e=>patch(index,{productId:e.target.value})}><option value="">Selecione</option>{sorted.map(p=><option value={p.id} key={p.id}>{p.name}{p.specification?" · "+p.specification:""}</option>)}</select></label>
        <label className="field"><span>Preço</span><input className="input" inputMode="decimal" placeholder="9,99" value={slot.price} onChange={e=>patch(index,{price:e.target.value})}/></label><label className="field"><span>Ajuste do preço · {Math.round(slot.priceScale*100)}%</span><input className="input" type="range" min=".7" max="1.4" step=".05" value={slot.priceScale} onChange={e=>patch(index,{priceScale:Number(e.target.value)})}/></label>
      </div>)}</div>
    </section>

    <div className="validity-sheet-wrap"><div className="validity-sheet produce-sheet">{slots.map((slot,index)=><div key={index} className="produce-slot">{ticket(slot)}</div>)}</div></div>

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
      <div className="produce-product-list" style={{marginTop:16}}>{sorted.map(product=><article className="card" key={product.id} style={{padding:12}}>
        <strong>{product.name}</strong><div className="muted">{[product.specification,product.unit,"Cód. "+product.code].filter(Boolean).join(" · ")}</div>
        <div className="preview-actions" style={{marginTop:8}}><button className="btn" type="button" onClick={()=>setEditing(product)}>Editar</button><form action={deleteProduceProduct}><input type="hidden" name="id" value={product.id}/><button className="btn danger" type="submit">Excluir</button></form></div>
      </article>)}</div>
    </section>

    <div className="grid no-print" style={{alignItems:"start",marginTop:18}}>
      <TemplateEditor config={template.config} onChange={template.setConfig} onSaved={template.reload} canEdit={template.canEdit} ready={template.ready} title="Configurar template e campos do Hortifrutti"/>
      <section className="card"><small className="eyebrow">PRÉVIA AO VIVO</small><h2 style={{marginTop:0}}>Template Hortifrutti</h2><div style={{aspectRatio:"1 / 1.414",maxHeight:560,margin:"14px auto 0"}}>{ticket(slots[0])}</div></section>
    </div>
  </>;
}
