import { z } from "zod";

/**
 * Conteúdo do site pre-copol, 100% editável pelo admin (sem precisar mexer
 * em código) — guardado como JSON livre em Event.siteContent (ver
 * schema.prisma). Nada aqui é obrigatório: campos ausentes caem no
 * fallback em DEFAULT_SITE_CONTENT, que reproduz o texto/preços que já
 * existiam fixos no código antes desta funcionalidade (evento COPOL real
 * continua funcionando sem reconfiguração).
 */
export const pricingTierSchema = z.object({
  // key estável, usada como Inscription.category — trocar a key de um tier
  // existente não invalida inscrições já feitas com a key antiga, só deixa
  // de aparecer como opção nova.
  key: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "key só pode ter letras, números, - e _"),
  label: z.string().trim().min(1).max(120),
  amount: z.coerce.number().min(0).max(100000),
});

export const stepSchema = z.object({
  title: z.string().trim().min(1).max(100),
  text: z.string().trim().min(1).max(300),
});

export const siteContentSchema = z.object({
  // Cabeçalho / topo do site
  eventTitle: z.string().trim().max(100).optional(),
  eventYear: z.string().trim().max(20).optional(),
  heroBadge: z.string().trim().max(200).optional(),
  heroSubtitle: z.string().trim().max(300).optional(),

  // Seção "Sobre o evento"
  aboutTitle: z.string().trim().max(200).optional(),
  aboutText: z.string().trim().max(4000).optional(),

  // Seção "Como funciona"
  stepsTitle: z.string().trim().max(200).optional(),
  steps: z.array(stepSchema).max(6).optional(),

  // Seção "Investimento"
  pricingTitle: z.string().trim().max(200).optional(),
  pricingTiers: z.array(pricingTierSchema).max(12).optional(),

  // Seção de parceiros (teaser na home)
  partnersTitle: z.string().trim().max(200).optional(),
  partnersText: z.string().trim().max(1000).optional(),

  // Rodapé
  footerText: z.string().trim().max(300).optional(),
});

export type PricingTier = z.infer<typeof pricingTierSchema>;
export type Step = z.infer<typeof stepSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
type ResolvedSiteContent = Required<SiteContent>;

export const DEFAULT_SITE_CONTENT: ResolvedSiteContent = {
  eventTitle: "Pré-Copol",
  eventYear: "2026",
  heroBadge: "3º COPOL · Congresso Odontológico Positivo Londrinense",
  heroSubtitle:
    "Toxina Botulínica: a ciência por trás do resultado natural. Evento preparatório do 3º COPOL, reunindo " +
    "estudantes e profissionais da odontologia em Londrina.",

  aboutTitle: "Um encontro pra quem leva a odontologia a sério",
  aboutText:
    "O Pré-Copol 2026 é a abertura do 3º Congresso Odontológico Positivo Londrinense (COPOL), realizado na " +
    "Universidade Positivo — Campus Londrina. O evento tem como tema central a Toxina Botulínica, abordando a " +
    "ciência por trás do resultado natural na prática odontológica. É voltado a estudantes e profissionais da " +
    "odontologia que buscam atualização técnica e networking com a comunidade acadêmica de Londrina.",

  stepsTitle: "Da inscrição ao credenciamento",
  steps: [
    { title: "Inscreva-se", text: "Preencha seus dados e escolha sua categoria de participação." },
    { title: "Pagamento", text: "Siga as instruções enviadas por e-mail para confirmar sua vaga." },
    { title: "Credenciamento", text: "No dia do evento, retire seu QR Code e faça seu check-in na entrada." },
  ],

  pricingTitle: "Escolha sua categoria",
  pricingTiers: [
    { key: "STUDENT_UP", label: "Aluno da Universidade Positivo", amount: 30 },
    { key: "STUDENT_OTHER", label: "Aluno de outras instituições", amount: 35 },
    { key: "PROFESSIONAL", label: "Profissional / Professor", amount: 50 },
  ],

  partnersTitle: "Realização e apoio",
  partnersText: "Universidade Positivo e LSPK Tecnology apoiam o Pré-Copol 2026.",

  footerText: "3º COPOL — Congresso Odontológico Positivo Londrinense",
};

/** Mescla o conteúdo salvo com o padrão — cada campo cai no fallback
 * individualmente se não tiver sido configurado (inclusive dentro de
 * arrays: uma lista vazia ou ausente de steps/pricingTiers usa a lista
 * padrão inteira, não mistura itens customizados com itens padrão). */
export function resolveSiteContent(stored: unknown): ResolvedSiteContent {
  const parsed = siteContentSchema.safeParse(stored ?? {});
  const content = parsed.success ? parsed.data : {};
  return {
    eventTitle: content.eventTitle || DEFAULT_SITE_CONTENT.eventTitle,
    eventYear: content.eventYear || DEFAULT_SITE_CONTENT.eventYear,
    heroBadge: content.heroBadge || DEFAULT_SITE_CONTENT.heroBadge,
    heroSubtitle: content.heroSubtitle || DEFAULT_SITE_CONTENT.heroSubtitle,
    aboutTitle: content.aboutTitle || DEFAULT_SITE_CONTENT.aboutTitle,
    aboutText: content.aboutText || DEFAULT_SITE_CONTENT.aboutText,
    stepsTitle: content.stepsTitle || DEFAULT_SITE_CONTENT.stepsTitle,
    steps: content.steps && content.steps.length > 0 ? content.steps : DEFAULT_SITE_CONTENT.steps,
    pricingTitle: content.pricingTitle || DEFAULT_SITE_CONTENT.pricingTitle,
    pricingTiers:
      content.pricingTiers && content.pricingTiers.length > 0 ? content.pricingTiers : DEFAULT_SITE_CONTENT.pricingTiers,
    partnersTitle: content.partnersTitle || DEFAULT_SITE_CONTENT.partnersTitle,
    partnersText: content.partnersText || DEFAULT_SITE_CONTENT.partnersText,
    footerText: content.footerText || DEFAULT_SITE_CONTENT.footerText,
  };
}

export function findTierAmount(stored: unknown, categoryKey: string): number | null {
  const { pricingTiers } = resolveSiteContent(stored);
  const tier = pricingTiers.find((t) => t.key === categoryKey);
  return tier ? tier.amount : null;
}
