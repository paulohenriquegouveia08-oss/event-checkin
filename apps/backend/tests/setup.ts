import { userInfo } from "node:os";

// Executado antes de cada arquivo de teste, antes de qualquer módulo da
// aplicação ser importado — garante que src/config/env.ts valide as
// variáveis do ambiente de teste, não as do .env de desenvolvimento.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? `postgresql://${userInfo().username}@localhost:5432/event_checkin_test`;
process.env.JWT_SECRET = "test-secret-32-characters-minimum-length";
process.env.JWT_ADMIN_EXPIRES_IN = "1h";
