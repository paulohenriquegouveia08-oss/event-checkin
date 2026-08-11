-- AlterEnum: Remove DRAFT from EventStatus, set any DRAFT events to ACTIVE
UPDATE "events" SET "status" = 'ACTIVE' WHERE "status" = 'DRAFT';

-- Recreate enum without DRAFT
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TYPE "EventStatus" RENAME TO "EventStatus_old";
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'CLOSED');
ALTER TABLE "events" ALTER COLUMN "status" TYPE "EventStatus" USING "status"::text::"EventStatus";
DROP TYPE "EventStatus_old";
