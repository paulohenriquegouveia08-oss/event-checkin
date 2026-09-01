import { z } from "zod";

import { EVENT_MODULE_KEYS } from "../../shared/event-modules.js";

/**
 * Endereço público do evento.
 *
 * Vira URL, então só aceita o que é seguro numa: minúsculas, números e
 * hífen. Não pode começar nem terminar em hífen (`-copol` e `copol-` ficam
 * feios e confundem), nem ter hífens seguidos.
 *
 * O mínimo de 3 evita colisão com rotas curtas da própria aplicação; o
 * máximo de 60 evita URL que não cabe em nada.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "O endereço precisa de pelo menos 3 caracteres")
  .max(60, "O endereço pode ter no máximo 60 caracteres")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use só letras, números e hífen — sem espaço, acento ou hífen no começo/fim"
  );

/**
 * Palavras que não podem virar slug porque já são rotas ou porque
 * confundiriam quem lê a URL.
 */
const SLUG_RESERVADOS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "checkin",
  "eventos",
  "events",
  "login",
  "logout",
  "novo",
  "public",
  "static",
  "uploads",
]);

export const updateEventConfigSchema = z.object({
  slug: slugSchema
    .refine((v) => !SLUG_RESERVADOS.has(v), {
      message: "Esse endereço é reservado pelo sistema. Escolha outro.",
    })
    .nullable()
    .optional(),
  // IANA. Não validamos contra uma lista fixa de propósito: o conjunto muda
  // (a IANA publica atualizações), e o Intl do runtime é a autoridade —
  // ver `timezoneValida` no service.
  timezone: z.string().trim().min(1).max(64).optional(),
  language: z.enum(["pt-BR", "en-US", "es-ES"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

export const moduleParamsSchema = z.object({
  eventId: z.string().uuid(),
  module: z.string().refine((v) => EVENT_MODULE_KEYS.has(v), {
    message: "Módulo desconhecido",
  }),
});

export const toggleModuleSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateEventConfigInput = z.infer<typeof updateEventConfigSchema>;
