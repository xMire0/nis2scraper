-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'UNDER_BANKRUPTCY', 'UNDER_DISSOLUTION', 'DISSOLVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Nis2Status" AS ENUM ('ESSENTIAL', 'IMPORTANT', 'SUPPLY_CHAIN_TARGET', 'OUT_OF_SCOPE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "Nis2Sector" AS ENUM ('ENERGY', 'TRANSPORT', 'BANKING', 'FINANCIAL_MARKET_INFRASTRUCTURE', 'HEALTH', 'DRINKING_WATER', 'WASTE_WATER', 'DIGITAL_INFRASTRUCTURE', 'ICT_SERVICE_MANAGEMENT', 'PUBLIC_ADMINISTRATION', 'SPACE', 'POSTAL_AND_COURIER', 'WASTE_MANAGEMENT', 'CHEMICALS', 'FOOD', 'MANUFACTURING', 'DIGITAL_PROVIDERS', 'RESEARCH', 'NONE');

-- CreateEnum
CREATE TYPE "AnnexType" AS ENUM ('ANNEX_1', 'ANNEX_2', 'NONE');

-- CreateEnum
CREATE TYPE "SizeClass" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'MEETING_SET', 'CLOSED_WON', 'CLOSED_LOST', 'DISQUALIFIED', 'RESEARCHED', 'READY', 'SCOPE', 'OFFER');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('CVR_DIREKTION', 'CVR_BESTYRELSE', 'CVR_REELLE_EJERE', 'APOLLO', 'HUNTER', 'DROPCONTACT', 'MANUAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'ACCEPT_ALL', 'INVALID');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('XBRL', 'IXBRL', 'PDF');

-- CreateEnum
CREATE TYPE "PipelineRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "cvr" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalForm" TEXT,
    "addressStreet" TEXT,
    "addressPostalCode" TEXT,
    "addressCity" TEXT,
    "addressMunicipality" TEXT,
    "addressCountry" TEXT DEFAULT 'DK',
    "db07Code" TEXT,
    "db07Description" TEXT,
    "secondaryDb07" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "employeeCount" INTEGER,
    "employeeCountSource" TEXT,
    "employeeCountAsOf" TIMESTAMP(3),
    "officialEmail" TEXT,
    "officialPhone" TEXT,
    "domain" TEXT,
    "website" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'UNKNOWN',
    "statusRaw" TEXT,
    "foundedAt" TIMESTAMP(3),
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "parentCvr" TEXT,
    "isGroupParent" BOOLEAN NOT NULL DEFAULT false,
    "cvrUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeMin" INTEGER,
    "employeeMax" INTEGER,
    "importedRevenue" DECIMAL(18,2),
    "importSource" TEXT,
    "termsCheckedAt" TIMESTAMP(3),
    "termsNote" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_persons" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cvrUnitNumber" TEXT,
    "name" TEXT NOT NULL,
    "rawTitle" TEXT,
    "title" TEXT,
    "seniorityScore" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "directEmail" TEXT,
    "emailStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "emailConfidence" DOUBLE PRECISION,
    "directPhone" TEXT,
    "linkedinUrl" TEXT,
    "source" "ContactSource" NOT NULL,
    "enrichedAt" TIMESTAMP(3),
    "enrichmentRaw" JSONB,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "suppressedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_data" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'DKK',
    "revenue" DECIMAL(18,2),
    "grossProfit" DECIMAL(18,2),
    "balanceSheet" DECIMAL(18,2),
    "equity" DECIMAL(18,2),
    "profitLoss" DECIMAL(18,2),
    "employeesAvg" INTEGER,
    "revenueDkk" DECIMAL(18,2),
    "balanceSheetDkk" DECIMAL(18,2),
    "fxRateToDkk" DOUBLE PRECISION,
    "managementReview" TEXT,
    "reportUrl" TEXT,
    "reportFormat" "ReportFormat",
    "publicationId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "documentHash" TEXT,
    "parseWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nis2_assessments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "Nis2Status" NOT NULL,
    "sector" "Nis2Sector" NOT NULL DEFAULT 'NONE',
    "subSector" TEXT,
    "annexType" "AnnexType" NOT NULL DEFAULT 'NONE',
    "sizeClass" "SizeClass" NOT NULL DEFAULT 'UNKNOWN',
    "deterministicMatch" BOOLEAN NOT NULL DEFAULT false,
    "sizeExempt" BOOLEAN NOT NULL DEFAULT false,
    "employeeCountUsed" INTEGER,
    "revenueDkkUsed" DECIMAL(18,2),
    "balanceDkkUsed" DECIMAL(18,2),
    "financialYearUsed" INTEGER,
    "deterministicRules" JSONB,
    "llmReasoning" TEXT,
    "llmConfidence" DOUBLE PRECISION,
    "llmModel" TEXT,
    "llmSectorEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "supplyChainSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "conflictNote" TEXT,
    "auditHook" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "overrideStatus" "Nis2Status",
    "overrideNote" TEXT,
    "scopedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rulesetVersion" TEXT NOT NULL DEFAULT '2026.1',

    CONSTRAINT "nis2_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_outreach_status" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'NEW',
    "assignedTo" TEXT,
    "nextAction" TEXT,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "meetingAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_outreach_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_events" (
    "id" TEXT NOT NULL,
    "outreachId" TEXT NOT NULL,
    "fromStatus" "OutreachStatus",
    "toStatus" "OutreachStatus" NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_runs" (
    "id" TEXT NOT NULL,
    "status" "PipelineRunStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT,
    "sectors" "Nis2Sector"[] DEFAULT ARRAY[]::"Nis2Sector"[],
    "db07Codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cvrList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "companiesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "reportsParsed" INTEGER NOT NULL DEFAULT 0,
    "companiesScoped" INTEGER NOT NULL DEFAULT 0,
    "contactsEnriched" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "pipeline_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyId" TEXT,
    "stage" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "rawCsv" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "companyId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_runs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "pages" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'RULES',
    "model" TEXT,
    "config" JSONB NOT NULL,

    CONSTRAINT "enrichment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "priority" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "relevance" TEXT NOT NULL,
    "directLevel" TEXT NOT NULL,
    "supplyLevel" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "evidenceIds" TEXT[],
    "configVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_suppressions" (
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_suppressions_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "outreach" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scoreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_configs" (
    "id" SERIAL NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_locks" (
    "domain" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_locks_pkey" PRIMARY KEY ("domain")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_cvr_key" ON "companies"("cvr");

-- CreateIndex
CREATE INDEX "companies_db07Code_idx" ON "companies"("db07Code");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "companies_employeeCount_idx" ON "companies"("employeeCount");

-- CreateIndex
CREATE INDEX "companies_domain_idx" ON "companies"("domain");

-- CreateIndex
CREATE INDEX "contact_persons_companyId_seniorityScore_idx" ON "contact_persons"("companyId", "seniorityScore");

-- CreateIndex
CREATE INDEX "contact_persons_directEmail_idx" ON "contact_persons"("directEmail");

-- CreateIndex
CREATE UNIQUE INDEX "contact_persons_companyId_name_source_key" ON "contact_persons"("companyId", "name", "source");

-- CreateIndex
CREATE INDEX "financial_data_year_idx" ON "financial_data"("year");

-- CreateIndex
CREATE UNIQUE INDEX "financial_data_companyId_year_key" ON "financial_data"("companyId", "year");

-- CreateIndex
CREATE INDEX "nis2_assessments_companyId_scopedAt_idx" ON "nis2_assessments"("companyId", "scopedAt");

-- CreateIndex
CREATE INDEX "nis2_assessments_status_idx" ON "nis2_assessments"("status");

-- CreateIndex
CREATE INDEX "nis2_assessments_sector_idx" ON "nis2_assessments"("sector");

-- CreateIndex
CREATE INDEX "nis2_assessments_annexType_idx" ON "nis2_assessments"("annexType");

-- CreateIndex
CREATE UNIQUE INDEX "lead_outreach_status_companyId_key" ON "lead_outreach_status"("companyId");

-- CreateIndex
CREATE INDEX "lead_outreach_status_status_assignedTo_idx" ON "lead_outreach_status"("status", "assignedTo");

-- CreateIndex
CREATE INDEX "outreach_events_outreachId_createdAt_idx" ON "outreach_events"("outreachId", "createdAt");

-- CreateIndex
CREATE INDEX "pipeline_runs_status_startedAt_idx" ON "pipeline_runs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "pipeline_events_runId_createdAt_idx" ON "pipeline_events"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "pipeline_events_companyId_idx" ON "pipeline_events"("companyId");

-- CreateIndex
CREATE INDEX "import_rows_companyId_idx" ON "import_rows"("companyId");

-- CreateIndex
CREATE INDEX "enrichment_runs_companyId_startedAt_idx" ON "enrichment_runs"("companyId", "startedAt");

-- CreateIndex
CREATE INDEX "evidence_companyId_runId_idx" ON "evidence"("companyId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "scores_runId_key" ON "scores"("runId");

-- CreateIndex
CREATE INDEX "scores_companyId_createdAt_idx" ON "scores"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_companyId_value_key" ON "contacts"("companyId", "value");

-- CreateIndex
CREATE INDEX "outreach_companyId_createdAt_idx" ON "outreach"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "contact_persons" ADD CONSTRAINT "contact_persons_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_data" ADD CONSTRAINT "financial_data_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nis2_assessments" ADD CONSTRAINT "nis2_assessments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_outreach_status" ADD CONSTRAINT "lead_outreach_status_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_outreachId_fkey" FOREIGN KEY ("outreachId") REFERENCES "lead_outreach_status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_runs" ADD CONSTRAINT "enrichment_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_runId_fkey" FOREIGN KEY ("runId") REFERENCES "enrichment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_runId_fkey" FOREIGN KEY ("runId") REFERENCES "enrichment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
