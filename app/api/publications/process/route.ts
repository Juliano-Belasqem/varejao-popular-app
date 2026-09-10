import { NextResponse } from "next/server";
import { processDuePublications } from "@/lib/meta/publisher";
import { recordMetaTokenAlert } from "@/lib/meta/token-alerts";
import { getMetaTokenHealth } from "@/lib/meta/token-health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const tokenHealth = await getMetaTokenHealth();
    await recordMetaTokenAlert(tokenHealth);

    if (tokenHealth.available && tokenHealth.valid === false) {
      return NextResponse.json(
        {
          error: "Publicações pausadas: o Page Access Token está inválido ou expirado.",
          token_health: { level: tokenHealth.level, message: tokenHealth.message },
          processed: 0,
          results: [],
        },
        { status: 503 },
      );
    }

    const results = await processDuePublications(10);
    return NextResponse.json({
      processed: results.length,
      results,
      token_health: tokenHealth.available
        ? { level: tokenHealth.level, message: tokenHealth.message, days_until_expiry: tokenHealth.daysUntilExpiry }
        : { level: "unknown", message: tokenHealth.message },
    });
  } catch (error) {
    console.error("publication processor failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha no processador de publicações." },
      { status: 500 },
    );
  }
}
