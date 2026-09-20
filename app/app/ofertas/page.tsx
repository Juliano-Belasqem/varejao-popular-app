import Link from "next/link";
import {canEdit,requireProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {createOffer,setOfferActive} from "./actions";

function price(value:number|null){return value==null?"—":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value)}
function date(value:string|null){return value?new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC"}).format(new Date(value+"T00:00:00Z")):"—"}

export default async function OffersPage(){
 const profile=await requireProfile(); const editable=canEdit(profile.role); const supabase=await createClient();
 const [{data:offers,error},{data:products},{data:campaigns},{data:images}]=await Promise.all([
  supabase.from("offers").select("id,product_id,campaign_id,normal_price,offer_price,unit,starts_on,ends_on,active,products(name,brand,specification),campaigns(name)").order("created_at",{ascending:false}).limit(250),
  supabase.from("products").select("id,ean,name,brand,unit,sale_price").eq("active",true).order("name").limit(1000),
  supabase.from("campaigns").select("id,name,start_date,end_date,status").neq("status","archived").order("created_at",{ascending:false}).limit(100),
  supabase.from("product_images").select("product_id").eq("approved",true).eq("is_primary",true),
 ]);
 const withImage=new Set((images??[]).map(i=>i.product_id));
 return <><header className="page-head"><div><h1>Central de Ofertas</h1><div className="muted">Fonte única para preço, período, campanha e materiais de cada oferta.</div></div></header>
 {editable&&<section className="card" style={{marginBottom:18}}><h2 style={{marginTop:0}}>Nova oferta</h2><form action={createOffer} className="form">
  <div className="form-grid compact"><label className="field"><span>Produto</span><select className="input" name="product_id" required defaultValue=""><option value="" disabled>Selecione</option>{(products??[]).map(p=><option key={p.id} value={p.id}>{p.ean} — {p.name}{p.brand?` — ${p.brand}`:""}</option>)}</select></label>
  <label className="field"><span>Campanha</span><select className="input" name="campaign_id" defaultValue=""><option value="">Sem campanha</option>{(campaigns??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
  <div className="form-grid compact"><label className="field"><span>Preço normal</span><input className="input" name="normal_price" inputMode="decimal"/></label><label className="field"><span>Preço oferta</span><input className="input" name="offer_price" inputMode="decimal" required/></label><label className="field"><span>Unidade</span><input className="input" name="unit" placeholder="UN"/></label><label className="field"><span>Início</span><input className="input" type="date" name="starts_on"/></label><label className="field"><span>Fim</span><input className="input" type="date" name="ends_on"/></label></div>
  <label className="field"><span>Observações</span><input className="input" name="notes"/></label><button className="btn primary">Criar oferta</button>
 </form></section>}
 <section className="card">{error?<div className="error">A Central de Ofertas será liberada após a migração desta versão.</div>:!offers?.length?<div className="empty">Nenhuma oferta cadastrada.</div>:<div style={{overflowX:"auto"}}><table className="table"><thead><tr><th>Produto</th><th>Imagem</th><th>Normal</th><th>Oferta</th><th>Período</th><th>Campanha</th><th>Status</th><th>Pendências</th><th></th></tr></thead><tbody>{offers.map((o:any)=>{const pending=[!withImage.has(o.product_id)&&"imagem",!o.starts_on&&"início",!o.ends_on&&"fim",!o.campaign_id&&"campanha"].filter(Boolean) as string[];return <tr key={o.id}><td><strong>{o.products?.name??"Produto"}</strong><div className="muted">{[o.products?.brand,o.products?.specification].filter(Boolean).join(" · ")}</div></td><td><span className="pill">{withImage.has(o.product_id)?"Com imagem":"Sem imagem"}</span></td><td>{price(o.normal_price)}</td><td><strong>{price(o.offer_price)}</strong>{o.unit?` /${o.unit}`:""}</td><td>{date(o.starts_on)} — {date(o.ends_on)}</td><td>{o.campaigns?.name??"—"}</td><td><span className="pill">{o.active?"Ativa":"Inativa"}</span></td><td>{pending.length?<span className="muted">{pending.join(" · ")}</span>:<span className="pill">Completa</span>}</td><td>{editable&&<form action={setOfferActive}><input type="hidden" name="id" value={o.id}/><input type="hidden" name="active" value={String(!o.active)}/><button className="btn">{o.active?"Desativar":"Ativar"}</button></form>}</td></tr>})}</tbody></table></div>}</section>
 <div style={{marginTop:12}} className="muted">A coluna de pendências destaca ofertas sem imagem, período completo ou campanha. Os materiais visuais serão ligados a esta oferta nas próximas etapas do motor. <Link href="/app/campanhas">Campanhas atuais continuam funcionando normalmente.</Link></div>
 </>;
}
