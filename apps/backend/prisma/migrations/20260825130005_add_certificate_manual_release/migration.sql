-- AlterTable
ALTER TABLE "certificates" ADD COLUMN     "manuallyReleasedAt" TIMESTAMP(3),
ADD COLUMN     "manuallyReleasedBy" TEXT;
