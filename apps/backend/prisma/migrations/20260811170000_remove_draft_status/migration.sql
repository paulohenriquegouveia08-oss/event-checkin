-- AlterEnum: Remove DRAFT from EventStatus, set any DRAFT events to ACTIVE
UPDATE "events" SET "status" = 'ACTIVE' WHERE "status" = 'DRAFT';

-- Recreate enum without DRAFT
-- O DEFAULT precisa ser removido ANTES de trocar o tipo da coluna --
-- o Postgres não consegue re-castar um default de enum automaticamente
-- pro novo tipo (erro 42804). Removido aqui e recriado depois da troca.
ALTER TABLE "events" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "EventStatus" RENAME TO "EventStatus_old";
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'CLOSED');
ALTER TABLE "events" ALTER COLUMN "status" TYPE "EventStatus" USING "status"::text::"EventStatus";
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "EventStatus_old";
