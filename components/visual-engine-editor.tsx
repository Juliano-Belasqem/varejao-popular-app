"use client";
import {useMemo,useState} from "react";
import {createVisualDocument,visualBindings,type VisualDocument,type VisualElement} from "@/lib/visual-engine";

const seed=():VisualDocument=>({...createVisualDocument("Rascunho visual"),elements:[
 {id:"product",type:"text",name:"Produto",visible:true,locked:false,binding:"product.name",transform:{x:70,y:90,width:500,height:90,rotation:0,opacity:1,layer:2},textStyle:{fontSize:56,fontWeight:800,color:"#111111",textAlign:"left"}},
 {id:"price",type:"text",name:"Preço",visible:true,locked:false,binding:"offer.price",transform:{x:610,y:690,width:350,height:160,rotation:0,opacity:1,layer:3},textStyle:{fontSize:110,fontWeight:900,color:"#111111",textAlign:"center"}},
]});

export function VisualEngineEditor(){
 const [doc,setDoc]=useState(seed); const [selected,setSelected]=useState("product"); const [history,setHistory]=useState<VisualDocument[]>([]); const [future,setFuture]=useState<VisualDocument[]>([]);
 const current=doc.elements.find(e=>e.id===selected);
 const ordered=useMemo(()=>[...doc.elements].sort((a,b)=>b.transform.layer-a.transform.layer),[doc.elements]);
 function commit(next:VisualDocument){setHistory(h=>[...h.slice(-49),doc]);setFuture([]);setDoc(next)}
 function patch(values:Partial<VisualElement>){if(!current)return;commit({...doc,elements:doc.elements.map(e=>e.id===current.id?{...e,...values}:e)})}
 function patchTransform(key:keyof VisualElement["transform"],value:number){if(!current||current.locked)return;patch({transform:{...current.transform,[key]:value}})}
 function remove(){if(!current||current.locked)return;commit({...doc,elements:doc.elements.filter(e=>e.id!==current.id)});setSelected("")}
 function duplicate(){if(!current)return;const id=`${current.id}-copy-${Date.now()}`;const copy={...current,id,name:`${current.name} (cópia)`,transform:{...current.transform,x:current.transform.x+20,y:current.transform.y+20,layer:doc.elements.length+1}};commit({...doc,elements:[...doc.elements,copy]});setSelected(id)}
 function add(type:VisualElement["type"]){const id=`${type}-${Date.now()}`;const next:VisualElement={id,type,name:type==="text"?"Novo texto":type==="image"?"Nova imagem":type==="barcode"?"Código de barras":type==="shape"?"Forma":"Grupo",visible:true,locked:false,transform:{x:100,y:100,width:260,height:100,rotation:0,opacity:1,layer:doc.elements.length+1},text:type==="text"?"Texto":undefined,textStyle:type==="text"?{fontSize:48,fontWeight:700,color:"#111111",textAlign:"left"}:undefined,shape:type==="shape"?{kind:"rectangle",fill:"#ffffff",stroke:"#111111",strokeWidth:1}:undefined};commit({...doc,elements:[...doc.elements,next]});setSelected(id)}
 function undo(){const prev=history.at(-1);if(!prev)return;setFuture(f=>[doc,...f]);setHistory(h=>h.slice(0,-1));setDoc(prev)}
 function redo(){const next=future[0];if(!next)return;setHistory(h=>[...h,doc]);setFuture(f=>f.slice(1));setDoc(next)}
 return <div style={{display:"grid",gridTemplateColumns:"220px minmax(0,1fr) 280px",gap:14,alignItems:"start"}}>
  <aside className="card"><strong>Elementos</strong><div style={{display:"grid",gap:6,marginTop:10}}>{ordered.map(e=><button key={e.id} className="btn" onClick={()=>setSelected(e.id)} style={{textAlign:"left",opacity:e.visible?1:.55}}>{e.locked?"🔒 ":""}{e.name}</button>)}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>{(["text","image","shape","barcode"] as const).map(t=><button key={t} className="btn" onClick={()=>add(t)}>+ {t}</button>)}</div></aside>
  <main><div className="preview-actions no-print" style={{marginBottom:10}}><button className="btn" disabled={!history.length} onClick={undo}>Desfazer</button><button className="btn" disabled={!future.length} onClick={redo}>Refazer</button><span className="muted">Prancheta {doc.width} × {doc.height}</span></div>
   <div style={{position:"relative",width:"100%",maxWidth:720,margin:"0 auto",aspectRatio:`${doc.width}/${doc.height}`,background:doc.background.color,border:"1px solid var(--line)",overflow:"hidden"}}>
    {doc.elements.filter(e=>e.visible).sort((a,b)=>a.transform.layer-b.transform.layer).map(e=><div key={e.id} onClick={()=>setSelected(e.id)} style={{position:"absolute",left:`${e.transform.x/doc.width*100}%`,top:`${e.transform.y/doc.height*100}%`,width:`${e.transform.width/doc.width*100}%`,height:`${e.transform.height/doc.height*100}%`,transform:`rotate(${e.transform.rotation}deg)`,opacity:e.transform.opacity,zIndex:e.transform.layer,border:e.id===selected?"2px solid #2563eb":"1px dashed #94a3b8",display:"grid",placeItems:"center",color:e.textStyle?.color,fontSize:`${Math.max(10,(e.textStyle?.fontSize??32)/doc.width*720)}px`,fontWeight:e.textStyle?.fontWeight,textAlign:e.textStyle?.textAlign??"center",userSelect:"none"}}>
      {e.type==="text"?(e.text||e.binding||e.name):e.type==="image"?"Imagem":e.type==="barcode"?"||||| 789...":e.type==="shape"?"Forma":"Grupo"}
    </div>)}
   </div>
  </main>
  <aside className="card"><strong>Propriedades</strong>{current?<div className="form" style={{marginTop:10}}><div style={{display:"flex",gap:6}}><button className="btn" type="button" onClick={duplicate}>Duplicar</button><button className="btn" type="button" disabled={current.locked} onClick={remove}>Excluir</button></div><label className="field"><span>Nome</span><input className="input" value={current.name} onChange={e=>patch({name:e.target.value})}/></label><div style={{display:"flex",gap:10}}><label><input type="checkbox" checked={current.visible} onChange={e=>patch({visible:e.target.checked})}/> Visível</label><label><input type="checkbox" checked={current.locked} onChange={e=>patch({locked:e.target.checked})}/> Bloqueado</label></div>
   {(["x","y","width","height","rotation","opacity","layer"] as const).map(k=><label className="field" key={k}><span>{k}</span><input className="input" type="number" step={k==="opacity"?.05:1} min={k==="opacity"?0:undefined} max={k==="opacity"?1:undefined} value={current.transform[k]} onChange={e=>patchTransform(k,Number(e.target.value))}/></label>)}
   {current.type==="text"&&<><label className="field"><span>Texto livre</span><input className="input" value={current.text??""} onChange={e=>patch({text:e.target.value})}/></label><label className="field"><span>Vínculo de dados</span><select className="input" value={current.binding??""} onChange={e=>patch({binding:e.target.value||undefined})}><option value="">Sem vínculo</option>{visualBindings.map(binding=><option key={binding} value={binding}>{binding}</option>)}</select></label><label className="field"><span>Tamanho da fonte</span><input className="input" type="number" min="8" max="500" value={current.textStyle?.fontSize??32} onChange={e=>patch({textStyle:{...current.textStyle,fontSize:Number(e.target.value)}})}/></label><label className="field"><span>Cor</span><input className="input" type="color" value={current.textStyle?.color??"#111111"} onChange={e=>patch({textStyle:{...current.textStyle,color:e.target.value}})}/></label></>}
  </div>:<p className="muted">Selecione um elemento.</p>}</aside>
 </div>
}
