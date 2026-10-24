ALTER TABLE "companies" ADD COLUMN "autoEnrichmentQueuedAt" TIMESTAMP(3),
ADD COLUMN "autoEnrichmentStartedAt" TIMESTAMP(3),
ADD COLUMN "autoEnrichmentNote" TEXT,
ADD COLUMN "autoEnrichmentScoreId" TEXT;
ALTER TABLE "scores" ADD COLUMN "icp" JSONB;
UPDATE "companies" SET "autoEnrichmentQueuedAt" = CURRENT_TIMESTAMP
WHERE "autoEnrichmentNextAt" = '1970-01-01 00:00:00.001';
