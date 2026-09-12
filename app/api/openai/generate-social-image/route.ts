import { NextResponse } from "next/server";

const allowedTypes = new Set(["anuncio", "comunicado", "sazonal", "homenagem"]);
const allowedFormats = new Set(["feed", "story"]);
const allowedQualities = new Set(["low", "medium", "high"]);

type GenerateBody = {
  type?: string;
  occasion?: string;
  objective?: string;
  message?: string;
  format?: string;
  style?: string;
  quality?: string;
};

function clean(value: unknown, max = 800) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "A integração com a OpenAI ainda não está configurada. Adicione OPENAI_API_KEY no ambiente do servidor." },
      { status: 503 },
    );
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const type = allowedTypes.has(body.type || "") ? body.type! : "homenagem";
  const format = allowedFormats.has(body.format || "") ? body.format! : "feed";
  const quality = allowedQualities.has(body.quality || "") ? body.quality! : "medium";
  const occasion = clean(body.occasion, 180);
  const objective = clean(body.objective, 600);
  const message = clean(body.message, 500);
  const style = clean(body.style, 240) || "acolhedor e elegante";

  if (!occasion) {
    return NextResponse.json({ error: "Informe a ocasião ou tema da arte." }, { status: 400 });
  }

  const size = format === "story" ? "1024x1536" : "1024x1024";
  const prompt = [
    "Crie uma imagem publicitária profissional para o supermercado brasileiro Varejão Popular.",
    `Categoria da peça: ${type}.`,
    `Ocasião ou tema: ${occasion}.`,
    objective ? `Objetivo: ${objective}.` : "",
    message ? `Mensagem que será aplicada posteriormente sobre a arte: ${message}.` : "",
    `Direção visual: ${style}.`,
    `Formato: ${format === "story" ? "vertical para Stories" : "quadrado para feed"}.`,
    "Use uma composição moderna, acolhedora, comercial e adequada a uma rede de supermercado popular brasileira.",
    "Priorize as cores institucionais azul e laranja de forma equilibrada, sem depender de texto dentro da imagem.",
    "Não gere logotipos, marcas inventadas, preços, letras ou palavras legíveis. Deixe áreas de respiro úteis para inserir título, mensagem e logotipo depois.",
    "A imagem deve funcionar como base visual de uma peça de marketing, com acabamento limpo e profissional.",
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2.5-sunburst",
        prompt,
        size,
        quality,
        output_format: "png",
      }),
    });

    const data = await response.json() as {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message || "A OpenAI recusou a solicitação de geração." },
        { status: response.status },
      );
    }

    const result = data.data?.[0];
    if (!result) {
      return NextResponse.json({ error: "A OpenAI não retornou uma imagem." }, { status: 502 });
    }

    const image = result.b64_json ? `data:image/png;base64,${result.b64_json}` : result.url;
    if (!image) {
      return NextResponse.json({ error: "A resposta da OpenAI não contém uma imagem utilizável." }, { status: 502 });
    }

    return NextResponse.json({ image });
  } catch {
    return NextResponse.json({ error: "Falha de comunicação com a OpenAI." }, { status: 502 });
  }
}
