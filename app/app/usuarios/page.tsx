import { requireProfile, isAdmin} from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Page() {

  const profile = await requireProfile();
  if (!isAdmin(profile.role)) {
    redirect("/app");
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Usuários</h1>
          <div className="muted">Perfis, permissões e auditoria.</div>
        </div>
      </header>
      <section className="card">
        <div className="empty">Módulo preparado para a próxima etapa da migração.</div>
      </section>
    </>
  );
}
