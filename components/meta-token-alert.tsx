import Link from "next/link";
import { getMetaTokenHealth } from "@/lib/meta/token-health";

export async function MetaTokenAlert() {
  const health = await getMetaTokenHealth();
  if (!health.available || health.level === "ok" || health.level === "unknown") return null;

  const critical = health.level === "critical";
  return (
    <div className={critical ? "error" : "card"} style={{ marginBottom: 16, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong>{critical ? "Atenção: credencial da Meta" : "Aviso: token da Meta próximo do vencimento"}</strong>
          <div className="muted" style={{ marginTop: 4 }}>{health.message}</div>
        </div>
        <Link className="btn" href="/app/publicacoes">Ver integração Meta</Link>
      </div>
    </div>
  );
}
