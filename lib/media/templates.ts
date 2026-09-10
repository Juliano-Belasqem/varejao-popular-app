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

const baseText = {
  fontFamily: "Arial, sans-serif",
  fontWeight: 900,
  color: "#ffffff",
} as const;

const feedIndividual: MediaTemplateVariant = {
  format: "feed",
  mode: "individual",
  quantity: 1,
  width: 1080,
  height: 1080,
  background: { kind: "image", value: "/media-templates/varejao-feed.jpg" },
  footer: { x: 70, y: 1000, width: 940, height: 44, fontSize: 31, maxLines: 1, align: "center", ...baseText },
  products: [{
    image: { x: 48, y: 520, width: 565, height: 430 },
    name: { x: 65, y: 285, width: 500, height: 65, fontSize: 45, maxLines: 1, ...baseText },
    brand: { x: 65, y: 352, width: 500, height: 105, fontSize: 78, maxLines: 1, ...baseText },
    specification: { x: 65, y: 458, width: 500, height: 50, fontSize: 39, maxLines: 1, ...baseText },
    offerPrice: { x: 642, y: 790, width: 230, height: 120, fontSize: 105, maxLines: 1, align: "center", ...baseText },
  }],
};

const storyIndividual: MediaTemplateVariant = {
  format: "story",
  mode: "individual",
  quantity: 1,
  width: 1080,
  height: 1920,
  background: { kind: "image", value: "/media-templates/varejao-story.jpg" },
  footer: { x: 70, y: 1805, width: 940, height: 48, fontSize: 34, maxLines: 1, align: "center", ...baseText },
  products: [{
    image: { x: 70, y: 850, width: 620, height: 670 },
    name: { x: 70, y: 410, width: 560, height: 80, fontSize: 55, maxLines: 1, ...baseText },
    brand: { x: 70, y: 500, width: 560, height: 135, fontSize: 93, maxLines: 1, ...baseText },
    specification: { x: 70, y: 645, width: 560, height: 60, fontSize: 46, maxLines: 1, ...baseText },
    offerPrice: { x: 655, y: 1530, width: 250, height: 135, fontSize: 120, maxLines: 1, align: "center", ...baseText },
  }],
};

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

export const varejaoOfficialTemplate: MediaTemplate = {
  id: "varejao-official",
  name: "Varejão Popular · Super Ofertas",
  description: "Template oficial baseado nos modelos de Feed e Story aprovados.",
  status: "active",
  variants: [feedIndividual, storyIndividual],
};

export const currentMediaTemplate: MediaTemplate = varejaoOfficialTemplate;
export const mediaTemplates: MediaTemplate[] = [varejaoOfficialTemplate];
