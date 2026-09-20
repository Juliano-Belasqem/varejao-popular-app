export type VisualElementType =
  "text" | "image" | "shape" | "barcode" | "group";

export type VisualTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  layer: number;
  skewX?: number;
  skewY?: number;
  scaleX?: number;
  scaleY?: number;
};

export type VisualTextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowX?: number;
  shadowY?: number;
};

export type VisualElement = {
  id: string;
  type: VisualElementType;
  name: string;
  visible: boolean;
  locked: boolean;
  transform: VisualTransform;
  binding?: string;
  text?: string;
  textStyle?: VisualTextStyle;
  source?: string;
  fit?: "contain" | "cover" | "fill";
  imagePosition?: { x: number; y: number };
  groupSize?: { width: number; height: number };
  decoration?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    borderRadius?: number;
    shadowColor?: string;
    shadowBlur?: number;
    shadowX?: number;
    shadowY?: number;
  };
  shape?: {
    kind: "rectangle" | "ellipse" | "line";
    fill: string;
    stroke: string;
    strokeWidth: number;
    borderRadius?: number;
  };
  children?: string[];
};

export type VisualDocument = {
  version: 1;
  name: string;
  width: number;
  height: number;
  unit: "px" | "mm";
  background: { color: string; image?: string };
  elements: VisualElement[];
  /** Additional artboards; the original v1 fields remain the first artboard. */
  pages?: VisualPage[];
};
export type VisualPage = Omit<VisualDocument, "version" | "pages">;

export const visualBindings = [
  "product.name",
  "product.brand",
  "product.specification",
  "product.ean",
  "product.image",
  "offer.normalPrice",
  "offer.price",
  "offer.priceReais",
  "offer.priceCents",
  "offer.unit",
  "offer.startsOn",
  "offer.endsOn",
  "campaign.name",
  "brand.logo",
] as const;

export function createVisualDocument(
  name = "Novo template",
  width = 1080,
  height = 1080,
): VisualDocument {
  return {
    version: 1,
    name,
    width,
    height,
    unit: "px",
    background: { color: "#ffffff" },
    elements: [],
  };
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function safeVisualSource(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (!value ||
      /^\/(?!\/)[^\\\s]*$/.test(value) ||
      /^https:\/\/[^\s\\]+$/i.test(value) ||
      /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value))
  );
}
function validColor(value: unknown) {
  return (
    typeof value === "string" &&
    /^(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|transparent)$/i.test(
      value,
    )
  );
}

