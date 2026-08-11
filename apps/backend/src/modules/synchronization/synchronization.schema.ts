import { z } from "zod";

export const syncCheckInItemSchema = z.object({
  localCheckInId: z.string().min(1, "localCheckInId é obrigatório"),
  qrToken: z.string().min(1, "qrToken é obrigatório"),
  checkedInAt: z.coerce.date(),
});

export const syncRequestSchema = z.object({
  checkIns: z.array(syncCheckInItemSchema).min(1).max(500),
});

export type SyncRequestInput = z.infer<typeof syncRequestSchema>;
