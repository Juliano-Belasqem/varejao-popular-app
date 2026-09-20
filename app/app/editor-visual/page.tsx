import { canEdit, requireProfile } from "@/lib/auth";
import { VisualEngineEditor } from "@/components/visual-engine-editor";
import { loadVisualTemplate } from "./actions";

export default async function VisualEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; version?: string }>;
}) {
  const profile = await requireProfile(),
    params = await searchParams;
  let saved: Awaited<ReturnType<typeof loadVisualTemplate>> | undefined,
    error: string | undefined;
  if (params.template)
    try {
      saved = await loadVisualTemplate(
        params.template,
        params.version ? Number(params.version) : undefined,
      );
    } catch (e) {
      error = e instanceof Error ? e.message : "Falha ao abrir template.";
    }
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Motor Visual</h1>
          <div className="muted">
            Templates universais, pranchetas e componentes com histórico de
            versões.
          </div>
        </div>
      </header>
      {error ? (
        <section className="card" role="alert">
          {error}{" "}
          <a className="btn" href="/app/editor-visual">
            Novo template
          </a>
        </section>
      ) : (
        <VisualEngineEditor
          key={`${params.template ?? "new"}-${params.version ?? "latest"}`}
          initialDocument={saved?.document}
          initialTemplateId={saved?.template.id}
          initialVersion={saved?.version}
          initialCategory={saved?.template.category}
          editable={canEdit(profile.role)}
        />
      )}
    </>
  );
}
