import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { ok } from "../../shared/response.js";
import { authenticateAdmin } from "./auth.service.js";
import { loginSchema } from "./auth.schema.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await authenticateAdmin(email, password);

    const token = await reply.jwtSign(
      { sub: user.id, role: user.role.key, type: "admin" as const },
      { expiresIn: env.JWT_ADMIN_EXPIRES_IN }
    );

    return ok({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  });
}
