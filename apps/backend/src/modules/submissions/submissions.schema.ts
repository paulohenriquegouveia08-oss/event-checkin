import { z } from "zod";

export const eventIdParams = z.object({ eventId: z.string().uuid() });
export const submissionIdParams = z.object({
  eventId: z.string().uuid(),
  submissionId: z.string().uuid(),
});
export const catalogIdParams = z.object({
  eventId: z.string().uuid(),
  id: z.string().uuid(),
});

/** Modalidade e área usam a mesma forma — nome, ordem e ativo. */
const catalogItem = {
  name: z.string().trim().min(2, "Dê um nome com pelo menos 2 letras").max(80),
  active: z.boolean().optional(),
  position: z.number().int().min(0).max(999).optional(),
};

export const createModalitySchema = z.object({
  ...catalogItem,
  description: z.string().trim().max(500).nullable().optional(),
});
export const updateModalitySchema = createModalitySchema.partial();

export const createTopicSchema = z.object(catalogItem);
export const updateTopicSchema = createTopicSchema.partial();

export const submissionSettingsSchema = z
  .object({
    opensAt: z.coerce.date().nullable().optional(),
    closesAt: z.coerce.date().nullable().optional(),
    authorFeeRequired: z.boolean().optional(),
    authorFeeAmount: z.number().nonnegative().nullable().optional(),
    maxFileSizeMb: z.number().int().min(1).max(100).optional(),
    minReviewsToDecide: z.number().int().min(1).max(10).optional(),
  })
  .refine(
    (v) => !v.opensAt || !v.closesAt || v.opensAt < v.closesAt,
    // Sem esta checagem dá para gravar uma janela que nunca abre, e o
    // sintoma seria "ninguém consegue submeter" sem nada na tela explicando.
    { message: "A abertura precisa ser antes do fechamento", path: ["closesAt"] }
  );

const authorSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email(),
  institution: z.string().trim().max(150).nullable().optional(),
  isPresenter: z.boolean().optional(),
});

export const createSubmissionSchema = z.object({
  modalityId: z.string().uuid(),
  topicId: z.string().uuid(),
  title: z.string().trim().min(5, "O título está curto demais").max(300),
  abstract: z.string().trim().min(50, "O resumo precisa de pelo menos 50 caracteres").max(10000),
  keywords: z.array(z.string().trim().min(2).max(50)).min(1).max(10),
  // Pelo menos um autor, e a regra de "exatamente um apresentador" é
  // verificada no service — aqui só garante que a lista não vem vazia.
  authors: z.array(authorSchema).min(1, "Informe pelo menos um autor").max(20),
});

export const updateSubmissionSchema = createSubmissionSchema.partial();

export const decideSubmissionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(2000).optional(),
});

export const listSubmissionsQuery = z.object({
  status: z
    .enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN"])
    .optional(),
  modalityId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type SubmissionSettingsInput = z.infer<typeof submissionSettingsSchema>;

/**
 * Upload do PDF do trabalho, em base64.
 *
 * Base64 e não multipart porque é assim que o resto do sistema já recebe
 * arquivo (ver a imagem de assinatura em certificates.routes.ts) — e uma
 * dependência a menos.
 */
export const uploadFileSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    // Só metadado: o caminho no disco é montado pelo servidor. Ainda assim
    // recusa separador de diretório, para o nome não virar caminho se um
    // dia alguém usá-lo para montar um.
    .refine((v) => !v.includes("/") && !v.includes("\\") && !v.includes(".."), {
      message: "Nome de arquivo inválido",
    }),
  dataBase64: z.string().min(1, "Arquivo vazio"),
});
