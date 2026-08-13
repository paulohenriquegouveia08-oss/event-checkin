-- RBAC dirigido por dados: roles/permissions/role_permissions novos,
-- users passa de "role" (enum fixo) pra "roleId" (FK pra roles, editável
-- via UI sem migration nova). Migra os usuários existentes pro papel
-- bootstrap ADMINISTRADOR sem perder nenhum (UPDATE antes do NOT NULL).

-- CreateTable roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateTable permissions
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateTable role_permissions
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Bootstrap: único papel pré-criado. isSystem = true (não pode ser
-- excluído/editado) porque precisa sempre existir alguém capaz de criar
-- os outros perfis pela UI — ver requirePermission() em src/middleware/auth.ts.
INSERT INTO "roles" ("id", "key", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'ADMINISTRADOR', 'Administrador', 'Acesso completo ao sistema. Perfil protegido, não pode ser excluído.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable users: roleId nullable por enquanto (populamos antes de tornar obrigatório)
ALTER TABLE "users" ADD COLUMN "roleId" TEXT;
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- Migra todo usuário existente pro bootstrap ADMINISTRADOR — hoje só existe
-- o enum UserRole.ADMIN, que é semanticamente o mesmo papel.
UPDATE "users" SET "roleId" = (SELECT "id" FROM "roles" WHERE "key" = 'ADMINISTRADOR');

ALTER TABLE "users" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" DROP COLUMN "role";

-- Enum antigo não é mais usado por nenhuma coluna
DROP TYPE "UserRole";
