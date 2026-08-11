import { z } from "zod";

export const createParticipantSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  phone: z.string().trim().max(30).optional(),
  document: z.string().trim().max(30).optional(),
});

export type CreateParticipantInput = z.infer<typeof createParticipantSchema>;

export const updateParticipantSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).optional(),
  document: z.string().trim().max(30).optional(),
  status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
});

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;

export const importParticipantsSchema = z.object({
  csv: z.string().min(1, "Conteúdo CSV vazio"),
  confirm: z.boolean().optional().default(false),
});

export type ImportParticipantsInput = z.infer<typeof importParticipantsSchema>;

export const participantParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
  participantId: z.string().uuid("participantId inválido"),
});
