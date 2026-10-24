ALTER TABLE "companies" ADD COLUMN "websiteHint" TEXT, ADD COLUMN "websiteDiscovery" JSONB;
ALTER TABLE "contacts" ADD COLUMN "name" TEXT, ADD COLUMN "title" TEXT;
ALTER TABLE "discovery_state" ADD COLUMN "statusIndex" INTEGER NOT NULL DEFAULT 0;
