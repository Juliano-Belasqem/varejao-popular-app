import { SocialContentCreator } from "./social-content-creator";

const allowedTypes = new Set(["anuncio", "comunicado", "sazonal", "homenagem"]);

type PageProps = {
  searchParams: Promise<{ tipo?: string }>;
};

export default async function CriarConteudoRedesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialType = params.tipo && allowedTypes.has(params.tipo) ? params.tipo : "homenagem";

  return <SocialContentCreator initialType={initialType} />;
}
