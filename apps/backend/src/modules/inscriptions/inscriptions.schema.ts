import { z } from "zod";

// Categoria deixou de ser um enum fixo — as opções (key/label/valor) agora
// são configuráveis por evento via Event.siteContent.pricingTiers (ver
// modules/events/site-content.ts). Aqui só validamos o formato da key;
// a existência real da categoria pro evento é checada em
// inscriptions.service.ts (getCategoryAmount), contra os tiers configurados.
const categoryKey = z
  .string()
  .trim()
  .min(1, "Categoria é obrigatória")
  .max(50);

export const createInscriptionSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  email: z.string().trim().email("E-mail inválido"),
  document: z.string().trim().min(1, "CPF é obrigatório").max(20),
  phone: z.string().trim().max(20).optional(),
  category: categoryKey,
  institution: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateInscriptionInput = z.infer<typeof createInscriptionSchema>;

export const inscriptionEventParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});
