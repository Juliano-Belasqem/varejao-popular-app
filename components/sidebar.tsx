"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { CurrentProfile } from "@/lib/auth";
import { logout } from "@/app/login/actions";

const links = [
  ["⌂", "Visão geral", "/app"],
  ["◆", "Campanhas", "/app/campanhas"],
  ["%", "Central de Ofertas", "/app/ofertas"],
  ["✦", "Motor Visual", "/app/editor-visual"],
  ["▦", "Produtos", "/app/produtos"],
  ["!", "Validade Próxima", "/app/validade-proxima"],
  ["#", "Conteúdo para Redes", "/app/conteudo-redes"],
  ["◈", "Kit da Marca", "/app/marca"],
  ["↗", "Publicações", "/app/publicacoes"],
  ["●", "Usuários", "/app/usuarios"],
] as const;

export function Sidebar({ profile }: { profile: CurrentProfile }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try { setCollapsed(localStorage.getItem("vp:sidebar-collapsed") === "1"); } catch {}
  }, []);

  function toggle() {
    setCollapsed((value) => {
      const next = !value;
      try { localStorage.setItem("vp:sidebar-collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  return <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
    <div className="sidebar-head">
      <div className="brand" aria-label="Varejão Popular"><span className="brand-full">Varejão <b>Popular</b></span><span className="brand-compact" aria-hidden="true">VP</span></div>
      <button className="sidebar-toggle" type="button" onClick={toggle} aria-label={collapsed ? "Expandir menu principal" : "Recolher menu principal"} aria-expanded={!collapsed} title={collapsed ? "Expandir menu principal" : "Recolher menu principal"}>{collapsed ? "›" : "‹"}</button>
    </div>
    <nav className="nav" aria-label="Módulos principais">{links.map(([icon, label, href]) => {
      const active = href === "/app" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><span className="nav-label">{label}</span></Link>;
    })}</nav>
    <div className="sidebar-user"><strong>{profile.full_name || profile.email}</strong><small>{profile.role}</small><form action={logout} style={{ marginTop: 12 }}><button className="btn" type="submit">Sair</button></form></div>
  </aside>;
}
