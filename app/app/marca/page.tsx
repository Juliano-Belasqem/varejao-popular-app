import { canEdit, requireProfile } from "@/lib/auth";
import Link from "next/link";
import { BrandKitClient } from "./brand-kit-client";

export default async function BrandKitPage() {
  const profile = await requireProfile();
  return (
    <div>
      <header className="page-head">
        <div>
          <Link href="/app" className="muted">
            ← Visão geral
          </Link>
          <h1>Kit da Marca</h1>
          <p className="muted" style={{ margin: 0 }}>
            Centralize logo e tipografia usados pelos geradores de arte.
          </p>
        </div>
        <span className="pill">Varejão Popular</span>
      </header>
      <BrandKitClient editable={canEdit(profile.role)} />
      <section className="card" style={{ marginTop: 18 }}>
        <small className="eyebrow">DIREÇÃO</small>
        <h2>Regras para IA</h2>
        <p className="muted">
          Gerar preferencialmente fundos e elementos visuais sem texto. O
          aplicativo aplica mensagens, logo e tipografia configurados no Kit da
          Marca por cima, mantendo consistência e evitando erros de escrita.
        </p>
      </section>
    </div>
  );
}
