-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('LOCKED', 'ELIGIBLE', 'GENERATED', 'REVOKED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "certificateSettings" JSONB;

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'LOCKED',
    "verificationCode" TEXT NOT NULL,
    "fileKey" TEXT,
    "workloadHours" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_proofs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "fileKey" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_verificationCode_key" ON "certificates"("verificationCode");

-- CreateIndex
CREATE INDEX "certificates_eventId_idx" ON "certificates"("eventId");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "certificates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_eventId_participantId_key" ON "certificates"("eventId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_proofs_verificationCode_key" ON "attendance_proofs"("verificationCode");

-- CreateIndex
CREATE INDEX "attendance_proofs_eventId_idx" ON "attendance_proofs"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_proofs_eventId_participantId_key" ON "attendance_proofs"("eventId", "participantId");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_proofs" ADD CONSTRAINT "attendance_proofs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_proofs" ADD CONSTRAINT "attendance_proofs_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
