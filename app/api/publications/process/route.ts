import { NextResponse } from "next/server";
import { processDuePublications } from "@/lib/meta/publisher";

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
    const results = await processDuePublications(10);
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error("publication processor failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha no processador de publicações." },
      { status: 500 },
    );
  }
}
