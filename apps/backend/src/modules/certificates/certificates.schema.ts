import { z } from "zod";

export const eventIdParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});

export const certificateIdParamsSchema = z.object({
  certificateId: z.string().uuid("certificateId inválido"),
});

/** Rotas de certificado por participante usadas pelo painel do admin
 * (liberação manual e download). O participantId aqui vem da URL, não de
 * um token de attendee — quem protege é requirePermission na rota. */
export const eventParticipantParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
  participantId: z.string().uuid("participantId inválido"),
});

export const verificationCodeParamsSchema = z.object({
  code: z.string().trim().min(1).max(120),
});

export const certificatePreviewQuerySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
});

export const uploadSignatureImageSchema = z.object({
  mimeType: z.string().trim().min(1).max(60),
  // Base64 puro (sem o prefixo "data:image/png;base64,") — o admin já
  // separa isso no cliente antes de mandar, ver api/client.ts do admin.
  dataBase64: z.string().min(1),
});

export const signatureImageParamsSchema = z.object({
  filename: z.string().trim().regex(/^[a-f0-9-]{36}\.(png|jpe?g)$/i, "Nome de arquivo inválido"),
});

export const signatureImageQuerySchema = z.object({
  token: z.string().trim().min(1),
});
