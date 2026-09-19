import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isRasterBytes } from "./raster-file";

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
  if(normalized.startsWith("::ffff:")) {
    const mapped=normalized.slice(7);
    if(mapped.includes("."))return isPrivateIpv4(mapped);
    const parts=mapped.split(":");
    if(parts.length!==2)return true;
    const high=parseInt(parts[0],16),low=parseInt(parts[1],16);
    return isPrivateIpv4(`${high>>8}.${high&255}.${low>>8}.${low&255}`);
  }
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

export function isPrivateAddress(ip:string) {
  const version=isIP(ip);
  return version===4?isPrivateIpv4(ip):version===6?isPrivateIpv6(ip):true;
}

async function assertSafeUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("A imagem precisa usar HTTPS.");
  if (url.username || url.password) throw new Error("URL de imagem inválida.");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) throw new Error("Host de imagem inválido.");

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error("Host de imagem privado não permitido.");
  } else {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) throw new Error("Não foi possível resolver o host da imagem.");
    for (const address of addresses) {
      if (isPrivateAddress(address.address)) throw new Error("Host de imagem privado não permitido.");
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
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      headers: {
        "User-Agent": "VarejaoPopularOffers/0.1 (https://varejao-popular-app.vercel.app)",
        Accept: "image/webp,image/png,image/jpeg",
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

    if(!response.body)throw new Error("Imagem vazia.");
    const reader=response.body.getReader();
    const chunks:Uint8Array[]=[];
    let size=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_IMAGE_BYTES){await reader.cancel();throw new Error("A imagem é maior que 8 MB.")}
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    if (!bytes.length) throw new Error("A imagem retornada está vazia.");
    if(!isRasterBytes(bytes,rawType))throw new Error("O arquivo retornado não contém uma imagem válida.");
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("A imagem é maior que 8 MB.");

    return { bytes, contentType: rawType, finalUrl: current.toString() };
  }

  throw new Error("A imagem possui redirecionamentos demais.");
}
