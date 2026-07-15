/**
 * Estúdio de criativos (aba Marketing). Gera variações de copy por canal,
 * objetivo e tom a partir dos dados reais do catálogo de produtos.
 * Determinístico no MVP; é o ponto onde o Claude Agent SDK pluga para
 * geração livre — o contrato (CreativeVariant[]) permanece o mesmo.
 */

export type CreativeInput = {
  produto: { nome: string; categoria: string; preco: number };
  canal: "meta" | "google" | "tiktok" | "email";
  objetivo: "conversão" | "alcance" | "retenção";
  tom: "profissional" | "amigável" | "urgente";
};

export type CreativeVariant = {
  angulo: string;
  headline: string;
  corpo: string;
  cta: string;
  obs: string;
};

const CTA: Record<CreativeInput["canal"], Record<CreativeInput["objetivo"], string>> = {
  meta: { "conversão": "Comprar agora", alcance: "Saiba mais", "retenção": "Voltar à loja" },
  google: { "conversão": "Compre online", alcance: "Conheça", "retenção": "Ver ofertas" },
  tiktok: { "conversão": "Garanta o seu", alcance: "Descubra", "retenção": "Não perca" },
  email: { "conversão": "Finalizar compra", alcance: "Ver novidades", "retenção": "Resgatar oferta" },
};

const LIMITES: Record<CreativeInput["canal"], string> = {
  meta: "Meta Ads: headline ≤ 40 caracteres, texto primário ≤ 125.",
  google: "Google RSA: títulos ≤ 30 caracteres, descrições ≤ 90.",
  tiktok: "TikTok: texto ≤ 100 caracteres, tom nativo da plataforma.",
  email: "Email: assunto ≤ 50 caracteres para não truncar no mobile.",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function gerarCriativos(input: CreativeInput): CreativeVariant[] {
  const { produto, canal, objetivo, tom } = input;
  const nome = produto.nome;
  const cat = produto.categoria.toLowerCase();
  const preco = fmt(produto.preco);
  const cta = CTA[canal][objetivo];
  const obs = LIMITES[canal];

  const saudacao = tom === "amigável" ? "Você merece" : tom === "urgente" ? "Última chance:" : "Conheça";
  const fecho =
    tom === "urgente"
      ? "O estoque está acabando — garanta o seu hoje."
      : tom === "amigável"
        ? "A gente entrega rapidinho e o suporte é nota 10."
        : "Entrega rápida e garantia oficial em todo o Brasil.";

  return [
    {
      angulo: "Benefício direto",
      headline: `${saudacao} ${nome}`.slice(0, 60),
      corpo: `${nome} por ${preco}. O upgrade de ${cat} que faltava na sua rotina. ${fecho}`,
      cta,
      obs,
    },
    {
      angulo: "Oferta / preço",
      headline: `${nome} por ${preco}`.slice(0, 60),
      corpo:
        objetivo === "retenção"
          ? `Sentimos sua falta! Volte e leve ${nome} com condição especial de recompra. ${fecho}`
          : `Só hoje no site: ${nome} em até 10x sem juros. ${fecho}`,
      cta,
      obs,
    },
    {
      angulo: "Prova social",
      headline: `O ${cat} mais amado da loja`.slice(0, 60),
      corpo: `Milhares de clientes já escolheram ${nome}. Avaliação média 4,8★ no site. Veja por que todo mundo está falando dele.`,
      cta,
      obs,
    },
  ];
}
