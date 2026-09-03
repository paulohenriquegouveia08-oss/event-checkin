import { z } from "zod";

export const siteThemeSchema = z.object({
  primaryColor: z.string().default("#0E3634"),
  accentColor: z.string().default("#C8A261"),
  backgroundColor: z.string().default("#0B2928"),
  surfaceColor: z.string().default("#134543"),
  textColor: z.string().default("#FFFFFF"),
  textMutedColor: z.string().default("#94A3B8"),
});

export const pricingTierSchema = z.object({
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

export const faqItemSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1000),
});

export const partnerItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(100).optional(),
  logoUrl: z.string().trim().optional().nullable(),
});

export const sectionTypeSchema = z.enum([
  "hero",
  "about",
  "schedule",
  "batches",
  "steps",
  "partners",
  "faq",
]);

export const sectionConfigSchema = z.object({
  id: z.string(),
  type: sectionTypeSchema,
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(300).optional().nullable(),
  enabled: z.boolean().default(true),
  order: z.number().int().default(0),
  backgroundColor: z.string().optional().nullable(),
  textColor: z.string().optional().nullable(),
  content: z.record(z.any()).optional(),
});

export const siteContentSchema = z.object({
  // Identidade visual global
  theme: siteThemeSchema.optional(),

  // Ordem e configurações individuais das seções
  sections: z.array(sectionConfigSchema).optional(),

  // Dados auxiliares
  faqs: z.array(faqItemSchema).optional(),
  partnersList: z.array(partnerItemSchema).optional(),

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
  steps: z.array(stepSchema).max(10).optional(),

  // Seção "Investimento"
  pricingTitle: z.string().trim().max(200).optional(),
  pricingTiers: z.array(pricingTierSchema).max(12).optional(),

  // Seção de parceiros (teaser na home)
  partnersTitle: z.string().trim().max(200).optional(),
  partnersText: z.string().trim().max(1000).optional(),

  // Rodapé
  footerText: z.string().trim().max(300).optional(),
});

export type SiteTheme = z.infer<typeof siteThemeSchema>;
export type SectionType = z.infer<typeof sectionTypeSchema>;
export type SiteSectionConfig = z.infer<typeof sectionConfigSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
export type PartnerItem = z.infer<typeof partnerItemSchema>;
export type PricingTier = z.infer<typeof pricingTierSchema>;
export type Step = z.infer<typeof stepSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;

export const DEFAULT_SITE_THEME: SiteTheme = {
  primaryColor: "#0E3634",
  accentColor: "#C8A261",
  backgroundColor: "#0B2928",
  surfaceColor: "#134543",
  textColor: "#FFFFFF",
  textMutedColor: "#94A3B8",
};

export const DEFAULT_FAQS: FaqItem[] = [
  {
    question: "Como recebo meu QR Code de entrada?",
    answer:
      "Assim que seu pagamento for confirmado via PicPay/Pix, o sistema envia o comprovante oficial com o QR Code diretamente para seu e-mail cadastrado.",
  },
  {
    question: "O evento oferece certificado de participação?",
    answer:
      "Sim! Todos os congressistas credenciados receberão certificado oficial com carga horária e código verificável de autenticidade.",
  },
  {
    question: "Posso pagar via Pix?",
    answer:
      "Sim. Ao se inscrever, a tela gera instantaneamente o QR Code Pix e o código Copia e Cola para pagamento rápido pelo seu banco.",
  },
];

