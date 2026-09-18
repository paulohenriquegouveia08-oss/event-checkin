-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'PICPAY', 'MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CARD');

-- DropIndex
DROP INDEX "events_certificateTemplateId_idx";

-- AlterTable
ALTER TABLE "event_batches" ADD COLUMN     "allowCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowPix" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "inscriptions" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentProvider" "PaymentProvider";
