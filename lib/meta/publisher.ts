import { createAdminClient } from "@/lib/supabase/admin";
import { validatePublicationMedia } from "@/lib/publications/validation";

type Publication = {
  id: string;
  network: "instagram" | "facebook";
  type: "feed" | "story" | "carousel" | "reel";
  caption: string | null;
  status: string;
};

type Media = {
  storage_path: string;
  public_url: string | null;
  media_type: string;
  sort_order: number;
};

type GraphResult = Record<string, unknown> & {
  id?: string;
  post_id?: string;
  video_id?: string;
  upload_url?: string;
  success?: boolean;
  status_code?: string;
  status?: string | Record<string, unknown>;
};

const graphVersion = process.env.META_GRAPH_API_VERSION || "v26.0";

function graphUrl(path: string) {
  return `https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, "")}`;
}

async function graphRequest(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as GraphResult & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!response.ok || payload.error) {
    const detail = payload.error?.message || `Meta Graph API retornou HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

async function graphPost(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const response = await fetch(graphUrl(path), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  return graphRequest(response);
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(graphUrl(path));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { method: "GET", cache: "no-store" });
  return graphRequest(response);
}

async function uploadHostedFacebookVideo(uploadUrl: string, fileUrl: string, token: string) {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      file_url: fileUrl,
    },
    cache: "no-store",
  });
  const payload = await graphRequest(response);
  if (payload.success === false) throw new Error("A Meta recusou o upload do vídeo do Facebook.");
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInstagramVideo(containerId: string, token: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const state = await graphGet(containerId, {
      fields: "status_code,status",
      access_token: token,
    });
    const code = String(state.status_code || "").toUpperCase();
    if (code === "FINISHED") return;
    if (["ERROR", "EXPIRED"].includes(code)) {
      throw new Error(`A Meta não conseguiu processar o vídeo${state.status ? `: ${String(state.status)}` : "."}`);
    }
    await sleep(1500);
  }
  throw new Error("O vídeo ainda está sendo processado pela Meta. Aguarde alguns segundos e tente publicar novamente.");
}

async function publishInstagram(publication: Publication, media: Media[]) {
  const igUserId = requireEnv("META_INSTAGRAM_USER_ID");
  const token = requireEnv("META_PAGE_ACCESS_TOKEN");

  if (publication.type === "reel") {
    const container = await graphPost(`${igUserId}/media`, {
      media_type: "REELS",
      video_url: media[0].public_url!,
      caption: publication.caption || "",
      share_to_feed: "true",
      access_token: token,
    });
    const creationId = String(container.id || "");
    if (!creationId) throw new Error("A Meta não retornou o ID do container do Reel.");

    await waitForInstagramVideo(creationId, token);

    const published = await graphPost(`${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    const mediaId = String(published.id || "");
    if (!mediaId) throw new Error("A Meta não retornou o ID do Reel publicado.");
    return { mediaId, postId: mediaId };
  }

  if (publication.type === "carousel") {
    const childIds: string[] = [];
    for (const item of media) {
      const child = await graphPost(`${igUserId}/media`, {
        image_url: item.public_url!,
        is_carousel_item: "true",
        access_token: token,
      });
      const childId = String(child.id || "");
      if (!childId) throw new Error("A Meta não retornou o ID de uma imagem do carrossel.");
      childIds.push(childId);
    }

    const carousel = await graphPost(`${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption: publication.caption || "",
      access_token: token,
    });
    const creationId = String(carousel.id || "");
    if (!creationId) throw new Error("A Meta não retornou o ID do container do carrossel.");

    const published = await graphPost(`${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    const mediaId = String(published.id || "");
    if (!mediaId) throw new Error("A Meta não retornou o ID do carrossel publicado.");
    return { mediaId, postId: mediaId };
  }

  const creationParams: Record<string, string> = {
    image_url: media[0].public_url!,
    access_token: token,
  };
  if (publication.caption && publication.type === "feed") creationParams.caption = publication.caption;
  if (publication.type === "story") creationParams.media_type = "STORIES";

  const container = await graphPost(`${igUserId}/media`, creationParams);
  const creationId = String(container.id || "");
  if (!creationId) throw new Error("A Meta não retornou o ID do container do Instagram.");

  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  const mediaId = String(published.id || "");
  if (!mediaId) throw new Error("A Meta não retornou o ID da publicação do Instagram.");
  return { mediaId, postId: mediaId };
}

async function publishFacebook(publication: Publication, media: Media[]) {
  const pageId = requireEnv("META_FACEBOOK_PAGE_ID");
  const token = requireEnv("META_PAGE_ACCESS_TOKEN");

  if (publication.type === "reel") {
    const start = await graphPost(`${pageId}/video_reels`, {
      upload_phase: "start",
      access_token: token,
    });
    const videoId = String(start.video_id || "");
    const uploadUrl = String(start.upload_url || "");
    if (!videoId || !uploadUrl) throw new Error("A Meta não retornou a sessão de upload do Reel do Facebook.");

    await uploadHostedFacebookVideo(uploadUrl, media[0].public_url!, token);

    const finish = await graphPost(`${pageId}/video_reels`, {
      upload_phase: "finish",
      video_id: videoId,
      video_state: "PUBLISHED",
      description: publication.caption || "",
      access_token: token,
    });
    if (finish.success === false) throw new Error("A Meta não confirmou a publicação do Reel do Facebook.");
    return { mediaId: videoId, postId: String(finish.post_id || finish.id || videoId) };
  }

  if (publication.type === "story") {
    const photo = await graphPost(`${pageId}/photos`, {
      url: media[0].public_url!,
      published: "false",
      access_token: token,
    });
    const photoId = String(photo.id || "");
    if (!photoId) throw new Error("A Meta não retornou o ID da imagem preparada para o Story do Facebook.");

    const story = await graphPost(`${pageId}/photo_stories`, {
      photo_id: photoId,
      access_token: token,
    });
    const postId = String(story.post_id || story.id || photoId);
    return { mediaId: photoId, postId };
  }

  const result = await graphPost(`${pageId}/photos`, {
    url: media[0].public_url!,
    caption: publication.caption || "",
    published: "true",
    access_token: token,
  });
  const mediaId = String(result.id || "");
  const postId = String(result.post_id || result.id || "");
  if (!postId) throw new Error("A Meta não retornou o ID da publicação do Facebook.");
  return { mediaId: mediaId || null, postId };
}

export async function publishPublication(publicationId: string, allowedStatuses = ["scheduled", "draft", "error"]) {
  const supabase = createAdminClient();
  const { data: publication, error: publicationError } = await supabase
    .from("publications")
    .select("id,network,type,caption,status")
    .eq("id", publicationId)
    .maybeSingle();

  if (publicationError || !publication) throw new Error("Publicação não encontrada.");
  if (!allowedStatuses.includes(publication.status)) throw new Error(`Status ${publication.status} não pode ser publicado agora.`);

  const { data: claimed, error: claimError } = await supabase
    .from("publications")
    .update({ status: "publishing", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", publicationId)
    .eq("status", publication.status)
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) throw new Error("A publicação já está sendo processada ou mudou de status.");

  try {
    const { data: media, error: mediaError } = await supabase
      .from("publication_media")
      .select("storage_path,public_url,media_type,sort_order")
      .eq("publication_id", publicationId)
      .order("sort_order", { ascending: true });

    if (mediaError) throw new Error("Não foi possível carregar a mídia da publicação.");

    const validation = validatePublicationMedia(publication, media ?? []);
    if (!validation.ok) throw new Error(validation.message);

    const result = publication.network === "instagram"
      ? await publishInstagram(publication as Publication, media as Media[])
      : await publishFacebook(publication as Publication, media as Media[]);

    const now = new Date().toISOString();
    await supabase
      .from("publications")
      .update({
        status: "published",
        meta_media_id: result.mediaId,
        meta_post_id: result.postId,
        published_at: now,
        error_message: null,
        updated_at: now,
      })
      .eq("id", publicationId);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao publicar na Meta.";
    await supabase
      .from("publications")
      .update({ status: "error", error_message: message.slice(0, 1500), updated_at: new Date().toISOString() })
      .eq("id", publicationId);
    throw error;
  }
}

export async function processDuePublications(limit = 10) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("publications")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const row of data ?? []) {
    try {
      await publishPublication(row.id, ["scheduled"]);
      results.push({ id: row.id, ok: true });
    } catch (error) {
      results.push({ id: row.id, ok: false, error: error instanceof Error ? error.message : "Falha" });
    }
  }
  return results;
}
