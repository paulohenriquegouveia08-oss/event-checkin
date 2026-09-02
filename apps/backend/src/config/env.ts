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

  // Integração PicPay E-Commerce
  PICPAY_TOKEN: z.string().optional().default(""),
  PICPAY_SELLER_TOKEN: z.string().optional().default(""),

  // Envio de e-mails via Resend
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("COPOL 2026 <contato@copol2026.com.br>"),

  // URLs públicas do sistema
  PRE_COPOL_BASE_URL: z.string().default("https://copol2026.com.br"),
  BACKEND_PUBLIC_URL: z.string().default("http://137.131.233.254:3000"),
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
