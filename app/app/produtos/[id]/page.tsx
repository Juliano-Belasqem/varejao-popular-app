import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { removeProductImage, setPrimaryProductImage, uploadProductImage } from "../image-actions";

function money(value: number | null) {
  return value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const editable = canEdit(profile.role);
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product, error }, { data: images }] = await Promise.all([
    supabase.from("products").select("id,ean,name,brand,specification,category,unit,sale_price,stock,active,erp_description").eq("id", id).single(),
    supabase.from("product_images").select("id,storage_path,source,approved,is_primary,created_at").eq("product_id", id).order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  if (error || !product) notFound();

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
            <tr><th>EAN</th><td>{product.ean}</td></tr>
            <tr><th>Produto</th><td>{product.name}</td></tr>
            <tr><th>Marca</th><td>{product.brand || "—"}</td></tr>
            <tr><th>Especificação</th><td>{product.specification || "—"}</td></tr>
            <tr><th>Categoria</th><td>{product.category || "—"}</td></tr>
            <tr><th>Unidade</th><td>{product.unit || "—"}</td></tr>
            <tr><th>Preço ERP</th><td>{money(product.sale_price)}</td></tr>
            <tr><th>Estoque</th><td>{product.stock ?? "—"}</td></tr>
            <tr><th>Descrição ERP</th><td>{product.erp_description || "—"}</td></tr>
          </tbody></table>
        </section>

        {editable && (
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Adicionar imagem</h2>
            <p className="muted">Envie uma imagem aprovada do produto. A nova imagem passa a ser a principal automaticamente.</p>
            <form action={uploadProductImage} className="form">
              <input type="hidden" name="product_id" value={product.id} />
              <label className="field"><span>Imagem JPG, PNG ou WEBP</span><input className="input" type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
              <button className="btn primary" type="submit">Enviar imagem</button>
            </form>
          </section>
        )}
      </div>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 12 }}><div><h2 style={{ margin: 0 }}>Imagens do produto</h2><div className="muted">{signedImages.length} imagem(ns) cadastrada(s)</div></div></div>
        {!signedImages.length ? (
          <div className="empty">Nenhuma imagem aprovada para este produto ainda.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 16 }}>
            {signedImages.map((image) => (
              <article className="card" key={image.id} style={{ padding: 12 }}>
                <div style={{ aspectRatio: "1 / 1", background: "#fff", borderRadius: 10, overflow: "hidden", display: "grid", placeItems: "center" }}>
                  {image.signedUrl ? <img src={image.signedUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="muted">Imagem indisponível</span>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <div><span className="pill">{image.is_primary ? "Principal" : image.approved ? "Aprovada" : "Pendente"}</span><div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{image.source}</div></div>
                  {editable && <div style={{ display: "flex", gap: 6 }}>
                    {!image.is_primary && <form action={setPrimaryProductImage}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="image_id" value={image.id} /><button className="btn" type="submit">Principal</button></form>}
                    <form action={removeProductImage}><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="image_id" value={image.id} /><button className="btn danger" type="submit">Remover</button></form>
                  </div>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
