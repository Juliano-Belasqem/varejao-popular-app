import Link from "next/link";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  addErpProductToCatalog,
  createProduct,
  importErpSpreadsheet,
  toggleProductActive,
} from "./actions";

function money(value: number | null) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; erp_q?: string; import_ok?: string; import_error?: string }>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();
  const erpQ = (params.erp_q ?? "").trim();
  const importOk = (params.import_ok ?? "").trim();
  const importError = (params.import_error ?? "").trim();
  const editable = canEdit(profile.role);

  let catalogQuery = supabase
    .from("products")
    .select("id,ean,name,brand,specification,category,unit,sale_price,stock,active")
    .order("name", { ascending: true })
    .limit(100);

  if (q) catalogQuery = catalogQuery.or(`ean.ilike.%${q}%,name.ilike.%${q}%,brand.ilike.%${q}%`);

  let erpQuery = supabase
    .from("erp_products")
    .select("code,description,sale_price,stock,unit,code_type,gtin_valid,search_image,updated_at")
    .order("description", { ascending: true })
    .limit(100);

  if (erpQ) erpQuery = erpQuery.or(`code.ilike.%${erpQ}%,description.ilike.%${erpQ}%`);
  else erpQuery = erpQuery.limit(20);

  const [
    { data: products, error },
    { data: erpProducts, error: erpError },
    { count: erpCount },
    { count: validGtinCount },
  ] = await Promise.all([
    catalogQuery,
    erpQuery,
    supabase.from("erp_products").select("code", { count: "exact", head: true }),
    supabase.from("erp_products").select("code", { count: "exact", head: true }).eq("gtin_valid", true),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Produtos</h1>
          <div className="muted">Catálogo progressivo, ERP e imagens.</div>
        </div>
      </header>

      {importOk && <div className="card" style={{ marginBottom: 16 }}><strong>{importOk}</strong></div>}
      {importError && <div className="error" style={{ marginBottom: 16 }}>Falha ao sincronizar ERP: {importError}</div>}

      {editable && (
        <div className="grid" style={{ marginBottom: 16 }}>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Sincronizar ERP</h2>
            <p className="muted">Importe a planilha do ERP. Registros existentes são atualizados e os que não aparecem mais na nova planilha são removidos da base de referência.</p>
            <form action={importErpSpreadsheet} className="form">
              <label className="field">
                <span>Planilha XLSX/XLS</span>
                <input className="input" type="file" name="file" accept=".xlsx,.xls" required />
              </label>
              <button className="btn primary" type="submit">Sincronizar ERP</button>
            </form>
            <div className="muted" style={{ marginTop: 12 }}>
              Base ERP: <strong>{erpCount ?? 0}</strong> produtos · GTIN válidos: <strong>{validGtinCount ?? 0}</strong>
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Novo produto manual</h2>
            <form action={createProduct} className="form-grid compact">
              <label className="field"><span>EAN</span><input className="input" name="ean" required /></label>
              <label className="field"><span>Produto</span><input className="input" name="name" required /></label>
              <label className="field"><span>Marca</span><input className="input" name="brand" /></label>
              <label className="field"><span>Especificação</span><input className="input" name="specification" /></label>
              <label className="field"><span>Categoria</span><input className="input" name="category" /></label>
              <label className="field"><span>Unidade</span><input className="input" name="unit" /></label>
              <label className="field"><span>Preço</span><input className="input" name="sale_price" inputMode="decimal" /></label>
              <label className="field"><span>Estoque</span><input className="input" name="stock" inputMode="decimal" /></label>
              <div className="form-actions"><button className="btn primary" type="submit">Cadastrar produto</button></div>
            </form>
          </section>
        </div>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Base do ERP</h2>
            <div className="muted">Pesquise no cadastro completo e adicione ao catálogo somente o que for usado.</div>
          </div>
        </div>
        <form method="get" className="search-row">
          <input className="input" name="erp_q" defaultValue={erpQ} placeholder="Buscar código ou descrição do ERP" />
          <button className="btn" type="submit">Buscar ERP</button>
        </form>
        {erpError ? (
          <div className="error">Não foi possível carregar a base do ERP: {erpError.message}</div>
        ) : !erpProducts?.length ? (
          <div className="empty">{erpQ ? "Nenhum item encontrado no ERP." : "A base do ERP ainda não foi sincronizada."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Código</th><th>Descrição ERP</th><th>Preço</th><th>Estoque</th><th>Unidade</th><th>GTIN</th>{editable && <th>Ação</th>}</tr></thead>
              <tbody>
                {erpProducts.map((item) => (
                  <tr key={item.code}>
                    <td>{item.code}</td>
                    <td>{item.description}</td>
                    <td>{money(item.sale_price)}</td>
                    <td>{item.stock ?? "—"}</td>
                    <td>{item.unit || "—"}</td>
                    <td><span className="pill">{item.gtin_valid === true ? "Válido" : item.gtin_valid === false ? "Não GTIN" : "—"}</span></td>
                    {editable && (
                      <td>
                        <form action={addErpProductToCatalog}>
                          <input type="hidden" name="code" value={item.code} />
                          <button className="btn" type="submit">Adicionar ao catálogo</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0 }}>Catálogo de ofertas</h2>
            <div className="muted">Produtos já preparados para campanhas, imagens e materiais.</div>
          </div>
        </div>
        <form method="get" className="search-row">
          <input className="input" name="q" defaultValue={q} placeholder="Buscar por EAN, produto ou marca" />
          <button className="btn" type="submit">Buscar catálogo</button>
        </form>

        {error ? (
          <div className="error">Não foi possível carregar os produtos: {error.message}</div>
        ) : !products?.length ? (
          <div className="empty">{q ? "Nenhum produto encontrado." : "Nenhum produto no catálogo ainda."}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>EAN</th><th>Produto</th><th>Marca</th><th>Especificação</th><th>Preço</th><th>Estoque</th><th>Status</th>{editable && <th>Ação</th>}</tr></thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.ean}</td><td><Link href={`/app/produtos/${product.id}`} style={{ fontWeight: 700 }}>{product.name}</Link></td><td>{product.brand || "—"}</td><td>{product.specification || product.unit || "—"}</td>
                    <td>{money(product.sale_price)}</td>
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
