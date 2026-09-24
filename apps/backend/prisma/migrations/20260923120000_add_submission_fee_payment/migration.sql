-- Taxa de submissão de trabalhos, cobrada pelo mesmo Mercado Pago da
-- inscrição (ver Submission.paymentStatus no schema).
--
-- Tudo anulável / com padrão NOT_REQUIRED: os trabalhos que já existem
-- foram cadastrados sem taxa e continuam exatamente como estão.
CREATE TYPE "SubmissionPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID');

ALTER TABLE "submissions"
  ADD COLUMN "paymentStatus"        "SubmissionPaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "feeAmount"            DECIMAL(10,2),
  ADD COLUMN "paymentProvider"      "PaymentProvider",
  ADD COLUMN "paymentMethod"        "PaymentMethod",
  ADD COLUMN "paymentId"            TEXT,
  ADD COLUMN "paymentUrl"           TEXT,
  ADD COLUMN "paymentQrCodeContent" TEXT,
  ADD COLUMN "paymentQrCodeBase64"  TEXT,
  ADD COLUMN "paymentExpiresAt"     TIMESTAMP(3),
  ADD COLUMN "paidAt"               TIMESTAMP(3);

-- Modalidade e área viram opcionais: evento sem catálogo cadastrado ainda
-- recebe trabalho pelo site. As chaves estrangeiras (RESTRICT) continuam
-- valendo para quem tem valor.
ALTER TABLE "submissions" ALTER COLUMN "modalityId" DROP NOT NULL;
ALTER TABLE "submissions" ALTER COLUMN "topicId" DROP NOT NULL;
