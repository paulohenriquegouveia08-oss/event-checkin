import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { ok } from "./shared/response.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { participantsRoutes } from "./modules/participants/participants.routes.js";
import { terminalsRoutes } from "./modules/terminals/terminals.routes.js";
import { checkinsRoutes } from "./modules/checkins/checkins.routes.js";
import { synchronizationRoutes } from "./modules/synchronization/synchronization.routes.js";
import { attendeeRoutes } from "./modules/attendee/attendee.routes.js";
import { inscriptionsRoutes } from "./modules/inscriptions/inscriptions.routes.js";
import { rolesRoutes } from "./modules/roles/roles.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { certificatesRoutes } from "./modules/certificates/certificates.routes.js";

// Versão da API — usada pelo app do terminal para verificar compatibilidade
// (seção 27 da especificação). Incrementar em mudanças que quebrem contrato.
const API_VERSION = "0.1.0";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
      redact: ["req.headers.authorization"],
    },
    trustProxy: true,
  });

  app.setErrorHandler(errorHandler);

  app.register(helmet);
  app.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      // Vercel preview deployments get a new random subdomain per deploy
      // (ex: event-checkin-pre-copol-56c1lnfk7.vercel.app) — aceitar
      // qualquer *.vercel.app evita ter que atualizar CORS_ORIGINS a cada
      // deploy novo do portal do participante.
      const isVercelPreview = !!origin && /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin) || isVercelPreview) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
  });
  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      // Don't rate-limit SSE connections by the same key
      if (request.url.startsWith("/attendee/checkin-status") || request.url.includes("/monitor")) {
        return `sse-${request.ip}`;
      }
      return request.ip;
    },
  });
  app.register(jwt, { secret: env.JWT_SECRET });

  app.get("/health", async () => ok({ status: "ok", apiVersion: API_VERSION }));

  app.register(authRoutes);
  app.register(eventsRoutes);
  app.register(participantsRoutes);
  app.register(terminalsRoutes);
  app.register(checkinsRoutes);
  app.register(synchronizationRoutes);
  app.register(attendeeRoutes);
  app.register(inscriptionsRoutes);
  app.register(rolesRoutes);
  app.register(usersRoutes);
  app.register(auditRoutes);
  app.register(certificatesRoutes);

  return app;
}
