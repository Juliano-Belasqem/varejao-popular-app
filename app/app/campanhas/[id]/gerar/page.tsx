import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import GeneratorClientOptimized from "./generator-client-optimized";
import OfficialTemplateGenerator from "./official-template-generator";

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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link className="btn primary" href={`/app/campanhas/${campaign.id}/publicar`}>Montar publicação</Link>
          <span className="pill">PNG + Publicações</span>
        </div>
      </header>

      {itemsError ? (
        <div className="error">Não foi possível carregar os itens da campanha.</div>
      ) : (
        <>
          <OfficialTemplateGenerator campaign={campaign} items={items ?? []} />

          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 800 }}>Abrir gerador legado / peças compostas</summary>
            <div className="muted" style={{ margin: "8px 0 16px" }}>
              Mantido para artes com 2 ou 4 produtos enquanto essas variações são adaptadas ao novo layout oficial.
            </div>
            <GeneratorClientOptimized campaign={campaign} items={items ?? []} />
          </details>
        </>
      )}
    </>
  );
}
