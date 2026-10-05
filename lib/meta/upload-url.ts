/** Validate a URL supplied by Meta before forwarding a page access token. */
export function assertMetaVideoUploadUrl(value: string): URL {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error("Destino de upload de vídeo da Meta não autorizado.");
  }
  if (target.protocol !== "https:" || target.username || target.password ||
      !["rupload.facebook.com", "graph-video.facebook.com"].includes(target.hostname.toLowerCase()) ||
      (target.port && target.port !== "443")) {
    throw new Error("Destino de upload de vídeo da Meta não autorizado.");
  }
  return target;
}
