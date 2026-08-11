import { z } from "zod";

export const createCheckInSchema = z.object({
  qrToken: z.string().min(1, "qrToken é obrigatório"),
});

export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;

export const checkinEventParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});
