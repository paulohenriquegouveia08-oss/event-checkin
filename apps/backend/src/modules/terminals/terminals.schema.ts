import { z } from "zod";

export const createTerminalSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
});

export type CreateTerminalInput = z.infer<typeof createTerminalSchema>;

export const activateTerminalSchema = z.object({
  activationCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, "Código de ativação em formato inválido"),
});

export type ActivateTerminalInput = z.infer<typeof activateTerminalSchema>;

export const terminalParamsSchema = z.object({
  terminalId: z.string().uuid("terminalId inválido"),
});

export const eventTerminalParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});

export const eventTerminalIdParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
  terminalId: z.string().uuid("terminalId inválido"),
});
