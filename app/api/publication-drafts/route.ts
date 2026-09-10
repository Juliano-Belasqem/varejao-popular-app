import { NextResponse } from "next/server";
import { canEdit, requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function safePathPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "material.png";
}

function materialType(materialPath: string, requestedType: string) {
  const filename = (materialPath.split("/").pop() || "").toLowerCase();
  if (filename.includes("-story.")) return "story";
  if (filename.includes("-feed.")) return "feed";
  return requestedType;
}

export async function POST(request: Request) {
  try {
    const profile = await requireProfile();
    if (!canEdit(profile.role)) {
      return NextResponse.json({ error: "Sem permissão para criar rascunhos." }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as {
      campaign_id?: string;
      material_path?: string;
      network?: string;
      type?: string;
      caption?: string;
    } | null;

    const campaignId = String(body?.campaign_id ?? "").trim();
    const materialPath = String(body?.material_path ?? "").trim();
    const network = String(body?.network ?? "instagram").trim();
    const requestedType = String(body?.type ?? "feed").trim();
    const type = materialType(materialPath, requestedType);
    const caption = String(body?.caption ?? "").trim() || null;

    if (!campaignId || !materialPath) {
      return NextResponse.json({ error: "Campanha e material são obrigatórios." }, { status: 400 });
    }
    if (!materialPath.startsWith(`${campaignId}/`)) {
      return NextResponse.json({ error: "O material não pertence a esta campanha." }, { status: 400 });
    }
    if (!["instagram", "facebook"].includes(network)) {
      return NextResponse.json({ error: "Rede inválida." }, { status: 400 });
    }
    if (!["feed", "story"].includes(type)) {
      return NextResponse.json({ error: "Tipo de publicação inválido." }, { status: 400 });
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

    const { data: source, error: downloadError } = await supabase.storage
      .from("digital-materials")
      .download(materialPath);
    if (downloadError || !source) {
      return NextResponse.json({ error: "Não foi possível carregar o material salvo." }, { status: 404 });
    }

    const sourceName = materialPath.split("/").pop() || "material.png";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const publicPath = `${campaignId}/drafts/${timestamp}-${safePathPart(sourceName)}`;
    const bytes = await source.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("social-media")
      .upload(publicPath, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("social-media").getPublicUrl(publicPath);
    const publicUrl = publicUrlData.publicUrl;

    const { data: publication, error: publicationError } = await supabase
      .from("publications")
      .insert({
        campaign_id: campaignId,
        network,
        type,
        caption,
        status: "draft",
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id")
      .single();

    if (publicationError || !publication) {
      await supabase.storage.from("social-media").remove([publicPath]);
      return NextResponse.json({ error: publicationError?.message || "Falha ao criar rascunho." }, { status: 500 });
    }

    const { error: mediaError } = await supabase.from("publication_media").insert({
      publication_id: publication.id,
      storage_path: publicPath,
      public_url: publicUrl,
      media_type: "image",
      sort_order: 0,
    });

    if (mediaError) {
      await supabase.from("publications").delete().eq("id", publication.id);
      await supabase.storage.from("social-media").remove([publicPath]);
      return NextResponse.json({ error: mediaError.message }, { status: 500 });
    }

    return NextResponse.json({ publication_id: publication.id, public_url: publicUrl });
  } catch (error) {
    console.error("publication draft route failed", error);
    return NextResponse.json({ error: "Não foi possível criar o rascunho." }, { status: 500 });
  }
}
