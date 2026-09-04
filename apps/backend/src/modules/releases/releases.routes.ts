import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { NotFoundError } from "../../shared/errors.js";
import { ok } from "../../shared/response.js";

/**
 * APK do app do terminal (Fase 2, apps/mobile) — não é gerado pelo
 * backend, é build local via Gradle (cd apps/mobile/android &&
 * ./gradlew assembleRelease). Publicar uma versão nova é copiar o
 * app-release.apk gerado pra este caminho, sob STORAGE_DIR — o mesmo
 * diretório usado por certificados/comprovantes (certificate-storage.ts),
 * que já é um volume Docker persistente em produção (ver
 * docker-compose.yml). Nenhum volume novo precisou ser criado.
 */
const APK_PATH = join(env.STORAGE_DIR, "releases", "app-release.apk");
const APK_DOWNLOAD_NAME = "pk-digital-credenciamento.apk";

export async function releasesRoutes(app: FastifyInstance) {
  // Disponível publicamente e no painel admin — artefato de instalação do app leitor de QR Code
  app.get("/apk/info", async () => {
    try {
      const stats = await stat(APK_PATH);
      return ok({ available: true, sizeBytes: stats.size, updatedAt: stats.mtime.toISOString() });
    } catch {
      return ok({ available: false, sizeBytes: null, updatedAt: null });
    }
  });

  app.get("/apk", async (_request, reply) => {
    let stats;
    try {
      stats = await stat(APK_PATH);
    } catch {
      throw new NotFoundError("Nenhum APK disponível no servidor ainda.");
    }

    // Stream em vez de ler o arquivo inteiro em memória (buffer), diferente
    // do padrão usado pros PDFs de certificado — o APK é ~100MB, não faz
    // sentido carregar tudo de uma vez no processo do backend.
    reply.header("Content-Type", "application/vnd.android.package-archive");
    reply.header("Content-Disposition", `attachment; filename="${APK_DOWNLOAD_NAME}"`);
    reply.header("Content-Length", String(stats.size));
    return reply.send(createReadStream(APK_PATH));
  });
}
