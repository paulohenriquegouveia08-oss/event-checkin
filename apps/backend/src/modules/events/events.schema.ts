import { z } from "zod";
import { siteContentSchema } from "./site-content.js";
import { certificateSettingsSchema } from "../certificates/certificate-settings.js";
import { emailSettingsSchema } from "../../lib/email/email-settings.js";

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(200),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(300).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    registrationDeadline: z.coerce.date().nullable().optional(),
    siteContent: siteContentSchema.optional(),
    certificateSettings: certificateSettingsSchema.optional(),
    emailSettings: emailSettingsSchema.optional(),
  /**
   * Modelo de certificado da biblioteca. `null` volta ao modelo embutido.
   *
   * Trocar isto invalida os PDFs já gerados deste evento (o modelo entra
   * no hash de conteúdo), e o próximo download regenera com a arte nova.
   */
  certificateTemplateId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate deve ser igual ou posterior a startDate",
    path: ["endDate"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(300).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
  // null explicitamente remove o prazo (inscrições ficam abertas até
  // encerramento manual, se houver)
  registrationDeadline: z.coerce.date().nullable().optional(),
  siteContent: siteContentSchema.optional(),
  certificateSettings: certificateSettingsSchema.optional(),
  emailSettings: emailSettingsSchema.optional(),
  /**
   * Modelo de certificado da biblioteca. `null` volta ao modelo embutido.
   *
   * Trocar isto invalida os PDFs já gerados deste evento (o modelo entra
   * no hash de conteúdo), e o próximo download regenera com a arte nova.
   */
  certificateTemplateId: z.string().uuid().nullable().optional(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventIdParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});
