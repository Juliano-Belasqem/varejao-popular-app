import { requireProfile} from "@/lib/auth";

export default async function Page() {

  await requireProfile();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Produtos</h1>
          <div className="muted">Catálogo progressivo, ERP e imagens.</div>
        </div>
      </header>
      <section className="card">
        <div className="empty">Módulo preparado para a próxima etapa da migração.</div>
      </section>
    </>
  );
}
