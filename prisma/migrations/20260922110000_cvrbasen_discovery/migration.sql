-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "advertisingProtected" BOOLEAN,
ADD COLUMN     "registryFetchedAt" TIMESTAMP(3),
ADD COLUMN     "registrySourceUrl" TEXT;

-- CreateTable
CREATE TABLE "discovery_state" (
    "id" TEXT NOT NULL DEFAULT 'cvrbasen',
    "config" JSONB NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "requestsToday" INTEGER NOT NULL DEFAULT 0,
    "budgetDay" TEXT NOT NULL DEFAULT '',
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "page" INTEGER NOT NULL,
    "examined" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "reasons" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

