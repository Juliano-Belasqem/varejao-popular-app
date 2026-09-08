import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { importOpenFactsImage, importSerpApiImage, removeProductImage, setPrimaryProductImage, uploadProductImage } from "../image-actions";
import { GoogleImageSearchForm } from "./google-image-search-form";

function money(value: number | null) {
  return value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

type OpenFactsCandidate = {
  imageUrl: string | null;
  productName: string | null;
  brands: string | null;
  error: string | null;
};

type GoogleImageCandidate = {
  original: string;
  thumbnail: string;
  title: string;
  source: string;
  link: string;
  width: number | null;
  height: number | null;
};

type GoogleImageSearch = {
  results: GoogleImageCandidate[];
  error: string | null;
};

type GoogleImageFilters = {
  transparent: boolean;
  type: string;
  ratio: string;
  size: string;
};

async function findOpenFactsImage(ean: string): Promise<OpenFactsCandidate> {
  const code = ean.replace(/\D/g, "");
  if (!code) return { imageUrl: null, productName: null, brands: null, error: "O produto não possui um EAN válido para pesquisa." };

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}?fields=code,product_name,brands,image_front_url,image_url`,
      {
        cache: "no-store",
        headers: {
          "User-Agent": "VarejaoPopularOffers/0.1 (https://varejao-popular-app.vercel.app)",
          Accept: "application/json",
        },
      },
    );

    if (response.status === 404) return { imageUrl: null, productName: null, brands: null, error: "Produto não encontrado no Open Food Facts." };
    if (!response.ok) return { imageUrl: null, productName: null, brands: null, error: `Open Food Facts respondeu com status ${response.status}.` };

    const payload = await response.json() as { product?: { product_name?: string; brands?: string; image_front_url?: string; image_url?: string } };
    const candidate = payload.product;
    if (!candidate) return { imageUrl: null, productName: null, brands: null, error: "Produto não encontrado no Open Food Facts." };

    const imageUrl = candidate.image_front_url || candidate.image_url || null;
    if (!imageUrl) {
      return { imageUrl: null, productName: candidate.product_name || null, brands: candidate.brands || null, error: "O produto foi encontrado no Open Food Facts, mas não possui imagem disponível." };
    }

    return { imageUrl, productName: candidate.product_name || null, brands: candidate.brands || null, error: null };
  } catch {
    return { imageUrl: null, productName: null, brands: null, error: "Não foi possível consultar o Open Food Facts agora." };
  }
}

async function findGoogleImages(query: string, filters: GoogleImageFilters): Promise<GoogleImageSearch> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return { results: [], error: "A busca do Google Imagens ainda não está configurada. Falta a chave da SerpApi no servidor." };
  const cleanQuery = query.trim();
  if (!cleanQuery) return { results: [], error: "Informe um termo para pesquisar imagens." };

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_images");
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("gl", "br");
    url.searchParams.set("hl", "pt-br");
    url.searchParams.set("google_domain", "google.com.br");
    url.searchParams.set("safe", "active");
    if (filters.transparent) url.searchParams.set("image_color", "trans");
    if (["photo", "clipart"].includes(filters.type)) url.searchParams.set("image_type", filters.type);
    if (["s", "t", "w"].includes(filters.ratio)) url.searchParams.set("imgar", filters.ratio);
    if (["m", "l"].includes(filters.size)) url.searchParams.set("imgsz", filters.size);
    url.searchParams.set("api_key", apiKey);

    const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return { results: [], error: `SerpApi respondeu com status ${response.status}.` };

    const payload = await response.json() as {
      error?: string;
      images_results?: Array<{
        original?: string;
        thumbnail?: string;
        title?: string;
        source?: string;
        link?: string;
        original_width?: number;
        original_height?: number;
      }>;
    };
    if (payload.error) return { results: [], error: payload.error };

    const results = (payload.images_results ?? [])
      .filter((item) => item.original?.startsWith("https://") && item.thumbnail?.startsWith("https://"))
      .slice(0, 12)
      .map((item) => ({
        original: item.original!,
        thumbnail: item.thumbnail!,
        title: item.title || "Imagem do produto",
        source: item.source || "Google Imagens",
        link: item.link || "",
        width: item.original_width ?? null,
        height: item.original_height ?? null,
      }));

    return results.length ? { results, error: null } : { results: [], error: "Nenhuma imagem compatível foi encontrada." };
  } catch {
    return { results: [], error: "Não foi possível consultar o Google Imagens agora." };
  }
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    image_source?: string;
    image_q?: string;
    image_trans?: string;
    image_type?: string;
    image_ratio?: string;
    image_size?: string;
  }>;
}) {
  const profile = await requireProfile();
  const editable = canEdit(profile.role);
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const supabase = await createClient();

  const [{ data: product, error }, { data: images }] = await Promise.all([
    supabase.from("products").select("id,ean,name,brand,specification,category,unit,sale_price,stock,active,erp_description").eq("id", id).single(),
    supabase.from("product_images").select("id,storage_path,source,source_url,approved,is_primary,created_at").eq("product_id", id).order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  if (error || !product) notFound();

  const defaultGoogleQuery = [product.ean, product.name, product.brand, product.specification].filter(Boolean).join(" ");
  const googleQuery = (query.image_q || defaultGoogleQuery).trim();
  const googleFilters: GoogleImageFilters = {
    transparent: query.image_trans === "1",
    type: query.image_type || "",
    ratio: query.image_ratio || "",
    size: query.image_size || "",
  };
  const openFacts = editable && query.image_source === "open_facts" ? await findOpenFactsImage(product.ean) : null;
  const googleImages = editable && query.image_source === "google_images" ? await findGoogleImages(googleQuery, googleFilters) : null;

  const signedImages = await Promise.all((images ?? []).map(async (image) => {
    const { data } = await supabase.storage.from("product-images").createSignedUrl(image.storage_path, 3600);
    return { ...image, signedUrl: data?.signedUrl ?? null };
  }));

  return (
    <>
      <header className="page-head">
        <div>
          <Link href="/app/produtos" className="muted">← Produtos</Link>
          <h1 style={{ marginTop: 8 }}>{product.name}</h1>
          <div className="muted">EAN {product.ean}{product.brand ? ` · ${product.brand}` : ""}</div>
        </div>
        <span className="pill">{product.active ? "Ativo" : "Inativo"}</span>
      </header>

      <div className="grid" style={{ marginBottom: 16 }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Cadastro</h2>
          <table className="table"><tbody>
            <tr><th>EAN</th><td>{product.ean}</td></tr><tr><th>Produto</th><td>{product.name}</td></tr><tr><th>Marca</th><td>{product.brand || "—"}</td></tr><tr><th>Especificação</th><td>{product.specification || "—"}</td></tr><tr><th>Categoria</th><td>{product.category || "—"}</td></tr><tr><th>Unidade</th><td>{product.unit || "—"}</td></tr><tr><th>Preço ERP</th><td>{money(product.sale_price)}</td></tr><tr><th>Estoque</th><td>{product.stock ?? "—"}</td></tr><tr><th>Descrição ERP</th><td>{product.erp_description || "—"}</td></tr>
          </tbody></table>
        </section>

        {editable && (
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Buscar imagem</h2>
            <p className="muted">Fluxo: catálogo próprio → Open Food Facts → Google Imagens → Meu acervo.</p>
            {signedImages.length > 0 ? <div className="card" style={{ padding: 12, marginBottom: 12 }}><strong>Catálogo próprio</strong><div className="muted" style={{ marginTop: 4 }}>{signedImages.length} imagem(ns) já vinculada(s) a este produto.</div></div> : null}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, alignItems: "start" }}>
              <form method="get"><input type="hidden" name="image_source" value="open_facts" /><button className="btn primary" type="submit">Buscar no Open Food Facts</button></form>
              <GoogleImageSearchForm
                defaultQuery={googleQuery}
                initialTransparent={googleFilters.transparent}
                initialType={googleFilters.type}
                initialRatio={googleFilters.ratio}
                initialSize={googleFilters.size}
              />
            </div>
            {openFacts?.error && <div className="error">{openFacts.error}</div>}
            {openFacts?.imageUrl && <div className="card" style={{ padding: 12 }}><div style={{ aspectRatio: "1 / 1", background: "#fff", borderRadius: 10, overflow: "hidden", display: "grid", placeItems: "center", maxWidth: 320 }}><img src={openFacts.imageUrl} alt={openFacts.productName || product.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div><div style={{ marginTop: 10 }}><strong>{openFacts.productName || product.name}</strong>{openFacts.brands ? <div className="muted" style={{ marginTop: 4 }}>Marca no Open Food Facts: {openFacts.brands}</div> : null}<div className="muted" style={{ marginTop: 4 }}>A imagem só entra no catálogo depois que você confirmar.</div></div><form action={importOpenFactsImage} style={{ marginTop: 10 }}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="source_url" value={openFacts.imageUrl} /><button className="btn primary" type="submit">Usar esta imagem</button></form></div>}
          </section>
        )}
      </div>

      {editable && googleImages && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="page-head" style={{ marginBottom: 12 }}><div><h2 style={{ margin: 0 }}>Resultados do Google Imagens</h2><div className="muted">Pesquisa: {googleQuery}{googleFilters.transparent ? " · fundo transparente" : ""}</div></div></div>
          {googleImages.error ? <div className="error">{googleImages.error}</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
              {googleImages.results.map((candidate, index) => (
                <article className="card" key={`${candidate.original}-${index}`} style={{ padding: 10 }}>
                  <div style={{ aspectRatio: "1 / 1", background: "#fff", borderRadius: 10, overflow: "hidden", display: "grid", placeItems: "center" }}><img src={candidate.thumbnail} alt={candidate.title} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
                  <div style={{ marginTop: 8, minHeight: 58 }}><strong style={{ display: "block", fontSize: 13 }}>{candidate.title}</strong><div className="muted" style={{ marginTop: 3, fontSize: 12 }}>{candidate.source}{candidate.width && candidate.height ? ` · ${candidate.width}×${candidate.height}` : ""}</div></div>
                  <form action={importSerpApiImage} style={{ marginTop: 8 }}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="source_url" value={candidate.original} /><button className="btn primary" type="submit">Usar esta imagem</button></form>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {editable && <section className="card" style={{ marginBottom: 16 }}><h2 style={{ marginTop: 0 }}>Meu acervo</h2><p className="muted">Envie uma imagem JPG, PNG ou WEBP que você já possui. A nova imagem aprovada passa a ser a principal automaticamente.</p><form action={uploadProductImage} className="form"><input type="hidden" name="product_id" value={product.id} /><label className="field"><span>Imagem JPG, PNG ou WEBP</span><input className="input" type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label><button className="btn primary" type="submit">Enviar imagem</button></form></section>}

      <section className="card">
        <div className="page-head" style={{ marginBottom: 12 }}><div><h2 style={{ margin: 0 }}>Imagens do produto</h2><div className="muted">{signedImages.length} imagem(ns) cadastrada(s)</div></div></div>
        {!signedImages.length ? <div className="empty">Nenhuma imagem aprovada para este produto ainda.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 16 }}>{signedImages.map((image) => <article className="card" key={image.id} style={{ padding: 12 }}><div style={{ aspectRatio: "1 / 1", background: "#fff", borderRadius: 10, overflow: "hidden", display: "grid", placeItems: "center" }}>{image.signedUrl ? <img src={image.signedUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="muted">Imagem indisponível</span>}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}><div><span className="pill">{image.is_primary ? "Principal" : image.approved ? "Aprovada" : "Pendente"}</span><div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{image.source}</div></div>{editable && <div style={{ display: "flex", gap: 6 }}>{!image.is_primary && <form action={setPrimaryProductImage}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="image_id" value={image.id} /><button className="btn" type="submit">Principal</button></form>}<form action={removeProductImage}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="image_id" value={image.id} /><button className="btn danger" type="submit">Remover</button></form></div>}</div></article>)}</div>}
      </section>
    </>
  );
}
