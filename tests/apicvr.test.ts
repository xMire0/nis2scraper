import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapApicvrCompany,
  apicvrRequest,
  fetchApicvrCompany,
} from "../src/lib/intelligence/apicvr";
import {
  profileSchema,
  currentDirectors,
} from "../src/lib/intelligence/enrichment";
import {
  registryCompanySchema,
  exclusionReason,
  defaultDiscoveryConfig,
  RegistryError,
  latestEmployees,
} from "../src/lib/intelligence/cvrbasen";
import {
  getRegistryProvider,
  resolveRegistryProviderId,
  registrySearchReady,
  registryLookupReady,
} from "../src/lib/intelligence/registry-provider";

const sample = {
  vat: 24256790,
  name: "NOVO NORDISK A/S",
  address: "Novo Allé 1",
  zipcode: 2880,
  city: "Bagsværd",
  protected: false,
  phone: null,
  email: "info@novonordisk.com",
  startdate: "1931-11-28",
  enddate: null,
  employees: 27151,
  industrycode: 212000,
  industrydesc: "Fremstilling af farmaceutiske præparater",
  status: "NORMAL",
  direktion: [
    {
      name: "Lars Fruergaard Jørgensen",
      role: "ADM. DIR.",
      type: "PERSON",
      startdate: "2017-01-01",
    },
    {
      name: "Holding ApS",
      role: "DIREKTØR",
      type: "VIRKSOMHED",
      cvr: 12345678,
    },
  ],
};

test("mapApicvrCompany normalizes flat ApiCVR fields into registry profile", () => {
  const mapped = mapApicvrCompany(sample);
  const company = registryCompanySchema.parse(mapped);
  assert.equal(company.vat, "24256790");
  assert.equal(company.country_code, "DK");
  assert.equal(company.industry_code, "212000");
  assert.equal(latestEmployees(company)?.headcount, 27151);
  assert.equal(company.protected, false);
  const profile = profileSchema.parse(mapped);
  assert.equal(profile.email, "info@novonordisk.com");
  const directors = currentDirectors(profile.executive_management ?? []);
  assert.equal(directors.length, 1);
  assert.equal(directors[0]?.name, "Lars Fruergaard Jørgensen");
  assert.equal(
    exclusionReason(company, {
      ...defaultDiscoveryConfig,
      industryPrefixes: ["21"],
      minEmployees: 20,
      maxEmployees: 100000,
    }),
    null,
  );
});

test("mapApicvrCompany treats missing employees and protected companies correctly", () => {
  const protectedCo = mapApicvrCompany({
    ...sample,
    protected: true,
    employees: null,
  });
  assert.equal(protectedCo.employees.length, 0);
  assert.match(
    exclusionReason(
      registryCompanySchema.parse(protectedCo),
      defaultDiscoveryConfig,
    )!,
    /beskyttelse/i,
  );
});

test("apicvr provider rejects industry search and statements; allows lookup when selected", () => {
  const old = process.env.CVR_REGISTRY_PROVIDER;
  const oldKey = process.env.CVRBASEN_API_KEY;
  try {
    process.env.CVR_REGISTRY_PROVIDER = "apicvr";
    delete process.env.CVRBASEN_API_KEY;
    assert.equal(resolveRegistryProviderId(), "apicvr");
    const p = getRegistryProvider();
    assert.equal(p.supportsSearch, false);
    assert.equal(p.supportsStatements, false);
    assert.equal(registrySearchReady(p), false);
    assert.equal(registryLookupReady(p), true);
    assert.match(p.configuredLabel, /ApiCVR|API-nøgle/);
  } finally {
    if (old === undefined) delete process.env.CVR_REGISTRY_PROVIDER;
    else process.env.CVR_REGISTRY_PROVIDER = old;
    if (oldKey === undefined) delete process.env.CVRBASEN_API_KEY;
    else process.env.CVRBASEN_API_KEY = oldKey;
  }
});

test("default provider remains cvrbasen and still requires its key for search", () => {
  const old = process.env.CVR_REGISTRY_PROVIDER;
  const oldKey = process.env.CVRBASEN_API_KEY;
  try {
    delete process.env.CVR_REGISTRY_PROVIDER;
    delete process.env.CVRBASEN_API_KEY;
    const p = getRegistryProvider();
    assert.equal(p.id, "cvrbasen");
    assert.equal(registrySearchReady(p), false);
    assert.equal(registryLookupReady(p), false);
    process.env.CVRBASEN_API_KEY = "test-placeholder";
    assert.equal(registrySearchReady(getRegistryProvider()), true);
  } finally {
    if (old === undefined) delete process.env.CVR_REGISTRY_PROVIDER;
    else process.env.CVR_REGISTRY_PROVIDER = old;
    if (oldKey === undefined) delete process.env.CVRBASEN_API_KEY;
    else process.env.CVRBASEN_API_KEY = oldKey;
  }
});

test("apicvrRequest only allows documented company paths and surfaces HTTP errors", async () => {
  await assert.rejects(() => apicvrRequest("/api/v1/search"), /Ugyldig/);
  await assert.rejects(
    () =>
      fetchApicvrCompany("24256790", async () => new Response(null, { status: 502 })),
    (e: unknown) => e instanceof RegistryError && !e.stop,
  );
  const mapped = await fetchApicvrCompany("24256790", async (url, init) => {
    assert.equal(String(url), "https://apicvr.dk/api/v1/24256790");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "GET");
    return Response.json(sample);
  });
  assert.equal(mapped.vat, "24256790");
});
