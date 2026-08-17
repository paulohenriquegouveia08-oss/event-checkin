import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET deve ter pelo menos 16 caracteres"),
  JWT_ADMIN_EXPIRES_IN: z.string().default("8h"),
  CORS_ORIGINS: z.string().optional().default(""),

  // Diretório onde certificados/comprovantes gerados são gravados (ver
  // certificate-storage.ts) — relativo ao cwd do processo se não for
  // absoluto. Trocar por storage externo no futuro não muda este env var,
  // só a implementação de CertificateStorage.
  STORAGE_DIR: z.string().min(1).default("./storage"),

  // Base pública do portal pre-copol, usada só para montar a URL de
  // validação embutida no QR Code do certificado (ex.:
  // "https://precopol.lspktecnology.com.br/certificados"). Sem barra no
  // final.
  CERTIFICATE_VALIDATION_BASE_URL: z.string().min(1).default("http://localhost:3002/certificados"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Falha rápida e clara na inicialização — nunca subir o servidor com
  // configuração inválida ou secrets ausentes.
  console.error("Variáveis de ambiente inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
