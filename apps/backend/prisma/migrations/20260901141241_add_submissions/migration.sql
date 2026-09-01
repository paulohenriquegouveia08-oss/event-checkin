-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "submission_settings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "authorFeeRequired" BOOLEAN NOT NULL DEFAULT false,
    "authorFeeAmount" DECIMAL(10,2),
    "maxFileSizeMb" INTEGER NOT NULL DEFAULT 10,
    "minReviewsToDecide" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_modalities" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_modalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_topics" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "keywords" TEXT[],
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "similarityScore" DOUBLE PRECISION,
    "similarityCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_authors" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "institution" TEXT,
    "isPresenter" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "submission_authors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_settings_eventId_key" ON "submission_settings"("eventId");

-- CreateIndex
CREATE INDEX "submission_modalities_eventId_idx" ON "submission_modalities"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_modalities_eventId_name_key" ON "submission_modalities"("eventId", "name");

-- CreateIndex
CREATE INDEX "submission_topics_eventId_idx" ON "submission_topics"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_topics_eventId_name_key" ON "submission_topics"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_code_key" ON "submissions"("code");

-- CreateIndex
CREATE INDEX "submissions_eventId_status_idx" ON "submissions"("eventId", "status");

-- CreateIndex
CREATE INDEX "submissions_modalityId_idx" ON "submissions"("modalityId");

-- CreateIndex
CREATE INDEX "submissions_topicId_idx" ON "submissions"("topicId");

-- CreateIndex
CREATE INDEX "submission_authors_submissionId_idx" ON "submission_authors"("submissionId");

-- AddForeignKey
ALTER TABLE "submission_settings" ADD CONSTRAINT "submission_settings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_modalities" ADD CONSTRAINT "submission_modalities_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_topics" ADD CONSTRAINT "submission_topics_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "submission_modalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "submission_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_authors" ADD CONSTRAINT "submission_authors_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

