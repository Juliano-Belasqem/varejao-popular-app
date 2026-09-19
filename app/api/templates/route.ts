import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  defaultTemplate,
  templateIds,
  validateLayout,
  type TemplateId,
} from "@/lib/template-config";
import { isRasterBytes } from "@/lib/raster-file";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") as TemplateId;
  if (!templateIds.includes(id))
    return NextResponse.json({ error: "Template inválido." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active)
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const { data, error } = await supabase
    .from("art_templates")
    .select("layout,background_path,revision")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      {
        error:
          "Não foi possível carregar o template. Verifique a migração do banco.",
      },
      { status: 503 },
    );
  const config = defaultTemplate(id);
  if (data) {
    config.layout = Object.keys(data.layout ?? {}).length
      ? validateLayout(id, data.layout)
      : config.layout;
    config.revision = data.revision;
    if (data.background_path) {
      const signed = await supabase.storage
        .from("template-assets")
        .createSignedUrl(data.background_path, 3600);
      if (signed.error)
        return NextResponse.json(
          { error: "Não foi possível carregar o fundo salvo." },
          { status: 503 },
        );
      config.backgroundUrl = signed.data.signedUrl;
    }
  }
  return NextResponse.json(
    { config, canEdit: ["admin", "editor"].includes(profile.role) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active || !["admin", "editor"].includes(profile.role))
    return NextResponse.json(
      { error: "Sem permissão para editar templates." },
      { status: 403 },
    );
  let uploaded: string | null = null;
  try {
    const form = await request.formData();
    const id = String(form.get("id")) as TemplateId;
    if (!templateIds.includes(id)) throw new Error("Template inválido.");
    const revision = Number(form.get("revision"));
    if (!Number.isSafeInteger(revision) || revision < 0)
      throw new Error("Versão inválida.");
    const layout = validateLayout(id, JSON.parse(String(form.get("layout"))));
    const file = form.get("file");
    const { data: old, error: readError } = await supabase
      .from("art_templates")
      .select("background_path,revision")
      .eq("id", id)
      .single();
    if (readError || !old)
      throw new Error("Template indisponível. Verifique a migração do banco.");
    if (old.revision !== revision)
      return NextResponse.json(
        {
          error:
            "O template foi alterado em outra sessão. Recarregue antes de salvar.",
        },
        { status: 409 },
      );
    let path =
      form.get("resetBackground") === "true" ? null : old.background_path;
    if (file instanceof File) {
      const extensions: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
      };
      if (!extensions[file.type] || !file.size || file.size > 4 * 1024 * 1024)
        throw new Error("Use PNG, JPG ou WebP de até 4 MB.");
      if (
        !isRasterBytes(
          new Uint8Array(await file.slice(0, 12).arrayBuffer()),
          file.type,
        )
      )
        throw new Error("O arquivo não contém uma imagem válida.");
      path = `${id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const result = await supabase.storage
        .from("template-assets")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw new Error(result.error.message);
      uploaded = path;
    }
    const { data, error } = await supabase
      .from("art_templates")
      .update({
        layout,
        background_path: path,
        revision: revision + 1,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("revision", revision)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        error?.message ||
          "O template mudou durante o salvamento. Recarregue a página.",
      );
    // Keep previous background objects for recovery; only remove an uncommitted upload.
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (uploaded)
      await supabase.storage.from("template-assets").remove([uploaded]);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Falha ao salvar template.",
      },
      { status: 400 },
    );
  }
}
