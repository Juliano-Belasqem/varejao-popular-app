import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createProduct, toggleProductActive } from "./actions";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();

  let query = supabase
    .from("products")
    .select("id,ean,name,brand,specification,category,unit,sale_price,stock,active")
    .order("name", { ascending: true })
    .limit(100);

  if (q) {
    query = query.or(`ean.ilike.%${q}%,name.ilike.%${q}%,brand.ilike.%${q}%`);
  }

  const { data: products, error } = await query;
  const editable = canEdit(profile.role);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Produtos</h1>
          <div className="muted">Catálogo progressivo, ERP e imagens.</div>
        </div>
      </header>

      {editable && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Novo produto</h2>
          <form action={createProduct} className="form-grid">
            <label className="field"><span>EAN</span><input className="input" name="ean" required /></label>
            <label className="field"><span>Produto</span><input className="input" name="name" required /></label>
            <label className="field"><span>Marca</span><input className="input" name="brand" /></label>
            <label className="field"><span>Especificação</span><input className="input" name="specification" /></label>
            <label className="field"><span>Categoria</span><input className="input" name="category" /></label>
            <label className="field"><span>Unidade</span><input className="input" name="unit" /></label>
            <label className="field"><span>Preço de venda</span><input className="input" name="sale_price" inputMode="decimal" /></label>
            <label className="field"><span>Estoque</span><input className="input" name="stock" inputMode="decimal" /></label>
            <div className="form-actions"><button className="btn primary" type="submit">Cadastrar produto</button></div>
          </form>
        </section>
      )}

      <section className="card">
        <form method="get" className="search-row">
          <input className="input" name="q" defaultValue={q} placeholder="Buscar por EAN, produto ou marca" />
          <button className="btn" type="submit">Buscar</button>
        </form>

        {error ? (
          <div className="error">Não foi possível carregar os produtos: {error.message}</div>
        ) : !products?.length ? (
          <div className="empty">{q ? "Nenhum produto encontrado." : "Nenhum produto importado ainda."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>EAN</th><th>Produto</th><th>Marca</th><th>Especificação</th><th>Preço</th><th>Estoque</th><th>Status</th>{editable && <th>Ação</th>}</tr></thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.ean}</td><td>{product.name}</td><td>{product.brand || "—"}</td><td>{product.specification || product.unit || "—"}</td>
                    <td>{product.sale_price == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.sale_price)}</td>
                    <td>{product.stock ?? "—"}</td><td><span className="pill">{product.active ? "Ativo" : "Inativo"}</span></td>
                    {editable && <td><form action={toggleProductActive}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="active" value={String(product.active)} /><button className="btn" type="submit">{product.active ? "Desativar" : "Ativar"}</button></form></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
