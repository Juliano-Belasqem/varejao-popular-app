import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import GeneratorClientOptimized from "./generator-client-optimized";

export default async function DigitalGeneratorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: campaign, error: campaignError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("campaigns").select("id,name,start_date,end_date,theme,status").eq("id", id).single(),
    supabase
      .from("campaign_items")
      .select("id,product_id,normal_price,offer_price,highlighted_price,sort_order,ean_snapshot,name_snapshot,brand_snapshot,specification_snapshot")
      .eq("campaign_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (campaignError || !campaign) notFound();

  return (
    <>
      <header className="page-head">
        <div>
          <Link href={`/app/campanhas/${campaign.id}`} className="muted">← Voltar para campanha</Link>
          <h1 style={{ marginTop: 8 }}>Gerar material digital</h1>
          <div className="muted">{campaign.name}</div>
        </div>
        <span className="pill">PNG + Publicações</span>
      </header>

      {itemsError ? (
        <div className="error">Não foi possível carregar os itens da campanha.</div>
      ) : (
        <GeneratorClientOptimized campaign={campaign} items={items ?? []} />
      )}
    </>
  );
}
