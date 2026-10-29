"use client";
import { useEffect, useState } from "react";
import { crawlExplanation } from "@/lib/intelligence/queue";
import { Enrichment } from "./intelligence-enrichment";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ArrowUpRight,
  ScanSearch,
  Copy,
  Check,
  Clock3,
  Trash2,
  ShieldCheck,
  FileText,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import {
  relevanceLabels,
  stages,
  levelLabels,
} from "@/lib/intelligence/config";
import { salesFacingContacts } from "@/lib/intelligence/contacts";
import {
  type Company,
  type Perform,
  type Workspace,
  date,
  employees,
  money,
} from "./intelligence-types";
export function Detail({
  company: c,
  onClose,
  perform,
  busy,
  version,
  websiteSearch,
  automatic,
  onQueue,
}: {
  company: Company;
  onClose: () => void;
  perform: Perform;
  busy: string;
  version: number;
  websiteSearch?: Workspace["websiteSearch"];
  automatic: boolean;
  onQueue: () => void;
}) {
  const s = c.scores[0];
  const contacts = salesFacingContacts(c.publicContacts);
  const [tab, setTab] = useState("analyse"),
    [status, setStatus] = useState(c.outreach?.status ?? "NEW"),
    [notes, setNotes] = useState(c.outreach?.notes ?? ""),
    [next, setNext] = useState(c.outreach?.nextAction ?? ""),
    [when, setWhen] = useState(c.outreach?.nextFollowUpAt?.slice(0, 10) ?? ""),
    [website, setWebsite] = useState(c.website ?? "");
  useEffect(() => setWebsite(c.website ?? ""), [c.website]);
  const [nextEdited, setNextEdited] = useState(false);
  useEffect(() => {
    if (!nextEdited) setNext(c.outreach?.nextAction ?? "");
  }, [c.outreach?.nextAction, nextEdited]);
  const [copied, setCopied] = useState(false),
    [remove, setRemove] = useState(false),
    [exporting, setExporting] = useState(false);
  const top =
    s?.evidenceIds
      .map((id) => c.evidence.find((e) => e.id === id))
      .filter(Boolean) ?? [];
  async function exportLead() {
    setExporting(true);
    try {
      const res = await fetch(
        `/api/intelligence/export?id=${encodeURIComponent(c.id)}`,
      );
      if (res.status === 401) {
        location.href = "/login";
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Eksporten fejlede");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `northstar-lead.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Eksporten fejlede");
    } finally {
      setExporting(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="lead-drawer">
          <div className="drawer-heading">
            <div>
              <p className="eyebrow">VIRKSOMHEDSPROFIL</p>
              <Dialog.Title>{c.name}</Dialog.Title>
              <Dialog.Description>
                CVR {c.cvr} <span className="dot">·</span>{" "}
                {c.addressCity ?? "By ikke oplyst"}
              </Dialog.Description>
            </div>
            <div className="drawer-heading-actions">
              <button
                className="secondary small"
                disabled={exporting || Boolean(busy)}
                onClick={() => void exportLead()}
              >
                {exporting ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                Eksportér til Excel
              </button>
              <Dialog.Close
                className="icon-button"
                aria-label="Luk virksomhedsprofil"
              >
                <X size={20} />
              </Dialog.Close>
            </div>
          </div>
          <div className="drawer-body">
            <div className="company-facts">
              <div>
                <span>Ansatte</span>
                <strong>{employees(c)}</strong>
              </div>
              <div>
                <span>Omsætning</span>
                <strong>{money(c.importedRevenue)}</strong>
              </div>
              <div>
                <span>Kilde</span>
                <strong>{c.importSource ?? "Registerdata"}</strong>
              </div>
            </div>
            {c.website && (
              <a
                className="website-link"
                href={c.website}
                target="_blank"
                rel="noreferrer"
              >
                {new URL(c.website).hostname}
                <ArrowUpRight size={14} />
              </a>
            )}
            <Enrichment
              company={c}
              perform={perform}
              busy={busy}
              websiteSearch={websiteSearch}
              automatic={automatic}
              onQueue={onQueue}
            />
            <nav className="detail-tabs" aria-label="Virksomhedsvisning">
              {[
                ["analyse", "ICP & beviser"],
                ["workflow", "Salgsarbejde"],
                ["outreach", "Salgsmateriale"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id!)}
                  className={tab === id ? "active" : ""}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === "analyse" && (
              <>
                {s &&
                  c.autoEnrichmentQueuedAt &&
                  Date.parse(s.createdAt) <
                    Date.parse(c.autoEnrichmentQueuedAt) && (
                    <p className="notice">
                      Nedenfor ses en tidligere vurdering. Det nye forløb har
                      endnu ikke leveret en ny ICP-vurdering.
                    </p>
                  )}
                {s ? (
                  <>
                    <section className="detail-section">
                      <h3>
                        ICP-match:{" "}
                        {s.icp
                          ? (
                              {
                                STRONG: "Stærkt",
                                POSSIBLE: "Muligt",
                                LOW: "Lavt",
                                UNKNOWN: "Uafklaret",
                              } as Record<string, string>
                            )[s.icp.fit]
                          : "Kræver ny vurdering"}
                      </h3>
                      {s.icp && (
                        <>
                          <p>
                            {s.icp.size} · {s.icp.segment}
                          </p>
                          <p>{s.icp.customers}</p>
                          <p>{s.icp.summary}</p>
                        </>
                      )}
                      <p className="tiny muted">
                        Match mod jeres målgruppe og offentlige signaler. Ingen
                        juridisk NIS2-afgørelse.
                      </p>
                    </section>
                    <div className="score-summary">
                      <div
                        className={`big-score score-${s.priority.toLowerCase()}`}
                      >
                        {s.value}
                        <span>/100</span>
                      </div>
                      <div>
                        <span
                          className={`priority priority-${s.priority.toLowerCase()}`}
                        >
                          Prioritet {s.priority}
                        </span>
                        <h3>{s.segment}</h3>
                        <p>
                          {date(s.createdAt)} ·{" "}
                          {c.leadRuns.find((r) => r.id === s.runId)?.mode ===
                          "AI"
                            ? "Historisk analyse – genberegn med regler"
                            : "Regelbaseret"}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`relevance relevance-${s.relevance.toLowerCase()}`}
                    >
                      {relevanceLabels[s.relevance]}
                    </p>
                    <div className="likelihoods">
                      <div>
                        <span>Direkte relevans</span>
                        <strong>{levelLabels[s.directLevel]}</strong>
                      </div>
                      <div>
                        <span>Afledte kundekrav</span>
                        <strong>{levelLabels[s.supplyLevel]}</strong>
                      </div>
                      <div>
                        <span>Datadækning</span>
                        <strong>
                          {s.coverage === "COMPLETE"
                            ? "Brugbart udsnit"
                            : "Ufuldstændig"}
                        </strong>
                      </div>
                    </div>
                    <p className="tiny muted">
                      Signalniveauer er ikke juridiske konklusioner eller
                      statistiske sandsynligheder.
                    </p>
                    {s.configVersion !== version && (
                      <div className="notice">
                        Scoringsreglerne er ændret. Kør en ny analyse for at
                        bruge version {version}.
                      </div>
                    )}
                    <section className="detail-section">
                      <h3>Hvorfor er virksomheden interessant?</h3>
                      <p>{s.explanation}</p>
                    </section>
                    <section className="detail-section">
                      <div className="section-line">
                        <h3>De stærkeste signaler</h3>
                        <span className="count-tag">{top.length} fund</span>
                      </div>
                      {top.length ? (
                        top.map(
                          (e, i) =>
                            e && (
                              <article className="evidence-card" key={e.id}>
                                <span className="evidence-number">
                                  0{i + 1}
                                </span>
                                <div>
                                  <span className="signal-label">
                                    {e.keyword}
                                  </span>
                                  <blockquote>“{e.excerpt}”</blockquote>
                                  <a
                                    href={e.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Se kilde <ArrowUpRight size={12} />
                                  </a>
                                  <span className="tiny muted">
                                    {" "}
                                    · {date(e.fetchedAt)}
                                  </span>
                                </div>
                              </article>
                            ),
                        )
                      ) : (
                        <p className="muted">
                          Ingen underbyggede signaler. Undersøg virksomheden
                          manuelt.
                        </p>
                      )}
                    </section>
                    <details className="score-breakdown">
                      <summary>
                        Sådan er scoren beregnet <ChevronDown size={16} />
                      </summary>
                      {s.breakdown.map((b, i) => (
                        <div key={i}>
                          <span>{b.label}</span>
                          <strong>
                            {b.points > 0 ? "+" : ""}
                            {b.points}
                          </strong>
                        </div>
                      ))}
                      <p className="tiny muted">
                        Regelversion {s.configVersion}. Gentagne fund i samme
                        gruppe giver ikke flere point.
                      </p>
                    </details>
                    <section className="detail-section angle">
                      <ShieldCheck size={18} />
                      <div>
                        <h3>Anbefalet vinkel</h3>
                        <p>{s.angle}</p>
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="analysis-empty">
                    <ScanSearch size={32} />
                    <h3>Fra hjemmeside til indsigt</h3>
                    <p>
                      Analysér offentlige sider for at finde relevante ydelser,
                      kunder og dokumentationssignaler.
                    </p>
                  </div>
                )}
                {!!c.leadRuns.length && (
                  <section className="detail-section">
                    <h3>Seneste kørsler</h3>
                    {c.leadRuns.map((r) => (
                      <details key={r.id} className="run-card">
                        <summary>
                          <Clock3 size={14} />
                          {date(r.startedAt)}
                          <span
                            className={`run-status ${r.status.toLowerCase()}`}
                          >
                            {(
                              {
                                SUCCEEDED: "Gennemført",
                                PARTIAL: "Delvis",
                                FAILED: "Kan ikke fuldføres",
                                RUNNING: "Kører",
                              } as Record<string, string>
                            )[r.status] ?? r.status}
                          </span>
                        </summary>
                        {r.error && (
                          <p className="error">{crawlExplanation(r.error)}</p>
                        )}
                        {r.pages.map((p, i) => (
                          <div className="run-page" key={i}>
                            <a href={p.url} target="_blank" rel="noreferrer">
                              {p.url}
                            </a>
                            <small>
                              {p.error
                                ? crawlExplanation(p.error)
                                : `${p.characters ?? 0} tegn · ${p.status}`}
                            </small>
                          </div>
                        ))}
                      </details>
                    ))}
                  </section>
                )}
              </>
            )}
            {tab === "workflow" && (
              <>
                <section className="detail-section">
                  <h3>Næste skridt i relationen</h3>
                  {c.outreach?.nextAction && (
                    <p className="tiny muted">
                      Senest gemt næste handling: {c.outreach.nextAction}
                    </p>
                  )}
                  <div className="form-grid">
                    <label>
                      Salgsstatus
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        {Object.entries(stages).map(([id, label]) => (
                          <option value={id} key={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Opfølgningsdato
                      <input
                        type="date"
                        value={when}
                        onChange={(e) => setWhen(e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    Næste handling
                    <input
                      value={next}
                      onChange={(e) => {
                        setNextEdited(true);
                        setNext(e.target.value);
                      }}
                      placeholder="Fx gennemgå referencer og afklar kontaktperson"
                      maxLength={500}
                    />
                  </label>
                  <label>
                    Hjemmeside
                    <input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://virksomhed.dk"
                    />
                  </label>
                  <label>
                    Noter
                    <textarea
                      rows={5}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Kundebehov, relevante aftaler og kontekst…"
                      maxLength={5000}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      perform({
                        action: "update",
                        id: c.id,
                        status,
                        notes,
                        nextAction: next,
                        nextFollowUpAt: when
                          ? new Date(when + "T12:00:00").toISOString()
                          : null,
                        website,
                      })
                    }
                  >
                    <Check size={16} />
                    Gem ændringer
                  </button>
                </section>
                <section className="detail-section">
                  <h3>Offentlige arbejdskontakter</h3>
                  <p className="tiny muted">
                    Telefonnumre kommer fra virksomhedens hjemmeside (ikke CVR).
                    Ledelsesroller fra registret bevares. En offentlig adresse er
                    ikke et markedsføringssamtykke.
                  </p>
                  {contacts.length ? (
                    contacts.map((x) => (
                      <div className="contact-row" key={x.id}>
                        <div>
                          <strong>{x.value}</strong>
                          <p className="tiny muted">
                            {x.kind === "ROLE"
                              ? "Ledelsesrolle fra CVR; ingen direkte kontakt verificeret"
                              : x.kind === "PHONE"
                                ? x.name
                                  ? `${x.name} · ${x.title} · telefon fra hjemmeside`
                                  : "Telefon fra hjemmeside"
                                : x.name
                                  ? `${x.name} · ${x.title}`
                                  : "Fælles kontakt; ikke knyttet til en person"}
                          </p>
                          <a
                            href={x.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Kilde · {date(x.fetchedAt)}
                          </a>
                        </div>
                        <button
                          className="icon-button"
                          title="Slet og blokér genindsamling"
                          aria-label={`Slet kontakt ${x.value}`}
                          disabled={Boolean(busy)}
                          onClick={() =>
                            perform({ action: "suppress", id: x.id })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="muted">
                      Ingen offentlige arbejdskontakter fundet.
                    </p>
                  )}
                </section>
                <section className="detail-section">
                  <h3>Statushistorik</h3>
                  {c.outreach?.history.length ? (
                    c.outreach.history.map((h) => (
                      <div className="history-row" key={h.id}>
                        <span>{stages[h.toStatus] ?? h.toStatus}</span>
                        <small>{date(h.createdAt)}</small>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Ingen statusændringer endnu.</p>
                  )}
                </section>
                <section className="danger-zone">
                  {remove ? (
                    <>
                      <p>
                        Slet virksomheden, analyser og udkast? Tilknyttede rå
                        importfiler slettes også; øvrige virksomheder bevares.
                      </p>
                      <button
                        className="danger"
                        disabled={Boolean(busy)}
                        onClick={async () => {
                          if (await perform({ action: "delete", id: c.id }))
                            onClose();
                        }}
                      >
                        Slet virksomheden permanent
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setRemove(false)}
                      >
                        Annuller
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => setRemove(true)}
                    >
                      Slet virksomhed og tilknyttede data
                    </button>
                  )}
                </section>
              </>
            )}
            {tab === "outreach" && (
              <>
                <section className="detail-section">
                  <FileText size={25} />
                  <h3>En relevant samtale starter her</h3>
                  <p>
                    Lav et dansk udkast med udgangspunkt i virksomhedens
                    dokumenterede signaler. Gennemgå altid indhold og
                    kontaktgrundlag før brug.
                  </p>
                  <p>
                    Salgsmaterialet oprettes automatisk efter den nye
                    ICP-vurdering: e-mail, telefonmanuskript, LinkedIn-besked og
                    webinar-invitation.
                  </p>
                  {!c.drafts.length && (
                    <p className="muted">
                      Ingen udkast endnu. Start det samlede forløb med knappen
                      øverst.
                    </p>
                  )}
                  <div className="notice">
                    Udkast sendes ikke automatisk. Elektronisk markedsføring
                    kræver som udgangspunkt forudgående samtykke, også til
                    virksomheder.
                  </div>
                </section>
                {c.drafts.map((draft, i) => (
                  <article className="draft-card" key={draft.id}>
                    {c.autoEnrichmentQueuedAt &&
                      Date.parse(draft.createdAt) <
                        Date.parse(c.autoEnrichmentQueuedAt) && (
                        <p className="notice">
                          Tidligere udkast — ikke opdateret af det nye forløb.
                        </p>
                      )}
                    <div className="section-line">
                      <span className="eyebrow">
                        {draft.channel} · {date(draft.createdAt)}
                      </span>
                      <button
                        className="secondary small"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(draft.body);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          } catch {
                            setCopied(false);
                          }
                        }}
                      >
                        {copied && i === 0 ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                        Kopiér
                      </button>
                    </div>
                    <pre>{draft.body}</pre>
                  </article>
                ))}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
