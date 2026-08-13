-- AlterTable
ALTER TABLE "events" ADD COLUMN     "registrationDeadline" TIMESTAMP(3),
ADD COLUMN     "registrationsClosedAt" TIMESTAMP(3),
ADD COLUMN     "siteContent" JSONB;
