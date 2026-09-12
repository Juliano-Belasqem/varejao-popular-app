"use client";

import { useEffect, useMemo, useState } from "react";

type FontItem = { id:string; name:string; family:string; url:string|null };
type BrandPayload = {
  settings?: { logo_url?:string|null; field_fonts?:Record<string,string> };
  fonts?: FontItem[];
  error?: string;
};

const fields = [
  ["title","Título"],
  ["product","Produto / tipo"],
  ["brand","Marca"],
  ["specification","Especificação"],
  ["price","Preço"],
  ["validity","Validade / destaque"],
  ["body","Texto principal"],
  ["footer","Rodapé"],
] as const;

const defaults = Object.fromEntries(fields.map(([key])=>[key,"Arial, sans-serif"]));

export function BrandKitClient(){
  const [logo,setLogo]=useState<string|null>(null);
  const [fonts,setFonts]=useState<FontItem[]>([]);
  const [fieldFonts,setFieldFonts]=useState<Record<string,string>>(defaults);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState<string|null>(null);

  async function load(){
    const response=await fetch("/api/brand-kit",{cache:"no-store"});
    const data=await response.json() as BrandPayload;
    if(!response.ok) throw new Error(data.error||"Falha ao carregar Kit da Marca.");
    setLogo(data.settings?.logo_url??null);
    setFonts(data.fonts??[]);
    setFieldFonts({...defaults,...(data.settings?.field_fonts??{})});
    for(const font of data.fonts??[]){
      if(!font.url) continue;
      try{
        const face=new FontFace(font.family,`url(${font.url})`);
        await face.load();
        document.fonts.add(face);
      }catch{}
    }
  }

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:"Falha ao carregar."))},[]);

  const options=useMemo(()=>[{family:"Arial, sans-serif",name:"Arial · padrão"},...fonts.map(font=>({family:font.family,name:font.name}))],[fonts]);

  async function upload(kind:"logo"|"font",file:File,name?:string){
    setBusy(true);setStatus(kind==="logo"?"Enviando logo...":"Enviando fonte...");
    try{
      const form=new FormData();form.append("kind",kind);form.append("file",file);if(name)form.append("name",name);
      const response=await fetch("/api/brand-kit",{method:"POST",body:form});
      const data=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(data.error||"Falha no upload.");
      await load();setStatus(kind==="logo"?"Logo atualizado.":"Fonte adicionada.");
    }catch(error){setStatus(error instanceof Error?error.message:"Falha no upload.")}finally{setBusy(false)}
  }

  async function saveFonts(){
    setBusy(true);setStatus("Salvando tipografia...");
    try{
      const response=await fetch("/api/brand-kit",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({field_fonts:fieldFonts})});
      const data=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(data.error||"Falha ao salvar.");
      setStatus("Tipografia salva. Os geradores podem usar esses padrões.");
    }catch(error){setStatus(error instanceof Error?error.message:"Falha ao salvar.")}finally{setBusy(false)}
  }

  async function removeFont(id:string){
    if(!confirm("Remover esta fonte do Kit da Marca? Os campos que a usam voltarão para Arial."))return;
    setBusy(true);setStatus("Removendo fonte...");
    try{
      const response=await fetch("/api/brand-kit",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
      const data=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(data.error||"Falha ao remover.");
      await load();setStatus("Fonte removida.");
    }catch(error){setStatus(error instanceof Error?error.message:"Falha ao remover.")}finally{setBusy(false)}
  }

  return <div className="grid" style={{alignItems:"start"}}>
    <section className="card">
      <small className="eyebrow">LOGOTIPO</small><h2>Assinatura da marca</h2>
      <div style={{display:"grid",gap:14}}>
        <div style={{minHeight:160,border:"1px dashed #475569",borderRadius:16,display:"grid",placeItems:"center",padding:18,background:"rgba(255,255,255,.04)"}}>
          {logo?<img src={logo} alt="Logo Varejão Popular" style={{maxWidth:"100%",maxHeight:150,objectFit:"contain"}}/>:<div className="brand-logo-demo">VP</div>}
        </div>
        <label className="btn" style={{textAlign:"center",cursor:"pointer",opacity:busy?.65:1}}>
          {logo?"Substituir logo":"Adicionar logo"}
          <input hidden type="file" accept="image/png,image/webp,image/svg+xml" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void upload("logo",file)}}/>
        </label>
        <p className="muted" style={{margin:0}}>PNG, WebP ou SVG. O arquivo fica no armazenamento do projeto e pode ser trocado sem novo deployment.</p>
      </div>
    </section>

    <section className="card">
      <small className="eyebrow">FONTES</small><h2>Biblioteca tipográfica</h2>
      <div style={{display:"grid",gap:10}}>
        {fonts.map(font=><div key={font.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(148,163,184,.18)"}}>
          <div><strong style={{fontFamily:font.family,fontSize:22}}>Aa · Varejão Popular</strong><div className="muted" style={{fontSize:12}}>{font.name}</div></div>
          <button type="button" className="btn" disabled={busy} onClick={()=>void removeFont(font.id)}>Remover</button>
        </div>)}
        {!fonts.length?<p className="muted">Nenhuma fonte personalizada adicionada ainda.</p>:null}
        <label className="btn primary" style={{textAlign:"center",cursor:"pointer"}}>+ Adicionar fonte<input hidden type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(!file)return;const name=prompt("Nome para identificar esta fonte:",file.name.replace(/\.[^.]+$/, ""))?.trim();if(name)void upload("font",file,name)}}/></label>
      </div>
    </section>

    <section className="card" style={{gridColumn:"1 / -1"}}>
      <small className="eyebrow">TIPOGRAFIA POR CAMPO</small><h2>Fonte padrão de cada elemento</h2>
      <p className="muted">Defina a fonte que os geradores devem usar por padrão em cada parte da arte.</p>
      <div className="form-grid compact">
        {fields.map(([key,label])=><label className="field" key={key}><span>{label}</span><select className="input" value={fieldFonts[key]??"Arial, sans-serif"} onChange={event=>setFieldFonts(old=>({...old,[key]:event.target.value}))}>{options.map(option=><option key={option.family} value={option.family}>{option.name}</option>)}</select><small style={{fontFamily:fieldFonts[key],fontSize:18,marginTop:6}}>Exemplo de texto</small></label>)}
      </div>
      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}><button className="btn primary" type="button" disabled={busy} onClick={()=>void saveFonts()}>Salvar tipografia</button><button className="btn" type="button" disabled={busy} onClick={()=>setFieldFonts(defaults)}>Restaurar Arial</button></div>
      {status?<div className={status.toLowerCase().includes("falha")||status.toLowerCase().includes("erro")?"error":"muted"} style={{marginTop:12}}>{status}</div>:null}
    </section>
  </div>
}