export function validateVisualDocument(value: unknown): VisualDocument {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Documento visual inválido.");
  const doc = value as VisualDocument;
  if (
    doc.version !== 1 ||
    typeof doc.name !== "string" ||
    !doc.name.trim() ||
    !finite(doc.width) ||
    !finite(doc.height) ||
    doc.width <= 0 ||
    doc.height <= 0 ||
    !["px", "mm"].includes(doc.unit)
  )
    throw new Error("Prancheta inválida.");
  if (
    !doc.background ||
    !/^#[0-9a-f]{6}$/i.test(doc.background.color) ||
    !Array.isArray(doc.elements)
  )
    throw new Error("Estrutura visual inválida.");
  const ids = new Set<string>();
  if (
    doc.background.image !== undefined &&
    !safeVisualSource(doc.background.image)
  )
    throw new Error("Imagem de fundo inválida.");
  for (const el of doc.elements) {
    if (
      typeof el?.id !== "string" ||
      !el.id ||
      ids.has(el.id) ||
      typeof el.name !== "string" ||
      !["text", "image", "shape", "barcode", "group"].includes(el.type)
    )
      throw new Error("Elemento visual inválido.");
    ids.add(el.id);
    const t = el.transform;
    if (
      !t ||
      ![
        t.x,
        t.y,
        t.width,
        t.height,
        t.rotation,
        t.opacity,
        t.layer,
        t.skewX ?? 0,
        t.skewY ?? 0,
        t.scaleX ?? 1,
        t.scaleY ?? 1,
      ].every(finite) ||
      t.width <= 0 ||
      t.height <= 0 ||
      t.opacity < 0 ||
      t.opacity > 1 ||
      !Number.isInteger(t.layer)
    )
      throw new Error(`Transformação inválida: ${el.name || el.id}.`);
    if (typeof el.visible !== "boolean" || typeof el.locked !== "boolean")
      throw new Error(`Estado inválido: ${el.name || el.id}.`);
    if (
      Math.abs(t.skewX ?? 0) >= 89 ||
      Math.abs(t.skewY ?? 0) >= 89 ||
      (t.scaleX ?? 1) <= 0 ||
      (t.scaleY ?? 1) <= 0 ||
      1 -
        Math.tan(((t.skewX ?? 0) * Math.PI) / 180) *
          Math.tan(((t.skewY ?? 0) * Math.PI) / 180) <=
        0.0001
    )
      throw new Error("Inclinação inválida.");
    if (
      el.binding !== undefined &&
      (typeof el.binding !== "string" ||
        !/^\w+(\.\w+)*$/.test(el.binding) ||
        el.binding
          .split(".")
          .some((k) => ["__proto__", "prototype", "constructor"].includes(k)))
    )
      throw new Error("Vínculo inválido.");
    if (el.text !== undefined && typeof el.text !== "string")
      throw new Error("Texto inválido.");
    if (el.source !== undefined && !safeVisualSource(el.source))
      throw new Error("Imagem inválida.");
    if (el.fit !== undefined && !["contain", "cover", "fill"].includes(el.fit))
      throw new Error("Enquadramento inválido.");
    if (
      el.imagePosition &&
      (![el.imagePosition.x, el.imagePosition.y].every(finite) ||
        el.imagePosition.x < 0 ||
        el.imagePosition.x > 1 ||
        el.imagePosition.y < 0 ||
        el.imagePosition.y > 1)
    )
      throw new Error("Recorte inválido.");
    if (
      el.groupSize &&
      (!finite(el.groupSize.width) ||
        !finite(el.groupSize.height) ||
        el.groupSize.width <= 0 ||
        el.groupSize.height <= 0)
    )
      throw new Error("Dimensão de grupo inválida.");
    if (
      el.children !== undefined &&
      (el.type !== "group" ||
        !Array.isArray(el.children) ||
        new Set(el.children).size !== el.children.length ||
        el.children.some((c) => typeof c !== "string"))
    )
      throw new Error("Filhos de grupo inválidos.");
    const style = el.textStyle;
    if (style) {
      for (const key of [
        "fontSize",
        "fontWeight",
        "letterSpacing",
        "lineHeight",
        "strokeWidth",
        "shadowBlur",
        "shadowX",
        "shadowY",
      ] as const)
        if (style[key] !== undefined && !finite(style[key]))
          throw new Error("Tipografia inválida.");
      if (
        (style.fontSize !== undefined && style.fontSize <= 0) ||
        (style.lineHeight !== undefined && style.lineHeight <= 0) ||
        (style.fontWeight !== undefined &&
          (style.fontWeight < 1 || style.fontWeight > 1000))
      )
        throw new Error("Tipografia inválida.");
      if (
        style.fontFamily !== undefined &&
        typeof style.fontFamily !== "string"
      )
        throw new Error("Fonte inválida.");
      if (
        (style.textAlign !== undefined &&
          !["left", "center", "right"].includes(style.textAlign)) ||
        (style.fontStyle !== undefined &&
          !["normal", "italic"].includes(style.fontStyle))
      )
        throw new Error("Tipografia inválida.");
    }
    for (const style of [el.textStyle, el.decoration])
      if (style) {
        for (const key of [
          "strokeWidth",
          "shadowBlur",
          "shadowX",
          "shadowY",
        ] as const)
          if (
            style[key] !== undefined &&
            (!finite(style[key]) ||
              (["strokeWidth", "shadowBlur"].includes(key) && style[key]! < 0))
          )
            throw new Error("Estilo inválido.");
      }
    for (const style of [el.textStyle, el.decoration, el.shape])
      if (style)
        for (const [key, value] of Object.entries(style))
          if (
            ["color", "fill", "stroke", "strokeColor", "shadowColor"].includes(
              key,
            ) &&
            !validColor(value)
          )
            throw new Error("Cor inválida.");
    if (
      el.decoration?.borderRadius !== undefined &&
      (!finite(el.decoration.borderRadius) || el.decoration.borderRadius < 0)
    )
      throw new Error("Borda inválida.");
    if (
      el.shape &&
      (!["rectangle", "ellipse", "line"].includes(el.shape.kind) ||
        !finite(el.shape.strokeWidth) ||
        el.shape.strokeWidth < 0 ||
        !validColor(el.shape.fill) ||
        !validColor(el.shape.stroke) ||
        (el.shape.borderRadius !== undefined &&
          (!finite(el.shape.borderRadius) || el.shape.borderRadius < 0)))
    )
      throw new Error("Forma inválida.");
  }
  const groups = new Map(
    doc.elements
      .filter((el) => el.type === "group")
      .map((el) => [el.id, el.children ?? []]),
  );
  const owned = new Set<string>();
  for (const el of doc.elements)
    for (const child of el.children ?? []) {
      if (!ids.has(child) || child === el.id || owned.has(child))
        throw new Error(`Grupo com referência inválida: ${el.name}.`);
      owned.add(child);
    }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Grupos com referência circular.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const child of groups.get(id) ?? [])
      if (groups.has(child)) visit(child);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of groups.keys()) visit(id);
  if (doc.pages !== undefined) {
    if (!Array.isArray(doc.pages)) throw new Error("Páginas inválidas.");
    for (const page of doc.pages) {
      if (!page || typeof page !== "object" || "pages" in page)
        throw new Error("Página inválida.");
      validateVisualDocument({ ...page, version: 1 });
    }
  }
  return doc;
}

export function resolveBinding(
  binding: string | undefined,
  data: Record<string, unknown>,
): unknown {
  if (!binding) return undefined;
  return binding
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current &&
        typeof current === "object" &&
        Object.hasOwn(current, key) &&
        !["__proto__", "constructor", "prototype"].includes(key)
          ? (current as Record<string, unknown>)[key]
          : undefined,
      data,
    );
}
