import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa ter no mínimo 8 caracteres").max(200),
  roleId: z.string().uuid("Selecione um perfil"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email("E-mail inválido").optional(),
  roleId: z.string().uuid().optional(),
  password: z.string().min(8, "A senha precisa ter no mínimo 8 caracteres").max(200).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userIdParamsSchema = z.object({
  userId: z.string().uuid("userId inválido"),
});
