import { createClient } from "@/lib/supabase/server";
import { ProduceTemplateGenerator } from "./produce-template-generator";

export default async function ProduceTemplatesPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("produce_template_products")
    .select("id,name,specification,unit,code")
    .eq("active", true)
    .order("name", { ascending: true });

  return <div>
    <header className="page-head no-print">
      <div><h1>Modelos Hortifrutti</h1><p className="muted" style={{margin:0}}>Monte uma folha A4 com quatro cartazes independentes para a fruteira.</p></div>
      <span className="pill">4 por folha</span>
    </header>
    {error ? <div className="error">O banco de hortifrutti ainda não está disponível. A migration deste patch precisa ser aplicada antes de usar o módulo.</div> : <ProduceTemplateGenerator products={products ?? []}/>}
  </div>;
}
