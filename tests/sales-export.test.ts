import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  buildSalesWorkbook,
  exportColumns,
  exportFilename,
  filterExportCompanies,
  sortExportCompanies,
  toExportRow,
  type ExportCompany,
} from "../src/lib/intelligence/sales-export";

function company(partial: Partial<ExportCompany> & Pick<ExportCompany, "id" | "cvr" | "name">): ExportCompany {
  return {
    status: "ACTIVE",
    website: "https://example.dk",
    addressCity: "København",
    db07Description: "IT-konsulentvirksomhed",
    employeeCount: 80,
    employeeMin: 80,
    employeeMax: 80,
    importedRevenue: "12500000",
    scores: [
      {
        value: 72,
        priority: "A",
        segment: "Managed service",
        relevance: "SUPPLY",
        directLevel: "LOW",
        supplyLevel: "HIGH",
        coverage: "COMPLETE",
        explanation: "Leverer managed services til kritisk infrastruktur.",
        angle: "Start med gratis scope-afklaring.",
        evidenceIds: ["ev1"],
        createdAt: "2026-10-01T12:00:00.000Z",
        icp: {
          fit: "STRONG",
          segment: "MSP",
          size: "Medium",
          customers: "Offentlige og energi",
          summary: "Stærkt match på leverandørkrav.",
        },
      },
    ],
    evidence: [
      {
        id: "ev1",
        keyword: "managed service",
        signal: "services",
        excerpt: "Vi leverer managed service til energiselskaber",
        url: "https://example.dk/cases",
      },
    ],
    publicContacts: [
      {
        kind: "EMAIL",
        name: "Anne Andersen",
        title: "CEO",
        value: "anne@example.dk",
        sourceUrl: "https://example.dk/kontakt",
      },
      {
        kind: "PHONE",
        name: null,
        title: null,
        value: "+4523456789",
        sourceUrl: "https://example.dk/kontakt",
      },
      {
        kind: "PHONE",
        name: null,
        title: null,
        value: "+4511223344",
        sourceUrl: "https://api.cvrbasen.dk/v1/companies/10000009",
      },
      {
        kind: "ROLE",
        name: "Anne Andersen",
        title: "Direktør",
        value: "Anne Andersen · Direktør",
        sourceUrl: "https://api.cvrbasen.dk/v1/companies/10000009",
      },
    ],
    drafts: [
      {
        channel: "EMAIL",
        body: "Hej Anne — vi hjælper leverandører med NIS2-dokumentation.",
        createdAt: "2026-10-02T12:00:00.000Z",
      },
    ],
    outreach: {
      status: "READY",
      notes: "God fit til MSP-kampagne",
      nextAction: "Ring tirsdag",
      nextFollowUpAt: "2026-10-10T12:00:00.000Z",
    },
    financials: [{ year: 2024, revenue: "12500000", grossProfit: null }],
    ...partial,
  };
}

test("salesperson rows use Danish headers and sales-friendly values", () => {
  const row = toExportRow(company({ id: "c1", cvr: "10000009", name: "Eksempel A/S" }));
  assert.equal(row.Virksomhedsnavn, "Eksempel A/S");
  assert.equal(row.CVR, "10000009");
  assert.equal(row.Registerstatus, "Aktiv");
  assert.equal(row.Salgsstatus, "Klar til kontakt");
  assert.equal(row.Relevans, "Sandsynlig leverandør med afledte kundekrav");
  assert.equal(row["ICP-match"], "Stærkt");
  assert.equal(row.Prioritet, "A");
  assert.equal(row.Leadscore, 72);
  assert.equal(row.Telefon, "+4523456789");
  assert.match(String(row.Kontakter), /anne@example\.dk/);
  assert.match(String(row.Kontakter), /\+4523456789/);
  assert.match(String(row.Kontakter), /Telefon \(hjemmeside\)/);
  assert.match(String(row.Kontakter), /Ledelsesrolle \(CVR\)/);
  assert.doesNotMatch(String(row.Kontakter), /\+4511223344/);
  assert.match(String(row["Udkast (oversigt)"]), /^E-mail:/);
  assert.match(String(row.Signaler), /managed service/);
  for (const col of exportColumns) assert.ok(col in row);
});

test("export filters mirror the dashboard list semantics", () => {
  const rows = [
    company({
      id: "a",
      cvr: "10000009",
      name: "Alpha MSP",
      scores: [
        {
          ...company({ id: "a", cvr: "10000009", name: "Alpha MSP" }).scores[0]!,
          priority: "A",
          relevance: "SUPPLY",
          segment: "MSP",
        },
      ],
      outreach: {
        status: "READY",
        notes: null,
        nextAction: null,
        nextFollowUpAt: null,
      },
    }),
    company({
      id: "b",
      cvr: "10000017",
      name: "Beta Retail",
      website: null,
      scores: [
        {
          ...company({ id: "b", cvr: "10000017", name: "Beta Retail" }).scores[0]!,
          priority: "C",
          relevance: "LOW",
          segment: "Retail",
          value: 20,
        },
      ],
      outreach: {
        status: "NEW",
        notes: null,
        nextAction: null,
        nextFollowUpAt: null,
      },
    }),
  ];
  assert.equal(filterExportCompanies(rows, { priority: "A" }).length, 1);
  assert.equal(filterExportCompanies(rows, { search: "retail" })[0]?.id, "b");
  assert.equal(filterExportCompanies(rows, { status: "READY" })[0]?.id, "a");
  assert.equal(filterExportCompanies(rows, { id: "b" })[0]?.name, "Beta Retail");
  assert.equal(sortExportCompanies(rows, "score")[0]?.id, "a");
});

test("workbook builds a polished .xlsx with Danish headers", async () => {
  const buffer = await buildSalesWorkbook([
    company({ id: "c1", cvr: "10000009", name: "Eksempel A/S" }),
  ]);
  assert.ok(buffer.byteLength > 1000);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Leads");
  assert.ok(sheet);
  const headers = (sheet.getRow(1).values as unknown[]).slice(1);
  assert.deepEqual(headers, [...exportColumns]);
  assert.equal(sheet.getRow(2).getCell(1).value, "Eksempel A/S");
  assert.equal(exportFilename({ id: "c1" }).startsWith("northstar-lead-"), true);
  assert.equal(exportFilename({}).startsWith("northstar-leads-"), true);
});
