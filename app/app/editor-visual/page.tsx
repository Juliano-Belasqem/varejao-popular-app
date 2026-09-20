import {requireProfile} from "@/lib/auth";
import {createClient} from "@/lib/supabase/server";
import {VisualEngineEditor} from "@/components/visual-engine-editor";
import {validateVisualDocument,type VisualDocument} from "@/lib/visual-engine";

type SearchParams=Promise<{template?:string}>;

export default async function VisualEditorPage({searchParams}:{searchParams:SearchParams}){
  await requireProfile();
  const supabase=await createClient();
  const {template}=await searchParams;
  const {data:templates}=await supabase.from("visual_templates")
    .select("id,name,category,current_version,updated_at").eq("active",true)
    .order("updated_at",{ascending:false}).limit(100);

  let initialDocument:VisualDocument|undefined;
  let initialTemplateId:string|undefined;
  let initialVersion:number|undefined;
  if(template){
    const selected=(templates??[]).find(item=>item.id===template);
    if(selected){
      const {data:version}=await supabase.from("visual_template_versions")
        .select("version,document").eq("template_id",template)
        .eq("version",selected.current_version).maybeSingle();
      if(version?.document){
        try{
          initialDocument=validateVisualDocument(version.document);
          initialTemplateId=template;
          initialVersion=version.version;
        }catch{}
      }
    }
  }

  return <>
    <header className="page-head"><div><h1>Motor Visual</h1><div className="muted">Crie, salve e versione templates universais para os materiais do Varejão Popular.</div></div></header>
    <section className="card" style={{marginBottom:14}}>
      <strong>Templates salvos</strong>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
        <a className="btn" href="/app/editor-visual">+ Novo template</a>
        {(templates??[]).map(item=><a key={item.id} className="btn" href={`/app/editor-visual?template=${item.id}`}>{item.name} · v{item.current_version}</a>)}
      </div>
    </section>
    <VisualEngineEditor initialDocument={initialDocument} initialTemplateId={initialTemplateId} initialVersion={initialVersion}/>
  </>;
}
