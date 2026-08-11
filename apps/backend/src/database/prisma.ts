import { PrismaClient } from "@prisma/client";

// Instância única do Prisma Client para toda a aplicação (evita esgotar
// o pool de conexões do Postgres com múltiplas instâncias).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
