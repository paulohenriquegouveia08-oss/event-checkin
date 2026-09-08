import { z } from "zod";
import { certificateLayoutSchema } from "../certificates/certificate-layout.js";

/**
 * O layout chega SEM as dimensões da imagem.
 *
 * Elas são lidas do arquivo enviado, no servidor. Aceitar do cliente
 * permitiria declarar 1536×1024 e mandar uma imagem 800×600 — as
 * coordenadas ficariam numa escala que não é a da arte, e o nome sairia
 * no lugar errado sem erro nenhum.
 */
export const layoutSemDimensoesSchema = certificateLayoutSchema.omit({
  imagemLargura: true,
  imagemAltura: true,
});

export const criarModeloSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao modelo").max(120),
  description: z.string().trim().max(1000).optional(),
  mimeType: z.string().trim().min(1).max(60),
  /** Base64 puro, sem o prefixo "data:image/png;base64,". */
  dataBase64: z.string().min(1),
  layout: layoutSemDimensoesSchema,
});

export const atualizarModeloSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  layout: layoutSemDimensoesSchema.optional(),
  /** Trocar a arte é opcional; sem isto, só os metadados mudam. */
  mimeType: z.string().trim().min(1).max(60).optional(),
  dataBase64: z.string().min(1).optional(),
});

export const modeloIdParamsSchema = z.object({
  templateId: z.string().uuid("templateId inválido"),
});

export type CriarModeloInput = z.infer<typeof criarModeloSchema>;
export type AtualizarModeloInput = z.infer<typeof atualizarModeloSchema>;
