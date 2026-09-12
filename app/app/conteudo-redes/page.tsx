import Link from "next/link";
import { BellRing, CalendarHeart, Megaphone, Sparkles } from "lucide-react";

const categories = [
  {
    id: "anuncio",
    title: "Anúncios",
    description: "Divulgue serviços, novidades, horários especiais, formas de pagamento e outras informações comerciais.",
    icon: Megaphone,
  },
  {
    id: "comunicado",
    title: "Comunicados",
    description: "Crie avisos objetivos para mudanças de horário, funcionamento em feriados e informações importantes.",
    icon: BellRing,
  },
  {
    id: "sazonal",
    title: "Sazonais",
    description: "Produza artes para Natal, Páscoa, Dia das Mães, Dia dos Pais, festas juninas e outras datas.",
    icon: CalendarHeart,
  },
  {
    id: "homenagem",
    title: "Institucional e homenagens",
    description: "Crie mensagens de agradecimento, aniversário da loja e homenagens especiais para clientes e equipe.",
    icon: Sparkles,
  },
] as const;

export default function ConteudoRedesPage() {
  return (
    <div>
      <header className="page-head">
        <div>
          <h1>Conteúdo para Redes</h1>
          <p className="muted" style={{ margin: 0 }}>
            Crie peças institucionais e sazonais sem misturar este fluxo com os encartes de ofertas.
          </p>
        </div>
        <span className="pill">Feed + Story</span>
      </header>

      <section className="card ai-hero">
        <div>
          <small className="eyebrow">CRIAÇÃO ASSISTIDA POR IA</small>
          <h2>Monte uma proposta e gere o visual dentro do aplicativo</h2>
          <p className="muted">
            A ferramenta organiza o briefing, aplica diretrizes do Varejão Popular e usa a API da OpenAI para gerar a imagem.
          </p>
        </div>
        <Link className="btn primary" href="/app/conteudo-redes/criar">
          Criar nova arte
        </Link>
      </section>

      <div className="content-type-grid">
        {categories.map(({ id, title, description, icon: Icon }) => (
          <Link className="card content-type-card" href={`/app/conteudo-redes/criar?tipo=${id}`} key={id}>
            <div className="content-type-icon"><Icon size={22} /></div>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
            <span className="content-card-action">Começar criação →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
