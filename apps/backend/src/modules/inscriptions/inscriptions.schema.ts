import { z } from "zod";

const categoryEnum = z.enum(["STUDENT_UP", "STUDENT_OTHER", "PROFESSIONAL"]);

export const createInscriptionSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  email: z.string().trim().email("E-mail inválido"),
  document: z.string().trim().min(1, "CPF é obrigatório").max(20),
  phone: z.string().trim().max(20).optional(),
  category: categoryEnum,
  institution: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateInscriptionInput = z.infer<typeof createInscriptionSchema>;

export const inscriptionEventParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});

const AMOUNT_MAP: Record<string, number> = {
  STUDENT_UP: 30,
  STUDENT_OTHER: 35,
  PROFESSIONAL: 50,
};

export function getCategoryAmount(category: string): number {
  return AMOUNT_MAP[category] ?? 0;
}
