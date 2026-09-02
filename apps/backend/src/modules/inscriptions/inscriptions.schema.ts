import { z } from "zod";

export const createInscriptionSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  email: z.string().trim().email("E-mail inválido"),
  document: z.string().trim().min(1, "CPF é obrigatório").max(20),
  phone: z.string().trim().max(20).optional().nullable(),
  // Opcional para suportar tanto o formulário novo (sem seleção) quanto chamadas legadas
  category: z.string().trim().max(50).optional(),
  institution: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type CreateInscriptionInput = z.infer<typeof createInscriptionSchema>;

export const inscriptionEventParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});

export const picPayWebhookSchema = z.object({
  referenceId: z.string().min(1, "referenceId é obrigatório"),
  authorizationId: z.string().optional(),
});
