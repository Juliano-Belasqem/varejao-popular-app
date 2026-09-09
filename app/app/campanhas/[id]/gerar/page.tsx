import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function money(value: number | string | null) {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parsed);
}

function dateLabel(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

type Format = "feed" | "story";
type Quantity = 1 | 2 | 4;

export default async function DigitalGeneratorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ format?: string; qty?: string }>;
}) {
  await requireProfile();
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const format: Format = query.format === "story" ? "story" : "feed";
  const parsedQty = Number(query.qty);
  const qty: Quantity = parsedQty === 2 || parsedQty === 4 ? parsedQty : 1;
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

  const selectedItems = (items ?? []).slice(0, qty);
  const isStory = format === "story";
  const columns = qty === 1 ? 1 : 2;

  return (
    <>
      <header className="page-head">
        <div>
          <Link href={`/app/campanhas/${campaign.id}`} className="muted">← Voltar para campanha</Link>
          <h1 style={{ marginTop: 8 }}>Gerar material digital</h1>
          <div className="muted">{campaign.name}</div>
        </div>
        <span className="pill">MVP</span>
      </header>

      <div className="grid" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Configuração</h2>
          <form method="get" className="form">
            <label className="field">
              <span>Formato</span>
              <select className="input" name="format" defaultValue={format}>
                <option value="feed">Feed · 1080 × 1080</option>
                <option value="story">Story · 1080 × 1920</option>
              </select>
            </label>
            <label className="field">
              <span>Produtos por peça</span>
              <select className="input" name="qty" defaultValue={String(qty)}>
                <option value="1">1 produto</option>
                <option value="2">2 produtos</option>
                <option value="4">4 produtos</option>
              </select>
            </label>
            <button className="btn primary" type="submit">Atualizar prévia</button>
          </form>

          <div className="card" style={{ padding: 12, marginTop: 14 }}>
            <strong>Dados usados</strong>
            <div className="muted" style={{ marginTop: 6 }}>Imagem principal, nome, marca, especificação, preço normal e preço de oferta dos itens da campanha.</div>
          </div>

          {itemsError && <div className="error" style={{ marginTop: 12 }}>Não foi possível carregar os itens da campanha.</div>}
        </section>

        <section className="card">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Prévia</h2>
              <div className="muted">{isStory ? "Story 1080 × 1920" : "Feed 1080 × 1080"} · {qty} produto(s)</div>
            </div>
          </div>

          {!selectedItems.length ? (
            <div className="empty">Adicione produtos à campanha antes de gerar uma arte.</div>
          ) : (
            <div style={{ width: "100%", maxWidth: isStory ? 430 : 620, margin: "0 auto" }}>
              <div
                style={{
                  aspectRatio: isStory ? "9 / 16" : "1 / 1",
                  background: "linear-gradient(145deg,#0b3a78 0%,#1559a8 56%,#f7941d 56%,#f7a733 100%)",
                  borderRadius: 18,
                  padding: isStory ? "7% 6%" : "5%",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 18px 50px rgba(15,23,42,.18)",
                  overflow: "hidden",
                }}
              >
                <div style={{ color: "white", marginBottom: isStory ? 18 : 12 }}>
                  <div style={{ fontWeight: 900, letterSpacing: ".03em", fontSize: isStory ? 28 : 24 }}>VAREJÃO POPULAR</div>
                  <div style={{ fontSize: isStory ? 18 : 14, opacity: .92 }}>{campaign.theme || "OFERTAS"}</div>
                  {(campaign.start_date || campaign.end_date) && (
                    <div style={{ fontSize: 12, opacity: .82, marginTop: 4 }}>
                      {campaign.start_date ? `De ${dateLabel(campaign.start_date)}` : ""}{campaign.end_date ? ` até ${dateLabel(campaign.end_date)}` : ""}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap: isStory ? 14 : 12,
                    alignContent: "center",
                  }}
                >
                  {selectedItems.map((item) => {
                    const highlighted = item.highlighted_price === "normal" ? item.normal_price : item.offer_price;
                    const imageUrl = item.product_id ? `/api/product-image/${encodeURIComponent(item.product_id)}` : null;
                    return (
                      <article key={item.id} style={{ background: "rgba(255,255,255,.97)", borderRadius: 16, padding: isStory ? 16 : 12, display: "flex", flexDirection: "column", minHeight: 0 }}>
                        <div style={{ background: "white", borderRadius: 12, aspectRatio: "1 / 1", display: "grid", placeItems: "center", overflow: "hidden" }}>
                          {imageUrl ? (
                            <img src={imageUrl} alt={item.name_snapshot || "Produto"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : (
                            <span className="muted" style={{ fontSize: 12, textAlign: "center", padding: 8 }}>Sem imagem principal disponível</span>
                          )}
                        </div>
                        <div style={{ marginTop: 9, minHeight: qty === 4 ? 48 : 60 }}>
                          <div style={{ fontSize: qty === 4 ? 12 : 15, fontWeight: 900, lineHeight: 1.08, color: "#0f172a" }}>{item.name_snapshot || "Produto"}</div>
                          {(item.brand_snapshot || item.specification_snapshot) && <div style={{ fontSize: qty === 4 ? 10 : 12, color: "#64748b", marginTop: 3 }}>{[item.brand_snapshot, item.specification_snapshot].filter(Boolean).join(" · ")}</div>}
                        </div>
                        <div style={{ marginTop: "auto" }}>
                          {item.normal_price != null && item.offer_price != null && Number(item.normal_price) !== Number(item.offer_price) && (
                            <div style={{ color: "#64748b", fontSize: qty === 4 ? 9 : 11, textDecoration: "line-through" }}>De {money(item.normal_price)}</div>
                          )}
                          <div style={{ color: "#e66c00", fontWeight: 950, fontSize: qty === 4 ? 22 : isStory ? 36 : 30, letterSpacing: "-.04em", lineHeight: 1 }}>{money(highlighted)}</div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div style={{ color: "white", fontSize: 10, marginTop: isStory ? 18 : 12, opacity: .8 }}>Ofertas válidas enquanto durarem os estoques.</div>
              </div>
            </div>
          )}

          <div className="muted" style={{ marginTop: 14 }}>A imagem agora é carregada por uma rota isolada. Se uma imagem falhar, a prévia continua funcionando.</div>
        </section>
      </div>
    </>
  );
}
