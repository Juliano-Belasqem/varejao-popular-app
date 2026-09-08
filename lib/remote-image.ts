import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function assertSafeUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("A imagem precisa usar HTTPS.");
  if (url.username || url.password) throw new Error("URL de imagem inválida.");

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) throw new Error("Host de imagem inválido.");

  if (isIP(hostname)) {
    if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) throw new Error("Host de imagem privado não permitido.");
  } else {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) throw new Error("Não foi possível resolver o host da imagem.");
    for (const address of addresses) {
      if (isPrivateIpv4(address.address) || isPrivateIpv6(address.address)) throw new Error("Host de imagem privado não permitido.");
    }
  }

  return url;
}

export function imageExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function downloadRemoteImage(sourceUrl: string) {
  let current = await assertSafeUrl(sourceUrl);

  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        "User-Agent": "VarejaoPopularOffers/0.1 (https://varejao-popular-app.vercel.app)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento de imagem inválido.");
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`Não foi possível baixar a imagem (HTTP ${response.status}).`);

    const rawType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!ALLOWED_TYPES.has(rawType)) throw new Error("O arquivo retornado não é JPG, PNG ou WEBP.");

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_BYTES) throw new Error("A imagem é maior que 8 MB.");

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error("A imagem retornada está vazia.");
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("A imagem é maior que 8 MB.");

    return { bytes, contentType: rawType, finalUrl: current.toString() };
  }

  throw new Error("A imagem possui redirecionamentos demais.");
}
