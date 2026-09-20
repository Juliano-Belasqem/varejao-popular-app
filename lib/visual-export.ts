import type { VisualPage } from "./visual-engine";

export function downloadVisual(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(blob);
  });
}
/** Embed resources before export; failures must be visible rather than silently omitting artwork. */
export async function standaloneSvg(
  svg: SVGSVGElement,
  page: VisualPage,
  fonts: { family: string; url: string | null }[] = [],
) {
  await document.fonts.ready;
  const started = Date.now();
  while (svg.querySelector('[data-resource-ready="false"]')) {
    if (Date.now() - started > 15000)
      throw new Error("Aguarde o carregamento das imagens antes de exportar.");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (svg.querySelector("[data-resource-error]"))
    throw new Error(
      "Há imagens não definidas ou indisponíveis. Corrija-as antes de exportar.",
    );
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-editor-overlay]").forEach((e) => e.remove());
  clone.removeAttribute("style");
  clone.removeAttribute("class");
  const ratio = page.unit === "mm" ? 96 / 25.4 : 1;
  clone.setAttribute("width", String(page.width * ratio));
  clone.setAttribute("height", String(page.height * ratio));
  await Promise.all(
    [...clone.querySelectorAll("image")].map(async (image) => {
      const href = image.getAttribute("href");
      if (!href || href.startsWith("data:")) return;
      const response = await fetch(href, {
        signal: AbortSignal.timeout(15000),
        credentials:
          new URL(href, location.href).origin === location.origin
            ? "same-origin"
            : "omit",
      });
      if (!response.ok)
        throw new Error(
          "Uma imagem não pôde ser exportada. Reenvie o arquivo ou confira o acesso.",
        );
      const blob = await response.blob();
      if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type))
        throw new Error("Use imagens PNG, JPEG ou WebP para exportar.");
      image.setAttribute("href", await dataUrl(blob));
    }),
  );
  const used = new Set(
    [...clone.querySelectorAll("text")].map((e) =>
      e.getAttribute("font-family"),
    ),
  );
  const css = await Promise.all(
    fonts
      .filter((f) => f.url && used.has(f.family))
      .map(async (f) => {
        const response = await fetch(f.url!, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new Error(`Não foi possível exportar a fonte ${f.family}.`);
        return `@font-face{font-family:${JSON.stringify(f.family)};src:url(${JSON.stringify(await dataUrl(await response.blob()))})}`;
      }),
  );
  if (css.length) {
    const style = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style",
    );
    style.textContent = css.join("\n");
    clone.prepend(style);
  }
  return new XMLSerializer().serializeToString(clone);
}
export async function rasterizeVisual(
  svg: string,
  page: VisualPage,
  scale: number,
) {
  const ratio = page.unit === "mm" ? 96 / 25.4 : 1,
    w = Math.round(page.width * ratio * scale),
    h = Math.round(page.height * ratio * scale);
  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    w * h > 64000000 ||
    w > 16384 ||
    h > 16384
  )
    throw new Error(
      "Exportação grande demais para o navegador. Reduza a escala ou use SVG.",
    );
  const img = new Image(),
    url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Não foi possível renderizar a arte."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível.");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Falha ao exportar PNG.")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
