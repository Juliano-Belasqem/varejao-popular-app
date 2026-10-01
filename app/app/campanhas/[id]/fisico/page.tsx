import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CampaignPhysicalGenerator } from "./campaign-physical-generator";

export default async function CampaignPhysicalPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: campaign, error }, { data: items }] = await Promise.all([
    supabase.from("campaigns").select("id,name,start_date,end_date,theme").eq("id", id).single(),
    supabase.from("campaign_items").select("id,product_id,normal_price,offer_price,highlighted_price,ean_snapshot,name_snapshot,brand_snapshot,specification_snapshot,sort_order").eq("campaign_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  if (error || !campaign) notFound();
  const ids=[...new Set((items??[]).map(item=>item.product_id).filter((value):value is string=>!!value))];
  const {data:linkedProducts}=ids.length?await supabase.from("products").select("id,name,display_name,brand,specification").in("id",ids):{data:[]};
  const productById=new Map((linkedProducts??[]).map(product=>[product.id,product]));
  const physicalItems=(items??[]).map(item=>({...item,display_name:productById.get(item.product_id??"")?.display_name??null,full_name:productById.get(item.product_id??"")?.name??null,product_brand:productById.get(item.product_id??"")?.brand??null,product_specification:productById.get(item.product_id??"")?.specification??null}));

  return <>
    <header className="page-head no-print"><div><Link href={`/app/campanhas/${campaign.id}`} className="muted">← Voltar para campanha</Link><h1 style={{marginTop:8}}>Gerar material físico</h1><div className="muted">{campaign.name}</div></div><span className="pill">A4 · 1 ou 4 produtos</span></header>
    <CampaignPhysicalGenerator campaign={campaign} items={physicalItems}/>
  </>;
}