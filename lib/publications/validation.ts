export type PublicationTarget = {
  network: "instagram" | "facebook" | string;
  type: "feed" | "story" | "carousel" | "reel" | string;
};

export type PublicationMediaShape = {
  media_type: string;
  public_url: string | null;
};

export type PublicationValidation = {
  ok: boolean;
  message: string;
};

function validImages(media: PublicationMediaShape[]) {
  return media.filter((item) => item.media_type === "image" && Boolean(item.public_url));
}

function validVideos(media: PublicationMediaShape[]) {
  return media.filter((item) => item.media_type === "video" && Boolean(item.public_url));
}

export function validatePublicationMedia(
  publication: PublicationTarget,
  media: PublicationMediaShape[],
): PublicationValidation {
  const images = validImages(media);
  const videos = validVideos(media);

  if (publication.network === "instagram") {
    if (publication.type === "feed") {
      return media.length === 1 && images.length === 1
        ? { ok: true, message: "Pronta para publicar." }
        : { ok: false, message: "O Feed do Instagram precisa ter exatamente 1 imagem pública." };
    }

    if (publication.type === "story") {
      return media.length === 1 && images.length === 1
        ? { ok: true, message: "Pronta para publicar." }
        : { ok: false, message: "O Story do Instagram precisa ter exatamente 1 imagem pública." };
    }

    if (publication.type === "carousel") {
      return media.length >= 2 && media.length <= 10 && images.length === media.length
        ? { ok: true, message: "Pronta para publicar." }
        : { ok: false, message: "O Carrossel do Instagram precisa ter de 2 a 10 imagens públicas e nenhuma mídia de vídeo." };
    }

    if (publication.type === "reel") {
      return media.length === 1 && videos.length === 1
        ? { ok: true, message: "Pronta para publicar." }
        : { ok: false, message: "O Reel do Instagram precisa ter exatamente 1 vídeo MP4 público." };
    }
  }

  if (publication.network === "facebook") {
    if (publication.type === "feed") {
      return media.length === 1 && images.length === 1
        ? { ok: true, message: "Pronta para publicar." }
        : { ok: false, message: "O Feed do Facebook precisa ter exatamente 1 imagem pública." };
    }

    if (publication.type === "story") {
      return media.length === 1 && images.length === 1
        ? { ok: true, message: "Pronta para publicar." }
        : { ok: false, message: "O Story do Facebook precisa ter exatamente 1 imagem pública neste fluxo." };
    }

    return { ok: false, message: "Esta combinação de rede e tipo ainda não é suportada automaticamente." };
  }

  return { ok: false, message: "Rede ou tipo de publicação inválido." };
}
