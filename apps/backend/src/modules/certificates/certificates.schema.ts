import { z } from "zod";

export const eventIdParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});

export const certificateIdParamsSchema = z.object({
  certificateId: z.string().uuid("certificateId inválido"),
});

export const verificationCodeParamsSchema = z.object({
  code: z.string().trim().min(1).max(120),
});
