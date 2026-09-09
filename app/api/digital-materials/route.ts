import { NextResponse } from "next/server";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function safeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "material.png";
}

export async function POST(request: Request) {
  try {
    const profile = await requireProfile();
    if (!canEdit(profile.role)) {
      return NextResponse.json({ error: "Sem permissão para salvar materiais." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const campaignId = String(form.get("campaign_id") ?? "").trim();
    const format = String(form.get("format") ?? "feed").trim();
    const mode = String(form.get("mode") ?? "composed").trim();

    if (!(file instanceof File) || file.type !== "image/png") {
      return NextResponse.json({ error: "Arquivo PNG inválido." }, { status: 400 });
    }
    if (!campaignId) {
      return NextResponse.json({ error: "Campanha inválida." }, { status: 400 });
    }
    if (file.size > 9 * 1024 * 1024) {
      return NextResponse.json({ error: "O PNG excede o limite de 9 MB." }, { status: 413 });
    }

    const supabase = await createClient();
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = safeName(file.name.endsWith(".png") ? file.name : `${file.name}.png`);
    const path = `${campaignId}/${timestamp}-${mode}-${format}-${filename}`;

    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("digital-materials")
      .upload(path, bytes, { contentType: "image/png", upsert: false });

    if (uploadError) {
      console.error("digital material upload failed", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({ path });
  } catch (error) {
    console.error("digital materials route failed", error);
    return NextResponse.json({ error: "Não foi possível salvar o material digital." }, { status: 500 });
  }
}
