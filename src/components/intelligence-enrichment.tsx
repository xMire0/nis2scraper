"use client";
import { useState } from "react";
import {
  pendingSteps,
  enrichmentSteps,
  queueStatus,
  crawlExplanation,
} from "@/lib/intelligence/queue";
import {
  type Company,
  type Perform,
  type Workspace,
  date,
} from "./intelligence-types";

export function Enrichment({
  company: c,
  perform,
  busy,
  websiteSearch,
  automatic,
  onQueue,
}: {
  company: Company;
  perform: Perform;
  busy: string;
  websiteSearch?: Workspace["websiteSearch"];
  automatic: boolean;
  onQueue: () => void;
}) {
  const [message, setMessage] = useState("");
  async function run(action: string) {
    setMessage("");
    const result = await perform({
      action,
      id: c.id,
    });
    if (result)
      setMessage(
        result.message ??
          (result.eligible === false
            ? "CVR opdateret; virksomheden kan ikke bruges til leadberigelse"
            : "CVR og aktuelle ledelsesroller opdateret"),
      );
  }
  const f = c.financials[0];
  const latestBlocked =
    c.leadRuns[0]?.error &&
    /HTTP 403|HTTP 401|CAPTCHA/.test(c.leadRuns[0].error)
      ? c.leadRuns[0].error
      : null;
  const amount = (value: string | null) =>
    value === null
      ? "Ikke oplyst"
      : `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(Number(value))} ${f?.currency ?? "ukendt valuta"}`;
  return (
    <section className="detail-section">
      <h3>Gør kunden klar til salg</h3>
      <p>
        Find hjemmeside → berig data → vurder ICP → tilpas salgsmateriale.
        Regnskabet hentes også. Intet sendes automatisk.
      </p>
      <button
        className="primary full"
        disabled={
          !!busy ||
          (!!c.autoEnrichmentStartedAt &&
            Date.now() - Date.parse(c.autoEnrichmentStartedAt) < 15 * 60000) ||
          (!!c.autoEnrichmentQueuedAt &&
            pendingSteps.includes(c.autoEnrichmentStep))
        }
        onClick={() => run("repopulate")}
      >
        {busy === "repopulate"
          ? "Sætter i kø…"
          : c.autoEnrichmentQueuedAt &&
              pendingSteps.includes(c.autoEnrichmentStep)
            ? "Forløbet er i kø"
            : "Find hjemmeside og klargør kunden"}
      </button>
      <p role="status">
        {queueStatus(c, automatic)} · {enrichmentSteps[c.autoEnrichmentStep]}
      </p>
      <button className="text-button" onClick={onQueue}>
        Se hele køen og fremdrift
      </button>
      {(c.autoEnrichmentNote || c.autoEnrichmentError || latestBlocked) && (
        <p className="notice">
          {crawlExplanation(
            c.autoEnrichmentError ||
              c.autoEnrichmentNote ||
              latestBlocked ||
              "",
          )}
        </p>
      )}
      {c.autoEnrichmentError && (
        <p className="tiny muted">
          Nyt forsøg tidligst{" "}
          {new Date(c.autoEnrichmentNextAt).toLocaleString("da-DK")}.
        </p>
      )}
      {websiteSearch && !websiteSearch.configured && (
        <p className="notice">
          OpenAI-nøglen mangler på serveren; hjemmesidesøgning kan ikke
          gennemføres.
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {f && (
        <details className="score-breakdown">
          <summary>
            Regnskab til {date(f.periodEnd)} · {f.currency ?? "Ukendt valuta"}
          </summary>
          {(
            [
              ["Omsætning", f.revenue],
              ["Bruttofortjeneste", f.grossProfit],
              ["Årets resultat", f.profitLoss],
              ["Egenkapital", f.equity],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{amount(value)}</strong>
            </div>
          ))}
          <p className="tiny muted">
            Offentliggjort {date(f.publishedAt)}. Manglende omsætning erstattes
            ikke med bruttofortjeneste.
          </p>
          <a
            href={`https://api.cvrbasen.dk/v1/companies/${c.cvr}/statements`}
            target="_blank"
            rel="noreferrer"
          >
            Kilde: CVRbasen (API-adgang kræves)
          </a>
          {f.reportUrl && (
            <>
              {" "}
              ·{" "}
              <a href={f.reportUrl} target="_blank" rel="noreferrer">
                Åbn årsrapport
              </a>
            </>
          )}
        </details>
      )}
      {c.websiteDiscovery?.searchError && (
        <p className="notice">{c.websiteDiscovery.searchError}</p>
      )}
      {c.websiteDiscovery?.search && (
        <details className="score-breakdown">
          <summary>AI-fundne kandidater · kræver CVR-kontrol</summary>
          <p className="tiny muted">
            {c.websiteDiscovery.search.model} ·{" "}
            {c.websiteDiscovery.search.cached
              ? "Genbrugt resultat"
              : "Ny søgning"}{" "}
            · oprindeligt forbrug: {c.websiteDiscovery.search.inputTokens} input
            / {c.websiteDiscovery.search.outputTokens} output tokens
          </p>
          {!c.websiteDiscovery.search.candidates.length && (
            <p>Ingen kandidater med søgekilder fundet.</p>
          )}
          {c.websiteDiscovery.search.candidates.map((candidate) => (
            <p key={candidate.url}>
              <a href={candidate.url} target="_blank" rel="noreferrer">
                {candidate.url}
              </a>
              {" · "}
              {candidate.reason}
              {" · "}
              <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                Søgekilde
              </a>
            </p>
          ))}
        </details>
      )}
      {!!c.websiteDiscovery?.attempts.length && (
        <details className="score-breakdown">
          <summary>Log for hjemmesidesøgning</summary>
          {c.websiteDiscovery.attempts.map((a, i) => (
            <p key={i}>
              <a href={a.evidenceUrl ?? a.url} target="_blank" rel="noreferrer">
                {a.url}
              </a>{" "}
              · {crawlExplanation(a.status)} · {date(a.checkedAt)}
              {a.excerpt && <small> · {a.excerpt}</small>}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
