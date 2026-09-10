import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const actionLabels: Record<string, string> = {
  publication_bulk_cancelled: "Cancelada em lote",
  publication_bulk_deleted: "Excluída em lote",
  publication_bulk_retry: "Nova tentativa em lote",
  meta_token_warning: "Alerta do token Meta",
};

function dateLabel(value: string) {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default async function PublicationHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: publication }, { data: logs, error }] = await Promise.all([
    supabase.from("publications").select("id,network,type,status,caption,created_at,updated_at,published_at,scheduled_at,error_message").eq("id", id).maybeSingle(),
    supabase.from("audit_logs").select("id,actor_id,action,details,created_at").eq("entity_type", "publication").eq("entity_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  if (!publication) notFound();

  const syntheticEvents = [
    { id: "created", label: "Publicação criada", created_at: publication.created_at, details: null },
    publication.scheduled_at ? { id: "scheduled", label: "Agendamento atual", created_at: publication.scheduled_at, details: null } : null,
    publication.published_at ? { id: "published", label: "Publicada", created_at: publication.published_at, details: null } : null,
  ].filter(Boolean) as Array<{ id: string; label: string; created_at: string; details: null }>;

  return (
    <>
      <header className="page-head">
        <div>
          <Link href={`/app/publicacoes/${publication.id}`} className="muted">← Voltar para publicação</Link>
          <h1 style={{ marginTop: 8 }}>Histórico da publicação</h1>
          <div className="muted">Eventos operacionais e registros de auditoria.</div>
        </div>
        <span className="pill">{publication.status}</span>
      </header>

      <section className="card" style={{ maxWidth: 900 }}>
        {error ? (
          <div className="error">Não foi possível carregar os registros de auditoria.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {syntheticEvents.map((event) => (
              <div key={event.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <strong>{event.label}</strong>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{dateLabel(event.created_at)}</div>
              </div>
            ))}
            {(logs ?? []).map((log) => (
              <div key={log.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                <strong>{actionLabels[log.action] ?? log.action}</strong>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{dateLabel(log.created_at)}</div>
                {log.details && Object.keys(log.details).length > 0 ? (
                  <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{JSON.stringify(log.details, null, 2)}</pre>
                ) : null}
              </div>
            ))}
            {!syntheticEvents.length && !(logs ?? []).length ? <div className="empty">Nenhum evento registrado.</div> : null}
          </div>
        )}
      </section>
    </>
  );
}
