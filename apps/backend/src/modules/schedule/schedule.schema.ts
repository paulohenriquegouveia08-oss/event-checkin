import { z } from "zod";

export const createScheduleItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  startTime: z.string().min(1, "Horário de início é obrigatório").max(10),
  endTime: z.string().max(10).optional().nullable(),
  title: z.string().trim().min(1, "Título é obrigatório").max(200),
  speaker: z.string().trim().max(150).optional().nullable(),
  location: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().optional().nullable(),
  type: z.string().trim().max(50).optional().nullable(),
  order: z.coerce.number().int().default(0),
});

export const updateScheduleItemSchema = createScheduleItemSchema.partial();

export type CreateScheduleItemInput = z.infer<typeof createScheduleItemSchema>;
export type UpdateScheduleItemInput = z.infer<typeof updateScheduleItemSchema>;
