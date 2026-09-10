export type MediaFormat = "feed" | "story";
export type MediaMode = "individual" | "composed";
export type MediaQuantity = 1 | 2 | 4;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextSlot = Rect & {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  align?: "left" | "center" | "right";
  maxLines?: number;
  color: string;
};

export type ProductSlot = {
  image: Rect;
  name: TextSlot;
  brand?: TextSlot;
  specification?: TextSlot;
  normalPrice?: TextSlot;
  offerPrice: TextSlot;
};

export type MediaTemplateVariant = {
  format: MediaFormat;
  mode: MediaMode;
  quantity: MediaQuantity;
  width: number;
  height: number;
  background?: {
    kind: "solid" | "image";
    value: string;
  };
  campaignTitle?: TextSlot;
  campaignDates?: TextSlot;
  footer?: TextSlot;
  products: ProductSlot[];
};

export type MediaTemplate = {
  id: string;
  name: string;
  description: string;
  status: "active" | "draft";
  variants: MediaTemplateVariant[];
};

export const MEDIA_CANVAS = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
} as const;

export function findTemplateVariant(
  template: MediaTemplate,
  format: MediaFormat,
  mode: MediaMode,
  quantity: MediaQuantity,
) {
  return template.variants.find(
    (variant) => variant.format === format && variant.mode === mode && variant.quantity === quantity,
  ) ?? null;
}

/**
 * Modelo atual do gerador. Ele permanece como fallback enquanto os layouts
 * oficiais do Varejão Popular são mapeados para o contrato acima.
 */
export const currentMediaTemplate: MediaTemplate = {
  id: "varejao-current",
  name: "Varejão Popular · Atual",
  description: "Modelo de compatibilidade usado pelo gerador atual.",
  status: "active",
  variants: [],
};

export const mediaTemplates: MediaTemplate[] = [currentMediaTemplate];
