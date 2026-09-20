import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRasterBytes } from "@/lib/raster-file";

async function access(write = false) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  return profile?.active &&
    (!write || ["admin", "editor"].includes(profile.role))
    ? db
    : null;
}
export async function POST(request: Request) {
  const db = await access(true);
  if (!db)
    return NextResponse.json(
      { error: "Sem permissão para enviar imagens." },
      { status: 403 },
    );
  const form = await request.formData(),
    file = form.get("file");
  if (!(file instanceof File) || file.size > 4 * 1024 * 1024 || !file.size)
    return NextResponse.json(
      { error: "Envie PNG, JPEG ou WebP de até 4 MB." },
      { status: 400 },
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isRasterBytes(bytes, file.type))
    return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  const path = `visual/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp"}`;
  const { error } = await db.storage
    .from("template-assets")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error)
    return NextResponse.json(
      { error: "Não foi possível guardar a imagem." },
      { status: 500 },
    );
  return NextResponse.json({
    source: `/api/visual-assets?path=${encodeURIComponent(path)}`,
  });
}
export async function GET(request: Request) {
  const db = await access();
  if (!db) return new Response("Sem acesso", { status: 403 });
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (!/^visual\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path))
    return new Response("Imagem inválida", { status: 400 });
  const { data, error } = await db.storage
    .from("template-assets")
    .download(path);
  if (error || !data)
    return new Response("Imagem não encontrada", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": data.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
