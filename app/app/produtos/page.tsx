import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireProfile();
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("id,ean,name,brand,specification,unit,sale_price,stock,active")
    .order("name", { ascending: true })
    .limit(100);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Produtos</h1>
          <div className="muted">Catálogo progressivo, ERP e imagens.</div>
        </div>
      </header>

      <section className="card">
        {error ? (
          <div className="error">Não foi possível carregar os produtos: {error.message}</div>
        ) : !products?.length ? (
          <div className="empty">Nenhum produto importado ainda.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>EAN</th>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th>Especificação</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.ean}</td>
                    <td>{product.name}</td>
                    <td>{product.brand || "—"}</td>
                    <td>{product.specification || product.unit || "—"}</td>
                    <td>
                      {product.sale_price == null
                        ? "—"
                        : new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(product.sale_price)}
                    </td>
                    <td>{product.stock ?? "—"}</td>
                    <td>
                      <span className="pill">{product.active ? "Ativo" : "Inativo"}</span>
                    </td>
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
