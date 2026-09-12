import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "brand-assets";
const FIELD_KEYS = ["title","product","brand","specification","price","validity","body","footer"] as const;
const DEFAULT_FONTS = Object.fromEntries(FIELD_KEYS.map((key)=>[key,"Arial, sans-serif"]));

async function canEdit() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, allowed: false };
  const { data: profile } = await supabase.from("profiles").select("role,active").eq("id", user.id).single();
  return { supabase, user, allowed: !!profile?.active && ["admin","editor"].includes(profile.role) };
}

async function signedUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [{ data: settings }, { data: fonts }] = await Promise.all([
    supabase.from("brand_settings").select("id,logo_path,primary_color,accent_color,field_fonts,updated_at").eq("id","default").single(),
    supabase.from("brand_fonts").select("id,name,family,storage_path,mime_type,active,created_at").eq("active",true).order("name"),
  ]);

  const logoUrl = await signedUrl(supabase, settings?.logo_path ?? null);
  const enrichedFonts = await Promise.all((fonts ?? []).map(async (font) => ({ ...font, url: await signedUrl(supabase, font.storage_path) })));

  return NextResponse.json({
    settings: {
      ...settings,
      field_fonts: { ...DEFAULT_FONTS, ...(settings?.field_fonts ?? {}) },
      logo_url: logoUrl,
    },
    fonts: enrichedFonts,
  });
}

export async function PUT(request: Request) {
  const { supabase, user, allowed } = await canEdit();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Sem permissão para editar o kit da marca." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { field_fonts?: Record<string,string> };
  const input = body.field_fonts ?? {};
  const fieldFonts: Record<string,string> = {};
  for (const key of FIELD_KEYS) fieldFonts[key] = typeof input[key] === "string" && input[key].trim() ? input[key].trim().slice(0,120) : DEFAULT_FONTS[key];

  const { error } = await supabase.from("brand_settings").update({ field_fonts: fieldFonts, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id","default");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, field_fonts: fieldFonts });
}

export async function POST(request: Request) {
  const { supabase, user, allowed } = await canEdit();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Sem permissão para editar o kit da marca." }, { status: 403 });

  const form = await request.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Arquivo maior que 10 MB." }, { status: 400 });

  if (kind === "logo") {
    const allowedTypes = new Set(["image/png","image/webp","image/svg+xml"]);
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Logo deve ser PNG, WebP ou SVG." }, { status: 400 });
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `logo/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    const { data: old } = await supabase.from("brand_settings").select("logo_path").eq("id","default").single();
    const { error: updateError } = await supabase.from("brand_settings").update({ logo_path: path, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id","default");
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    if (old?.logo_path) await supabase.storage.from(BUCKET).remove([old.logo_path]);
    return NextResponse.json({ ok: true });
  }

  if (kind === "font") {
    const allowedTypes = new Set(["font/woff2","font/woff","font/ttf","font/otf","application/font-woff","application/x-font-ttf","application/x-font-opentype","application/octet-stream"]);
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Fonte deve ser WOFF2, WOFF, TTF ou OTF." }, { status: 400 });
    const name = String(form.get("name") ?? file.name.replace(/\.[^.]+$/, "")).trim().slice(0,80);
    const familyBase = name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Fonte Varejao";
    const family = `${familyBase}-${Date.now()}`;
    const ext = file.name.split(".").pop()?.toLowerCase() || "woff2";
    const path = `fonts/${family.replace(/\s+/g,"-").toLowerCase()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    const { error: insertError } = await supabase.from("brand_fonts").insert({ name, family, storage_path: path, mime_type: file.type || "application/octet-stream", created_by: user.id });
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([path]);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tipo de upload inválido." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const { supabase, user, allowed } = await canEdit();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Sem permissão para editar o kit da marca." }, { status: 403 });
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!id) return NextResponse.json({ error: "Fonte inválida." }, { status: 400 });
  const { data: font } = await supabase.from("brand_fonts").select("id,storage_path,family").eq("id",id).single();
  if (!font) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });
  const { error } = await supabase.from("brand_fonts").update({ active: false }).eq("id",id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: settings } = await supabase.from("brand_settings").select("field_fonts").eq("id","default").single();
  const current = { ...DEFAULT_FONTS, ...(settings?.field_fonts ?? {}) } as Record<string,string>;
  let changed = false;
  for (const key of FIELD_KEYS) if (current[key] === font.family) { current[key] = DEFAULT_FONTS[key]; changed = true; }
  if (changed) await supabase.from("brand_settings").update({ field_fonts: current, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id","default");
  await supabase.storage.from(BUCKET).remove([font.storage_path]);
  return NextResponse.json({ ok: true });
}
