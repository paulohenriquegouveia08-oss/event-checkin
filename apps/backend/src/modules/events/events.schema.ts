import { z } from "zod";

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(200),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(300).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
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
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventIdParamsSchema = z.object({
  eventId: z.string().uuid("eventId inválido"),
});
