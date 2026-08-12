-- CreateEnum
CREATE TYPE "InscriptionCategory" AS ENUM ('STUDENT_UP', 'STUDENT_OTHER', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "InscriptionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inscriptions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "phone" TEXT,
    "institution" TEXT,
    "category" "InscriptionCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "InscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inscriptions_eventId_idx" ON "inscriptions"("eventId");

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
