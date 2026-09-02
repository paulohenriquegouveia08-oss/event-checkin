-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN "paymentUrl" TEXT,
ADD COLUMN "qrCodeBase64" TEXT,
ADD COLUMN "qrCodeContent" TEXT,
ADD COLUMN "paymentExpiresAt" TIMESTAMP(3),
ADD COLUMN "batchId" TEXT;

-- CreateTable
CREATE TABLE "event_batches" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "maxQuantity" INTEGER,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_schedule_items" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" VARCHAR(10) NOT NULL,
    "endTime" VARCHAR(10),
    "title" VARCHAR(200) NOT NULL,
    "speaker" VARCHAR(150),
    "location" VARCHAR(150),
    "description" TEXT,
    "type" VARCHAR(50),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_batches_eventId_batchNumber_key" ON "event_batches"("eventId", "batchNumber");

-- CreateIndex
CREATE INDEX "event_batches_eventId_idx" ON "event_batches"("eventId");

-- CreateIndex
CREATE INDEX "event_schedule_items_eventId_date_order_idx" ON "event_schedule_items"("eventId", "date", "order");

-- CreateIndex
CREATE INDEX "inscriptions_batchId_idx" ON "inscriptions"("batchId");

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "event_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_batches" ADD CONSTRAINT "event_batches_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schedule_items" ADD CONSTRAINT "event_schedule_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