export const DEFAULT_SITE_SECTIONS: SiteSectionConfig[] = [
  {
    id: "hero",
    type: "hero",
    title: "Início / Apresentação",
    subtitle: "Destaque principal com data, local e chamada para inscrição",
    enabled: true,
    order: 0,
    backgroundColor: null,
    textColor: null,
  },
  {
    id: "about",
    type: "about",
    title: "Sobre o Evento",
    subtitle: "Apresentação e propósito do congresso",
    enabled: true,
    order: 1,
    backgroundColor: null,
    textColor: null,
  },
  {
    id: "schedule",
    type: "schedule",
    title: "Programação Oficial",
    subtitle: "Cronograma das palestras, horários e auditórios",
    enabled: true,
    order: 2,
    backgroundColor: null,
    textColor: null,
  },
  {
    id: "batches",
    type: "batches",
    title: "Lotes & Inscrição",
    subtitle: "Valores vigentes e garantia de vaga",
    enabled: true,
    order: 3,
    backgroundColor: null,
    textColor: null,
  },
  {
    id: "steps",
    type: "steps",
    title: "Como Funciona",
    subtitle: "Passo a passo da inscrição ao credenciamento",
    enabled: true,
    order: 4,
    backgroundColor: null,
    textColor: null,
  },
  {
    id: "partners",
    type: "partners",
    title: "Realização e Apoio",
    subtitle: "Instituições e marcas que apoiam o evento",
    enabled: true,
    order: 5,
    backgroundColor: null,
    textColor: null,
  },
  {
    id: "faq",
    type: "faq",
    title: "Dúvidas Frequentes",
    subtitle: "Perguntas comuns dos participantes",
    enabled: true,
    order: 6,
    backgroundColor: null,
    textColor: null,
  },
];

export interface ResolvedSiteContent {
  theme: SiteTheme;
  sections: SiteSectionConfig[];
  faqs: FaqItem[];
  partnersList: PartnerItem[];
  eventTitle: string;
  eventYear: string;
  heroBadge: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  stepsTitle: string;
  steps: Step[];
  pricingTitle: string;
  pricingTiers: PricingTier[];
  partnersTitle: string;
  partnersText: string;
  footerText: string;
}

export const DEFAULT_SITE_CONTENT: ResolvedSiteContent = {
  theme: DEFAULT_SITE_THEME,
  sections: DEFAULT_SITE_SECTIONS,
  faqs: DEFAULT_FAQS,
  partnersList: [
    { name: "Universidade Positivo", role: "Realização" },
    { name: "LSPK Tecnology", role: "Tecnologia e Apoio" },
  ],
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

/**
 * Mescla o conteúdo salvo com o padrão — cada campo cai no fallback individualmente.
 */
export function resolveSiteContent(stored: unknown): ResolvedSiteContent {
  const parsed = siteContentSchema.safeParse(stored ?? {});
  const content = parsed.success ? parsed.data : {};

  // Mescla o tema
  const theme: SiteTheme = {
    primaryColor: content.theme?.primaryColor || DEFAULT_SITE_THEME.primaryColor,
    accentColor: content.theme?.accentColor || DEFAULT_SITE_THEME.accentColor,
    backgroundColor: content.theme?.backgroundColor || DEFAULT_SITE_THEME.backgroundColor,
    surfaceColor: content.theme?.surfaceColor || DEFAULT_SITE_THEME.surfaceColor,
    textColor: content.theme?.textColor || DEFAULT_SITE_THEME.textColor,
    textMutedColor: content.theme?.textMutedColor || DEFAULT_SITE_THEME.textMutedColor,
  };

  // Mescla as seções
  let sections: SiteSectionConfig[] = DEFAULT_SITE_SECTIONS;
  if (content.sections && content.sections.length > 0) {
    sections = content.sections.map((s, idx) => ({
      id: s.id || `section-${idx}`,
      type: s.type,
      title: s.title,
      subtitle: s.subtitle ?? null,
      enabled: s.enabled !== false,
      order: typeof s.order === "number" ? s.order : idx,
      backgroundColor: s.backgroundColor ?? null,
      textColor: s.textColor ?? null,
      content: s.content ?? {},
    }));
  }

  return {
    theme,
    sections,
    faqs: content.faqs && content.faqs.length > 0 ? content.faqs : DEFAULT_FAQS,
    partnersList: content.partnersList && content.partnersList.length > 0 ? content.partnersList : DEFAULT_SITE_CONTENT.partnersList,
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
