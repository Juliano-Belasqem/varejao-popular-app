import type { Rect, TextSlot } from "./templates";

export function fitContain(sourceWidth: number, sourceHeight: number, target: Rect) {
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height,
  };
}

export function drawImageContain(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number },
  target: Rect,
) {
  const width = image.naturalWidth || image.width || target.width;
  const height = image.naturalHeight || image.height || target.height;
  const fitted = fitContain(width, height, target);
  ctx.drawImage(image, fitted.x, fitted.y, fitted.width, fitted.height);
}

export function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

export function drawTextSlot(
  ctx: CanvasRenderingContext2D,
  text: string,
  slot: TextSlot,
) {
  ctx.save();
  ctx.fillStyle = slot.color;
  ctx.font = `${slot.fontWeight} ${slot.fontSize}px ${slot.fontFamily}`;
  ctx.textAlign = slot.align ?? "left";
  ctx.textBaseline = "top";

  const lines = wrapCanvasText(ctx, text, slot.width, slot.maxLines ?? 1);
  const lineHeight = Math.round(slot.fontSize * 1.08);
  const anchorX = slot.align === "center"
    ? slot.x + slot.width / 2
    : slot.align === "right"
      ? slot.x + slot.width
      : slot.x;

  lines.forEach((line, index) => {
    const y = slot.y + index * lineHeight;
    if (y + lineHeight <= slot.y + slot.height + lineHeight) ctx.fillText(line, anchorX, y, slot.width);
  });

  ctx.restore();
}

export async function drawTemplateBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: { kind: "solid" | "image"; value: string } | undefined,
  loadImage: (url: string) => Promise<HTMLImageElement>,
) {
  if (!background) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  if (background.kind === "solid") {
    ctx.fillStyle = background.value;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const image = await loadImage(background.value);
  ctx.drawImage(image, 0, 0, width, height);
}
