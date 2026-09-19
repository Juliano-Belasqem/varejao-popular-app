export const templateIds = [
  "validity",
  "digital-feed",
  "digital-story",
] as const;
export type TemplateId = (typeof templateIds)[number];
export type LayoutField = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  align: "left" | "center" | "right";
  color: string;
  weight: number;
  visible: boolean;
  opacity: number;
  rotation: number;
  layer: number;
};
export type TemplateConfig = {
  id: TemplateId;
  backgroundUrl: string | null;
  layout: Record<string, LayoutField>;
  revision: number;
};
export const fieldLabels: Record<string, string> = {
  title: "Título",
  product: "Produto",
  brand: "Marca",
  specification: "Especificação",
  validity: "Validade",
  normalPrice: "Preço normal",
  price: "Preço oferta",
  code: "Código de barras",
  footer: "Rodapé",
  logo: "Logo",
  image: "Imagem do produto",
};
const field = (
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  color = "#111111",
): LayoutField => ({
  x,
  y,
  width,
  height,
  fontSize,
  color,
  align: "center",
  weight: 900,
  visible: true,
  opacity: 1,
  rotation: 0,
  layer: 1,
});
// Coordinates are percentages; font sizes use a 1000-unit-wide design space.
export function defaultTemplate(id: TemplateId): TemplateConfig {
  const story = id === "digital-story";
  return {
    id,
    revision: 0,
    backgroundUrl: null,
    layout:
      id === "validity"
        ? {
            title: { ...field(5, 2, 90, 9, 90), visible: false },
            product: field(7, 20, 86, 6, 85),
            brand: field(7, 27, 86, 10, 140, "#c7192b"),
            specification: field(7, 38, 86, 4, 55),
            validity: { ...field(7, 42, 86, 4, 45, "#c7192b"), weight: 400 },
            price: field(7, 46, 86, 31, 440),
            normalPrice: field(16, 81, 27, 6, 72),
            code: field(56, 81, 35, 6, 25),
            footer: { ...field(25, 91, 46, 7, 22, "#ffffff"), visible: false },
            logo: field(79, 90, 13, 9, 20),
          }
        : {
            product: field(
              6,
              story ? 21 : 26,
              48,
              7,
              story ? 50 : 42,
              "#ff9b36",
            ),
            brand: field(6, story ? 26 : 33, 48, 9, story ? 85 : 72, "#ffffff"),
            specification: field(6, story ? 34 : 43, 48, 5, 36, "#ff9b36"),
            image: field(5, story ? 44 : 49, 55, story ? 35 : 40, 20),
            price: field(58, story ? 79 : 73, 38, 12, 100, "#ffffff"),
            footer: field(5, 94, 90, 5, 28, "#ffffff"),
            logo: field(82, 3, 14, 8, 20),
          },
  };
}
export function validateLayout(
  id: TemplateId,
  value: unknown,
): Record<string, LayoutField> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Layout inválido.");
  const input = value as Record<string, LayoutField>;
  const defaults = defaultTemplate(id).layout;
  const result: Record<string, LayoutField> = {};
  for (const key of Object.keys(defaults)) {
    const f = input[key];
    if (
      !f ||
      ["x", "y", "width", "height", "fontSize", "weight"].some(
        (k) =>
          typeof f[k as keyof LayoutField] !== "number" ||
          !Number.isFinite(f[k as keyof LayoutField]),
      )
    )
      throw new Error(`Campo inválido: ${fieldLabels[key]}.`);
    if (
      f.x < 0 ||
      f.y < 0 ||
      f.width <= 0 ||
      f.height <= 0 ||
      f.x + f.width > 100.01 ||
      f.y + f.height > 100.01 ||
      f.fontSize < 8 ||
      f.fontSize > 500 ||
      f.weight < 100 ||
      f.weight > 900 ||
      !["left", "center", "right"].includes(f.align) ||
      !/^#[\da-f]{6}$/i.test(f.color) ||
      typeof f.visible !== "boolean" ||
      (f.opacity != null && (f.opacity < 0 || f.opacity > 1)) ||
      (f.rotation != null && (f.rotation < -180 || f.rotation > 180)) ||
      (f.layer != null && (f.layer < 0 || f.layer > 100))
    )
      throw new Error(`Ajuste os limites do campo ${fieldLabels[key]}.`);
    result[key] = {
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      fontSize: f.fontSize,
      weight: f.weight,
      align: f.align,
      color: f.color,
      visible: f.visible,
      opacity: f.opacity ?? 1,
      rotation: f.rotation ?? 0,
      layer: f.layer ?? 1,
    };
  }
  return result;
}
