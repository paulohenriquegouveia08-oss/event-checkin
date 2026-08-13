import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_SEED_NAME;
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      "ADMIN_SEED_NAME, ADMIN_SEED_EMAIL e ADMIN_SEED_PASSWORD precisam estar definidos no .env para rodar o seed."
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário admin ${email} já existe. Nada a fazer.`);
    return;
  }

  // O perfil bootstrap ADMINISTRADOR é criado pela migration
  // 20260813000000_rbac_roles_permissions — se não existir, o seed não
  // tem pra qual perfil vincular o usuário.
  const adminRole = await prisma.role.findUnique({ where: { key: "ADMINISTRADOR" } });
  if (!adminRole) {
    console.error(
      "Perfil ADMINISTRADOR não encontrado — rode as migrations (prisma migrate deploy) antes do seed."
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, roleId: adminRole.id },
  });

  console.log(`Usuário admin criado: ${user.email} (id ${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
