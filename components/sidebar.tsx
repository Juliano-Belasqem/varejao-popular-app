import Link from "next/link";
import type { CurrentProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";

const links = [
  ["Visão geral", "/app"],
  ["Campanhas", "/app/campanhas"],
  ["Produtos", "/app/produtos"],
  ["Validade Próxima", "/app/validade-proxima"],
  ["Conteúdo para Redes", "/app/conteudo-redes"],
  ["Publicações", "/app/publicacoes"],
  ["Usuários", "/app/usuarios"],
];

export function Sidebar({ profile }: { profile: CurrentProfile }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        Varejão <span>Popular</span>
      </div>

      <nav className="nav">
        {links.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-user">
        <strong>{profile.full_name || profile.email}</strong>
        <small>{profile.role}</small>
        <form action={logout} style={{ marginTop: 12 }}>
          <button className="btn" type="submit">
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
