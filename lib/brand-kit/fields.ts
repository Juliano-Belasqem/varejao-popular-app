export const brandGroups = [
  {
    id: "campaign",
    label: "Campanhas e encartes digitais",
    fields: [
      ["title", "Título"],
      ["product", "Produto"],
      ["brand", "Marca"],
      ["specification", "Especificação"],
      ["normalPrice", "Preço normal"],
      ["price", "Preço oferta"],
      ["validity", "Validade"],
      ["footer", "Rodapé"],
    ],
  },
  {
    id: "validity",
    label: "Validade Próxima",
    fields: [
      ["title", "Título"],
      ["product", "Produto"],
      ["brand", "Marca"],
      ["specification", "Especificação"],
      ["validity", "Validade"],
      ["normalPrice", "Preço normal"],
      ["price", "Preço oferta"],
      ["code", "Código"],
      ["footer", "Rodapé"],
    ],
  },
  {
    id: "social",
    label: "Conteúdo para Redes e Comunicados",
    fields: [
      ["title", "Título"],
      ["body", "Texto principal"],
      ["validity", "Destaque / data"],
      ["footer", "Rodapé"],
    ],
  },
] as const;
export type BrandModule = (typeof brandGroups)[number]["id"];
export const legacyKeys = [
  "title",
  "product",
  "brand",
  "specification",
  "price",
  "validity",
  "body",
  "footer",
];
export const brandFieldKeys = [
  ...legacyKeys,
  ...brandGroups.flatMap((group) =>
    group.fields.map(([key]) => `${group.id}.${key}`),
  ),
];
export const defaultFonts: Record<string, string> = Object.fromEntries(
  brandFieldKeys.map((key) => [key, "Arial, sans-serif"]),
);
export function resolveFonts(
  input: Record<string, string> = {},
  module?: BrandModule,
) {
  const all = { ...defaultFonts, ...input };
  for (const group of brandGroups)
    for (const [key] of group.fields) {
      all[`${group.id}.${key}`] =
        input[`${group.id}.${key}`] ||
        input[
          key === "normalPrice" ? "price" : key === "code" ? "body" : key
        ] ||
        "Arial, sans-serif";
    }
  if (module)
    for (const [key] of brandGroups.find((group) => group.id === module)!
      .fields)
      all[key] = all[`${module}.${key}`];
  return all;
}
