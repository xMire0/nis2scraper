"use client";
import {
  enrichmentSteps,
  pendingSteps,
  queueStatus,
  crawlExplanation,
} from "@/lib/intelligence/queue";
import type { Workspace, Company } from "./intelligence-types";

export function EnrichmentQueue({
  data,
  onSelect,
}: {
  data: Workspace;
  onSelect: (id: string) => void;
}) {
  const jobs = data.companies
    .filter(
      (c) =>
        c.autoEnrichmentQueuedAt ||
        c.autoEnrichmentStartedAt ||
        c.importSource === "CVRbasen API",
    )
    .sort(
      (a, b) =>
        Date.parse(a.autoEnrichmentNextAt) -
          Date.parse(b.autoEnrichmentNextAt) ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const pending = jobs.filter((c) =>
    pendingSteps.includes(c.autoEnrichmentStep),
  );
  const finished = jobs.filter(
    (c) => !pendingSteps.includes(c.autoEnrichmentStep),
  );
  const used =
    data.discovery.budgetDay === new Date().toISOString().slice(0, 10)
      ? data.discovery.requestsToday
      : 0;
  const reason = (c: Company) =>
    c.autoEnrichmentError ||
    c.autoEnrichmentNote ||
    (["PROFILE", "FINANCIAL", "FINANCIAL_REVIEW"].includes(
      c.autoEnrichmentStep,
    ) && used >= data.discovery.config.maxRequestsPerDay
      ? "CVR-dagsloftet er nået. Afventer nyt UTC-døgn eller et højere loft under Find virksomheder."
      : "");
  function table(rows: Company[]) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Virksomhed</th>
              <th>Status</th>
              <th>Næste trin</th>
              <th>Årsag / resultat</th>
              <th>Tidligste forsøg</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <button
                    className="text-button"
                    onClick={() => onSelect(c.id)}
                  >
                    {c.name}
                  </button>
                  <small> · CVR {c.cvr}</small>
                </td>
                <td>{queueStatus(c, data.discovery.config.autoEnrich)}</td>
                <td>
                  {enrichmentSteps[c.autoEnrichmentStep] ??
                    c.autoEnrichmentStep}
                </td>
                <td>
                  {reason(c)
                    ? crawlExplanation(reason(c))
                    : c.autoEnrichmentStep === "DONE"
                      ? "Forløbet er afsluttet"
                      : "—"}
                </td>
                <td>
                  {pendingSteps.includes(c.autoEnrichmentStep)
                    ? Date.parse(c.autoEnrichmentNextAt) <= Date.now()
                      ? "Nu · når et trin bliver ledigt"
                      : new Date(c.autoEnrichmentNextAt).toLocaleString("da-DK")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <section className="panel settings-panel">
      <h2>Berigelseskø · {pending.length} afventer eller kører</h2>
      <p>
        Hjemmeside → kontakter og ICP → salgsmateriale → regnskab. Ét trin ad
        gangen; status opdateres automatisk. Klik på en virksomhed for detaljer.
      </p>
      <p className="notice">
        CVR: {used}/{data.discovery.config.maxRequestsPerDay} opslag · OpenAI:{" "}
        {data.websiteSearch.requestsToday}/
        {data.websiteSearch.maxRequestsPerDay} søgeforsøg i dag (UTC).
      </p>
      {!data.discovery.config.autoEnrich && (
        <p className="notice">
          Automatisk berigelse er pauset. Forløb bestilt med knappen på en kunde
          behandles stadig.
        </p>
      )}
      {!data.discovery.configured && (
        <p className="notice">
          CVR-nøglen mangler; registertrin kan ikke gennemføres.
        </p>
      )}
      {data.websiteSearch.error && (
        <p className="notice">OpenAI: {data.websiteSearch.error}</p>
      )}
      {data.discovery.lastError && (
        <p className="notice">CVR: {data.discovery.lastError}</p>
      )}
      {pending.length ? table(pending) : <p>Ingen virksomheder venter i kø.</p>}
      <details className="score-breakdown">
        <summary>Afsluttede og uafklarede · {finished.length}</summary>
        {table(finished)}
      </details>
    </section>
  );
}
