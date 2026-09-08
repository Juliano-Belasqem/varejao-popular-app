import { requireProfile} from "@/lib/auth";

export default async function Page() {

  await requireProfile();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Campanhas</h1>
          <div className="muted">Campanhas e ofertas do supermercado.</div>
        </div>
      </header>
      <section className="card">
        <div className="empty">Módulo preparado para a próxima etapa da migração.</div>
      </section>
    </>
  );
}
