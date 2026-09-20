"use client";
import {
  useEffect,
  useId,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  resolveBinding,
  safeVisualSource,
  type VisualElement,
  type VisualPage,
} from "@/lib/visual-engine";
import { groupMatrix, matrix, parentOf } from "@/lib/visual-operations";
import { ean13 } from "@/lib/visual-barcode";

export function wrapVisualText(
  text: string,
  width: number,
  measure: (s: string) => number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (line && measure(line + word) > width) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (measure(word) > width) {
        for (const char of word) {
          if (line && measure(line + char) > width) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      } else line += word;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
function VisualImage({
  source,
  width,
  height,
  fit = "contain",
  position = { x: 0.5, y: 0.5 },
}: {
  source: string;
  width: number;
  height: number;
  fit?: VisualElement["fit"];
  position?: { x: number; y: number };
}) {
  const [size, setSize] = useState<{
    source: string;
    width: number;
    height: number;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!source || !safeVisualSource(source)) return;
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (active)
        setSize({ source, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      if (active) setFailed(source);
    };
    img.src = source;
    return () => {
      active = false;
    };
  }, [source]);
  if (!safeVisualSource(source) || !source || failed === source)
    return (
      <g data-resource-error="true">
        <rect width={width} height={height} fill="#f1f5f9" />
        <text
          x={4}
          y={Math.min(20, height)}
          fontSize={Math.min(16, height / 3)}
          fill="#b91c1c"
        >
          {source ? "Imagem indisponível" : "Defina a imagem"}
        </text>
      </g>
    );
  const natural = size?.source === source ? size : { width, height },
    scale =
      fit === "cover"
        ? Math.max(width / natural.width, height / natural.height)
        : Math.min(width / natural.width, height / natural.height);
  const w = fit === "fill" ? width : natural.width * scale,
    h = fit === "fill" ? height : natural.height * scale;
  return (
    <svg width={width} height={height} overflow="hidden">
      <image
        data-resource-ready={size?.source === source ? "true" : "false"}
        href={source}
        x={(width - w) * position.x}
        y={(height - h) * position.y}
        width={w}
        height={h}
        preserveAspectRatio="none"
      />
    </svg>
  );
}
function ElementContent({
  element: e,
  data,
  prefix,
}: {
  element: VisualElement;
  data: Record<string, unknown>;
  prefix: string;
}) {
  const t = e.transform,
    style = e.textStyle ?? {},
    bound = resolveBinding(e.binding, data),
    value =
      bound == null
        ? (e.text ?? "")
        : typeof bound === "string" || typeof bound === "number"
          ? String(bound)
          : "";
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    let active = true;
    void document.fonts.ready.then(() => {
      if (active) setFontEpoch((n) => n + 1);
    });
    return () => {
      active = false;
    };
  }, [style.fontFamily]);
  if (e.type === "image")
    return (
      <VisualImage
        source={typeof bound === "string" ? bound : (e.source ?? "")}
        width={t.width}
        height={t.height}
        fit={e.fit}
        position={e.imagePosition}
      />
    );
  if (e.type === "shape") {
    const s = e.shape ?? {
      kind: "rectangle",
      fill: "#ffffff",
      stroke: "#111111",
      strokeWidth: 1,
    };
    const props = {
      fill: s.fill,
      stroke: s.stroke,
      strokeWidth: s.strokeWidth,
    };
    return s.kind === "ellipse" ? (
      <ellipse
        cx={t.width / 2}
        cy={t.height / 2}
        rx={t.width / 2}
        ry={t.height / 2}
        {...props}
      />
    ) : s.kind === "line" ? (
      <line
        x1={0}
        y1={t.height / 2}
        x2={t.width}
        y2={t.height / 2}
        {...props}
      />
    ) : (
      <rect
        width={t.width}
        height={t.height}
        rx={s.borderRadius ?? 0}
        {...props}
      />
    );
  }
  if (e.type === "barcode") {
    const code = ean13(value);
    if (!code)
      return (
        <text
          x={0}
          y={Math.min(16, t.height)}
          fontSize={Math.min(16, t.height)}
          fill="#b91c1c"
        >
          EAN-13 inválido
        </text>
      );
    return (
      <svg
        viewBox="0 0 113 76"
        width={t.width}
        height={t.height}
        preserveAspectRatio="none"
        aria-label={`EAN-13 ${code.code}`}
      >
        <rect width={113} height={76} fill="white" />
        {[...code.bits].map((b, i) =>
          b === "1" ? (
            <rect
              key={i}
              x={11 + i}
              y={0}
              width={1}
              height={i < 3 || (i >= 45 && i < 50) || i >= 92 ? 65 : 60}
              fill="black"
            />
          ) : null,
        )}
        <text
          x={56.5}
          y={74}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={10}
          fill="black"
        >
          {code.code}
        </text>
      </svg>
    );
  }
  if (e.type !== "text") return null;
  const fontSize = style.fontSize ?? 32,
    spacing = style.letterSpacing ?? 0;
  let measure = (s: string) => s.length * (fontSize * 0.55 + spacing);
  if (fontEpoch && typeof document !== "undefined") {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = `${style.fontStyle ?? "normal"} ${style.fontWeight ?? 400} ${fontSize}px ${style.fontFamily ?? "Arial"}`;
      measure = (s) =>
        ctx.measureText(s).width + Math.max(0, s.length - 1) * spacing;
    }
  }
  const lines = wrapVisualText(value, t.width, measure),
    x =
      style.textAlign === "center"
        ? t.width / 2
        : style.textAlign === "right"
          ? t.width
          : 0;
  return (
    <>
      <defs>
        <clipPath id={`${prefix}-text`}>
          <rect width={t.width} height={t.height} />
        </clipPath>
      </defs>
      <text
        clipPath={`url(#${prefix}-text)`}
        x={x}
        fontFamily={style.fontFamily ?? "Arial"}
        fontSize={fontSize}
        fontWeight={style.fontWeight ?? 400}
        fontStyle={style.fontStyle ?? "normal"}
        textAnchor={
          style.textAlign === "center"
            ? "middle"
            : style.textAlign === "right"
              ? "end"
              : "start"
        }
        fill={style.color ?? "#111111"}
        letterSpacing={spacing}
        stroke={style.strokeColor ?? "transparent"}
        strokeWidth={style.strokeWidth ?? 0}
        paintOrder="stroke fill"
        xmlSpace="preserve"
      >
        {lines.map((line, i) => (
          <tspan
            key={i}
            x={x}
            y={fontSize * 0.85 + i * fontSize * (style.lineHeight ?? 1.15)}
          >
            {line || " "}
          </tspan>
        ))}
      </text>
    </>
  );
}
export function VisualRenderer({
  page,
  data = {},
  children,
  ...props
}: {
  page: VisualPage;
  data?: Record<string, unknown>;
  children?: ReactNode;
} & SVGProps<SVGSVGElement>) {
  const unique = useId().replace(/:/g, "");
  function render(e: VisualElement): ReactNode {
    if (!e.visible) return null;
    const prefix = `${unique}-${encodeURIComponent(e.id).replace(/%/g, "_")}`,
      t = e.transform,
      d = e.decoration,
      s = e.textStyle,
      shadow = d?.shadowColor ?? s?.shadowColor,
      blur = d?.shadowBlur ?? s?.shadowBlur ?? 0;
    return (
      <g
        key={e.id}
        data-element-id={e.id}
        transform={`matrix(${(e.type === "group" ? groupMatrix(e) : matrix(t)).join(" ")})`}
        opacity={t.opacity}
      >
        {shadow && (
          <defs>
            <filter
              id={`${prefix}-shadow`}
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feDropShadow
                dx={d?.shadowX ?? s?.shadowX ?? 0}
                dy={d?.shadowY ?? s?.shadowY ?? 0}
                stdDeviation={blur / 2}
                floodColor={shadow}
              />
            </filter>
          </defs>
        )}
        <g filter={shadow ? `url(#${prefix}-shadow)` : undefined}>
          {d && (
            <rect
              width={e.groupSize?.width ?? t.width}
              height={e.groupSize?.height ?? t.height}
              fill={d.fill ?? "transparent"}
              stroke={d.stroke ?? "transparent"}
              strokeWidth={d.strokeWidth ?? 0}
              rx={d.borderRadius ?? 0}
            />
          )}
          {e.type === "group" ? (
            page.elements
              .filter((child) => e.children?.includes(child.id))
              .sort((a, b) => a.transform.layer - b.transform.layer)
              .map(render)
          ) : (
            <ElementContent element={e} data={data} prefix={prefix} />
          )}
        </g>
      </g>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${page.width} ${page.height}`}
      {...props}
    >
      <svg width={page.width} height={page.height} overflow="hidden">
        <rect
          width={page.width}
          height={page.height}
          fill={page.background.color}
        />
        {page.background.image && (
          <VisualImage
            source={page.background.image}
            width={page.width}
            height={page.height}
            fit="cover"
          />
        )}
        {page.elements
          .filter((e) => !parentOf(page, e.id))
          .sort((a, b) => a.transform.layer - b.transform.layer)
          .map(render)}
      </svg>
      {children}
    </svg>
  );
}
