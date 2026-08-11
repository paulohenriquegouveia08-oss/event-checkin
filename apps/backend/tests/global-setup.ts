import { execSync } from "node:child_process";
import { userInfo } from "node:os";

/**
 * Roda uma única vez antes de toda a suíte: aplica as migrations no banco
 * de teste dedicado (event_checkin_test), isolado do banco de dev e de
 * qualquer outro projeto do monorepo PK Digital.
 */
export default function globalSetup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ??
    `postgresql://${userInfo().username}@localhost:5432/event_checkin_test`;

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
