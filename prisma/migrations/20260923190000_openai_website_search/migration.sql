CREATE TABLE "website_search_runs" (
  "id" TEXT NOT NULL,
  "queryHash" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "retryAt" TIMESTAMP(3),
  "result" JSONB,
  "error" TEXT,
  CONSTRAINT "website_search_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "website_search_runs_startedAt_idx" ON "website_search_runs"("startedAt");
CREATE INDEX "website_search_runs_queryHash_startedAt_idx" ON "website_search_runs"("queryHash", "startedAt");
