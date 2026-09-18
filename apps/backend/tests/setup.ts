import { userInfo } from "node:os";
import { vi } from "vitest";

// Executado antes de cada arquivo de teste, antes de qualquer módulo da
// aplicação ser importado — garante que src/config/env.ts valide as
// variáveis do ambiente de teste, não as do .env de desenvolvimento.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/event_checkin_test`;
process.env.JWT_SECRET = "test-secret-32-characters-minimum-length";
process.env.JWT_ADMIN_EXPIRES_IN = "1h";
process.env.RESEND_API_KEY = "";

// Mercado Pago nos testes.
//
// Sem MP_ACCESS_TOKEN o cliente fica em modo simulado: nenhuma chamada
// sai para fora e nenhuma cobranca real e' criada. Ja o segredo do
// webhook PRECISA existir aqui — o env.ts congela as variaveis no
// import, e definir isso dentro do arquivo de teste seria tarde demais.
process.env.MP_ACCESS_TOKEN = "";
process.env.MP_PUBLIC_KEY = "";
process.env.MP_WEBHOOK_SECRET = "segredo-de-teste-do-webhook";

// Mock do Resend com transporte mock para evitar chamadas de rede e erros 403 em testes
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = {
        send: vi.fn().mockResolvedValue({ data: { id: "mock-email-id" }, error: null }),
      };
      domains = {
        list: vi.fn().mockResolvedValue({ data: { data: [] }, error: null }),
      };
    },
  };
});

