-- CreateEnum
CREATE TYPE "CheckInAttemptStatus" AS ENUM ('ALREADY_CHECKED_IN', 'REJECTED');

-- CreateTable
CREATE TABLE "checkin_attempts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "participantName" TEXT,
    "participantEmail" TEXT,
    "participantPhone" TEXT,
    "participantDocument" TEXT,
    "terminalId" TEXT,
    "terminalName" TEXT,
    "status" "CheckInAttemptStatus" NOT NULL,
    "source" "CheckInSource" NOT NULL,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkin_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkin_attempts_eventId_attemptedAt_idx" ON "checkin_attempts"("eventId", "attemptedAt");
