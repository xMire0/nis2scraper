import { z } from "zod";
export const relevanceLabels: Record<string, string> = {
  DIRECT: "Mulig direkte NIS2-relevans",
  SUPPLY: "Sandsynlig leverandør med afledte kundekrav",
  REVIEW: "Kræver manuel vurdering",
  LOW: "Lav relevans",
};
export const stages: Record<string, string> = {
  NEW: "Ny",
  RESEARCHED: "Undersøgt",
  READY: "Klar til kontakt",
  CONTACTED: "Kontaktet",
  MEETING_SET: "Møde",
  SCOPE: "Gratis scope-afklaring",
  OFFER: "Tilbud",
  CLOSED_WON: "Vundet",
  CLOSED_LOST: "Tabt",
};
export const groupSchema = z.object({
  id: z.enum([
    "customers",
    "services",
    "procurement",
    "security",
    "jobs",
    "direct",
    "b2c",
  ]),
  label: z.string().min(1).max(80),
  weight: z.number().int().min(0).max(40),
  keywords: z.array(z.string().trim().min(2).max(80)).max(80),
});
export const configSchema = z
  .object({
    openaiMaxRequestsPerDay: z
      .number()
      .int()
      .min(0)
      .max(1000)
      .nullable()
      .default(null),
    groups: z
      .array(groupSchema)
      .length(7)
      .refine(
        (g) => new Set(g.map((x) => x.id)).size === 7,
        "Signalgrupper skal være unikke",
      ),
    segments: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          keywords: z.array(z.string().trim().min(2).max(80)).max(50),
        }),
      )
      .min(1)
      .max(12),
    minEmployees: z.number().int().min(1).max(250),
    maxEmployees: z.number().int().min(20).max(2000),
    sizeWeight: z.number().int().min(0).max(40),
    enterprisePenalty: z.number().int().min(0).max(60),
    smallPenalty: z.number().int().min(0).max(40),
    noSignalsPenalty: z.number().int().min(0).max(40),
    priorityA: z.number().int().min(1).max(100),
    priorityB: z.number().int().min(1).max(99),
    priorityC: z.number().int().min(1).max(98),
    maxPages: z.number().int().min(1).max(8),
    delayMs: z.number().int().min(3000).max(15000),
    retentionDays: z.number().int().min(7).max(365),
    senderName: z.string().max(100),
    senderCompany: z.string().max(100),
  })
  .refine(
    (c) =>
      c.minEmployees <= c.maxEmployees &&
      c.priorityA > c.priorityB &&
      c.priorityB > c.priorityC,
    "Kontrollér medarbejderinterval og A > B > C",
  );
export type Config = z.infer<typeof configSchema>;
export const defaultConfig: Config = {
  openaiMaxRequestsPerDay: null,
  groups: [
    {
      id: "customers",
      label: "Relevante kunder",
      weight: 30,
      keywords: [
        "kommune",
        "kommuner",
        "region",
        "hospital",
        "sygehus",
        "forsyning",
        "energi",
        "transport",
        "telekommunikation",
        "finans",
        "industri",
      ],
    },
    {
      id: "services",
      label: "Tekniske ydelser",
      weight: 25,
      keywords: [
        "cloud",
        "hosting",
        "backup",
        "datacenter",
        "it-drift",
        "managed service",
        "cybersikkerhed",
        "erp",
        "softwareudvikling",
        "saas",
        "iot",
        "ot-sikkerhed",
        "automation",
        "systemintegration",
        "microsoft partner",
      ],
    },
    {
      id: "procurement",
      label: "Offentlige aftaler",
      weight: 10,
      keywords: [
        "rammeaftale",
        "offentligt udbud",
        "offentlige udbud",
        "ski-aftale",
        "ski leverandør",
        "offentlige kunder",
      ],
    },
    {
      id: "security",
      label: "Sikkerhed & dokumentation",
      weight: 10,
      keywords: [
        "iso 27001",
        "isae 3000",
        "isae 3402",
        "soc 2",
        "nis2",
        "dora",
        "informationssikkerhed",
        "databehandleraftale",
        "beredskab",
        "gdpr",
      ],
    },
    {
      id: "jobs",
      label: "Rekruttering",
      weight: 5,
      keywords: [
        "security engineer",
        "informationssikkerhedskonsulent",
        "compliance officer",
        "ciso",
        "sikkerhedsspecialist",
      ],
    },
    {
      id: "direct",
      label: "Mulig direkte relevans",
      weight: 0,
      keywords: [
        "managed service provider",
        "managed security",
        "cloud computing",
        "hosting",
        "datacenter",
        "dns-tjenester",
      ],
    },
    {
      id: "b2c",
      label: "Ren B2C (fradrag)",
      weight: 35,
      keywords: [
        "kun til private",
        "udelukkende private kunder",
        "kun privatkunder",
      ],
    },
  ],
  segments: [
    {
      name: "IT-drift & MSP",
      keywords: ["it-drift", "managed service", "outsourcing", "it-support"],
    },
    {
      name: "Cloud & hosting",
      keywords: ["cloud", "hosting", "datacenter", "backup"],
    },
    {
      name: "Software & integration",
      keywords: ["software", "saas", "erp", "microsoft", "systemintegration"],
    },
    {
      name: "Automation, OT & IoT",
      keywords: ["automation", "ot-sikkerhed", "iot", "scada"],
    },
    {
      name: "Medico & sundheds-IT",
      keywords: ["medico", "sundheds-it", "patient", "sundhedssoftware"],
    },
  ],
  minEmployees: 20,
  maxEmployees: 250,
  sizeWeight: 20,
  enterprisePenalty: 25,
  smallPenalty: 15,
  noSignalsPenalty: 20,
  priorityA: 75,
  priorityB: 55,
  priorityC: 30,
  maxPages: 6,
  delayMs: 3000,
  retentionDays: 90,
  senderName: "[Dit navn]",
  senderCompany: "[Dit firma]",
};
export const levelLabels: Record<string, string> = {
  HIGH: "Høj",
  MEDIUM: "Middel",
  LOW: "Lav",
  UNKNOWN: "Ukendt",
};
