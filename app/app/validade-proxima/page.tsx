import { createClient } from "@/lib/supabase/server";
import { ValidityFlyerGenerator } from "./validity-flyer-generator";

export default async function ValidadeProximaPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id,ean,name,brand,specification,category,unit,sale_price")
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(500);

  return (
    <div>
      <header className="page-head no-print">
        <div>
          <h1>Validade Próxima</h1>
          <p className="muted" style={{ margin: 0 }}>
            Monte uma folha A4 com 4 ofertas para produtos próximos da validade.
          </p>
        </div>
        <span className="pill">Modelo oficial · 4 por folha</span>
      </header>
      <ValidityFlyerGenerator products={products ?? []} />
    </div>
  );
}
