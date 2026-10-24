"use client";
import { useState } from "react";
import { Search, Database, Clock3 } from "lucide-react";
import type { DiscoveryConfig } from "@/lib/intelligence/cvrbasen";
import { date } from "./intelligence-types";
export interface Discovery {
  configured: boolean;
  config: DiscoveryConfig;
  page: number;
  industryIndex: number;
  statusIndex: number;
  nextRunAt: string;
  leaseUntil: string | null;
  requestsToday: number;
  budgetDay: string;
  lastError: string | null;
  runs: Array<{
    id: string;
    startedAt: string;
    status: string;
    page: number;
    examined: number;
    added: number;
    updated: number;
    skipped: number;
    reasons: Record<string, number>;
    error: string | null;
  }>;
}
export function DiscoveryPanel({
  data,
  busy,
  perform,
}: {
  data: Discovery;
  busy: string;
  perform: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [config, setConfig] = useState(data.config);
  const [prefixes, setPrefixes] = useState(
    data.config.industryPrefixes.join(", "),
  );
  const used =
    data.budgetDay === new Date().toISOString().slice(0, 10)
      ? data.requestsToday
      : 0;
  return (
    <div className="discovery-layout">
      <section className="panel discovery-intro">
        <div>
          <p className="eyebrow">CVRBASEN → JERES LEADS</p>
          <h2>Et løbende tilskud af relevante virksomheder</h2>
          <p>
            Find aktive danske virksomheder ud fra branche og det senest oplyste
            medarbejdertal. Dubletter opdateres, og reklamebeskyttede
            virksomheder frasorteres.
          </p>
        </div>
        <span className="mode-pill">
          <Database size={15} />
          {data.configured ? "API-nøgle konfigureret" : "API-nøgle mangler"}
        </span>
        {!data.configured && (
          <p className="notice">
            Tilføj <code>CVRBASEN_API_KEY</code> i serverens <code>.env</code>,
            og genstart serveren. Nøglen opbevares kun på serveren. Et
            abonnement hos CVRbasen kan koste penge; vores regler bruger ingen
            AI-tokens.
          </p>
        )}
        <div className="discovery-stats">
          <div>
            <strong>
              {used} / {data.config.maxRequestsPerDay}
            </strong>
            <span>API-kald i dag · UTC</span>
          </div>
          <div>
            <strong>Side {data.page}</strong>
            <span>
              Branche {data.config.industryPrefixes[data.industryIndex]} ·{" "}
              {data.statusIndex === 1 ? "Aktiv" : "NORMAL"} · 100 virksomheder
              pr. kald
            </span>
          </div>
          <div>
            <strong>{data.config.enabled ? "Automatisk" : "Pauseret"}</strong>
            <span>
              <Clock3 size={12} />{" "}
              {data.config.enabled
                ? `Næste tidligst ${date(data.nextRunAt)}`
                : "Aktivér nedenfor"}
            </span>
          </div>
        </div>
        {data.lastError && (
          <p role="alert" className="notice">
            {data.lastError}
          </p>
        )}
        <button
          className="primary"
          disabled={!!busy || !data.configured}
          onClick={() => void perform({ action: "discover" })}
        >
          <Search size={16} />
          {busy === "discover" ? "Søger i CVRbasen…" : "Find virksomheder nu"}
        </button>
        <p className="muted">
          Nye CVR-virksomheder beriges automatisk med registerroller,
          verificeret hjemmeside, regnskab, offentlige arbejdskontakter og
          regelbaseret score. Manglende data markeres til manuel vurdering. Alle
          registerkald deler dagens loft.
        </p>
      </section>
      <section className="panel discovery-form">
        <h3>Søgning og automatisk kørsel</h3>
        <p>
          Branchekoderne er et bredt kandidatfilter. Den efterfølgende
          hjemmesideanalyse afgør lead-prioriteten med jeres lokale regler.
        </p>
        <label>
          Branchepræfikser (kommasepareret)
          <input
            value={prefixes}
            onChange={(e) => setPrefixes(e.target.value)}
          />
        </label>
        <small>
          Standard: 62 IT, 63 informationstjenester, 58 udgivelse/software, 26
          elektronik, 33 reparation/installation, 71 teknisk rådgivning. Tilpas
          til de branchekoder jeres API returnerer.
        </small>
        <div className="discovery-fields">
          {(
            [
              ["minEmployees", "Minimum ansatte"],
              ["maxEmployees", "Maksimum ansatte"],
              ["intervalMinutes", "Minutter mellem sider (min. 15)"],
              ["maxRequestsPerDay", "Maks. API-kald pr. dag (1–100)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                value={config[key]}
                onChange={(e) =>
                  setConfig({ ...config, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <label className="discovery-toggle">
          <input
            type="checkbox"
            checked={config.autoEnrich}
            onChange={(e) =>
              setConfig({ ...config, autoEnrich: e.target.checked })
            }
          />
          Berig automatisk eksisterende og nye CVR-virksomheder
        </label>
        <label className="discovery-toggle">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig({ ...config, enabled: e.target.checked })
            }
          />
          Find automatisk nye virksomheder, mens serveren kører
        </label>
        <p className="muted">
          Hver kørsel henter én side i én branche. Efter sidste side fortsætter
          søgningen med næste branche. Efter alle brancher starter en ny runde.
          API-fejl giver pause; ugyldig nøgle stopper automatikken. Gem
          ændringer starter søgningen forfra, men nulstiller ikke dagens
          forbrug.
        </p>
        <button
          className="primary"
          disabled={!!busy}
          onClick={() =>
            void perform({
              action: "discoverySettings",
              config: {
                ...config,
                industryPrefixes: [
                  ...new Set(prefixes.split(/[,\s]+/).filter(Boolean)),
                ],
              },
            })
          }
        >
          Gem søgning
        </button>
      </section>
      <section className="panel discovery-history">
        <h3>Seneste kørsler</h3>
        {!data.runs.length ? (
          <p>Ingen søgninger endnu. Tilslut API-nøglen for at komme i gang.</p>
        ) : (
          data.runs.map((r) => (
            <div key={r.id}>
              <strong>
                {date(r.startedAt)} · Side {r.page} ·{" "}
                {r.status === "SUCCEEDED"
                  ? "Gennemført"
                  : r.status === "RUNNING"
                    ? "Kører"
                    : "Fejlet"}
              </strong>
              <p>
                {r.examined} undersøgt · {r.added} nye · {r.updated} opdateret ·{" "}
                {r.skipped} frasorteret
              </p>
              {Object.entries(r.reasons).map(([reason, n]) => (
                <small key={reason}>
                  {reason}: {n}.{" "}
                </small>
              ))}
              {r.error && <p role="alert">{r.error}</p>}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
