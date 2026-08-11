import { z } from "zod";

export const attendeeLoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export type AttendeeLoginInput = z.infer<typeof attendeeLoginSchema>;
