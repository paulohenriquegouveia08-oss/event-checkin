import { z } from "zod";

export const attendeeLoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  eventName: z.string().min(1, "Nome do evento é obrigatório"),
});

export type AttendeeLoginInput = z.infer<typeof attendeeLoginSchema>;
