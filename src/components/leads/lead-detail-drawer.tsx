"use client";

import * as React from "react";
import {
  Building2,
  CheckCircle2,
  Linkedin,
  Loader2,
  Phone,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";
import { Nis2StatusBadge } from "./status-badge";
import { TeaserPanel } from "./teaser-panel";
import { cn, cvrFormat, formatDate, formatDkk } from "@/lib/utils";
import { OUTREACH_LABELS, type Nis2Status, type OutreachStatus } from "@/lib/types";

interface LeadDetail {
  company: Record<string, any>;
  assessment: Record<string, any> | null;
  financials: Array<Record<string, any>>;
  contacts: Array<Record<string, any>>;
  outreach: { status: OutreachStatus; assignedTo: string | null; notes: string | null } | null;
  teaser: { subject: string; body: string };
  meta: { ceilings: string };
}

type EmailBadge = { variant: "success" | "important" | "muted" | "essential"; label: string };

const UNVERIFIED_BADGE: EmailBadge = { variant: "muted", label: "Uverificeret" };

const EMAIL_BADGE: Record<string, EmailBadge> = {
  VERIFIED: { variant: "success", label: "Verificeret" },
  ACCEPT_ALL: { variant: "important", label: "Catch-all" },
  UNVERIFIED: UNVERIFIED_BADGE,
  INVALID: { variant: "essential", label: "Ugyldig" },
};

export function LeadDetailDrawer({
  cvr,
  onClose,
  onStatusChange,
}: {
  cvr: string | null;
  onClose: () => void;
  onStatusChange?: () => void;
}) {
  const [data, setData] = React.useState<LeadDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!cvr) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/leads/${cvr}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json() as Promise<LeadDetail>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setNotes(json.outreach?.notes ?? "");
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [cvr]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patchStatus = async (status: OutreachStatus) => {
    if (!cvr) return;
    setSaving(true);
    try {
      await fetch(`/api/leads/${cvr}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      setData((d) => (d ? { ...d, outreach: { ...(d.outreach ?? { assignedTo: null }), status, notes } as never } : d));
      onStatusChange?.();
    } finally {
      setSaving(false);
    }
  };

  if (!cvr) return null;

  const a = data?.assessment;
  const rules: Array<{ rule: string; passed: boolean; detail: string }> = a?.deterministicRules ?? [];
  const primaryEmail = data?.contacts.find((c) => c.directEmail)?.directEmail ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={onClose} />

      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              <h2 className="truncate text-lg font-semibold text-slate-900">
                {data?.company.name ?? "Indlæser…"}
              </h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="tabular-nums">CVR {cvrFormat(cvr)}</span>
              {data?.company.db07Code && (
                <span>
                  · DB07 {data.company.db07Code} {data.company.db07Description}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Luk">
            <X className="h-4 w-4" />
          </Button>
        </header>

        {loading && (
          <div className="flex flex-1 items-center justify-center text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {error && (
          <div className="m-6 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        {data && !loading && (
          <div className="space-y-8 px-6 py-6">
            {/* ---------- Overview ---------- */}
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Ansatte", value: data.company.employeeCount ?? "—" },
                {
                  label: "Omsætning",
                  value: formatDkk(data.financials[0]?.revenue ?? null, { compact: true }),
                },
                {
                  label: "Balancesum",
                  value: formatDkk(data.financials[0]?.balanceSheet ?? null, { compact: true }),
                },
                { label: "Regnskabsår", value: data.financials[0]?.year ?? "—" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">{m.label}</div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{m.value}</div>
                </div>
              ))}
            </section>

            {/* ---------- Scoping ---------- */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">NIS2-vurdering</h3>
                {a && <Nis2StatusBadge status={a.effectiveStatus as Nis2Status} annex={a.annexType} />}
              </div>

              {a ? (
                <>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div className="rounded-md bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Sektor</div>
                      <div className="text-slate-800">
                        {a.sectorLabel} {a.subSector ? `· ${a.subSector}` : ""}
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Størrelsesklasse</div>
                      <div className="text-slate-800">
                        {a.sizeClass}
                        {a.sizeExempt ? " · omfattet uanset størrelse" : ""}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200">
                    <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Deterministisk størrelsestest
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {rules.map((r) => (
                        <li key={r.rule} className="flex items-start gap-2 px-3 py-2 text-sm">
                          <CheckCircle2
                            className={cn("mt-0.5 h-4 w-4 shrink-0", r.passed ? "text-emerald-500" : "text-slate-300")}
                          />
                          <div>
                            <div className="font-medium text-slate-700">{r.rule}</div>
                            <div className="text-xs text-slate-500">{r.detail}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
                      {data.meta.ceilings}
                    </div>
                  </div>

                  {a.llmReasoning && (
                    <div className="rounded-md border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
                        <span>Model-vurdering</span>
                        {a.llmConfidence !== null && <span>tillid {(a.llmConfidence * 100).toFixed(0)}%</span>}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.llmReasoning}</p>
                      {Array.isArray(a.llmSectorEvidence) && a.llmSectorEvidence.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {a.llmSectorEvidence.map((e: string, i: number) => (
                            <li key={i} className="border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500">
                              “{e}”
                            </li>
                          ))}
                        </ul>
                      )}
                      {a.conflict && (
                        <p className="mt-2 rounded bg-sky-50 p-2 text-xs text-sky-800">{a.conflictNote}</p>
                      )}
                    </div>
                  )}

                  {Array.isArray(a.supplyChainSignals) && a.supplyChainSignals.length > 0 && (
                    <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-violet-700">
                        Leverandørkæde-signaler
                      </div>
                      <ul className="mt-1 list-inside list-disc text-sm text-violet-900">
                        {a.supplyChainSignals.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">Ingen vurdering endnu — kør pipelinen for denne virksomhed.</p>
              )}
            </section>

            {/* ---------- Decision makers ---------- */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Beslutningstagere</h3>
              {data.contacts.length === 0 && (
                <p className="text-sm text-slate-500">Ingen registrerede ledelsesmedlemmer fundet i CVR.</p>
              )}
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {data.contacts.map((c) => {
                  const badge = EMAIL_BADGE[c.emailStatus] ?? UNVERIFIED_BADGE;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{c.name}</span>
                          {c.isPrimary && <Badge variant="outline">Primær</Badge>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {c.title ?? "—"} {c.rawTitle ? `· ${c.rawTitle}` : ""} · {c.source}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {c.directEmail ? (
                          <>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            <code className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">
                              {c.directEmail}
                            </code>
                            <CopyButton value={c.directEmail} label="" size="icon" aria-label="Kopiér e-mail" />
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">ingen e-mail</span>
                        )}
                        {c.directPhone && (
                          <a
                            href={`tel:${c.directPhone}`}
                            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                          >
                            <Phone className="h-3.5 w-3.5" /> {c.directPhone}
                          </a>
                        )}
                        {c.linkedinUrl && (
                          <a
                            href={c.linkedinUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-slate-400 hover:text-[#0a66c2]"
                            aria-label="LinkedIn"
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* ---------- Teaser ---------- */}
            <TeaserPanel teaser={data.teaser} recipientEmail={primaryEmail} auditHook={a?.auditHook ?? null} />

            {/* ---------- Financial history ---------- */}
            {data.financials.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">Regnskabshistorik</h3>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">År</th>
                        <th className="px-3 py-2 text-right">Omsætning</th>
                        <th className="px-3 py-2 text-right">Bruttofortjeneste</th>
                        <th className="px-3 py-2 text-right">Balancesum</th>
                        <th className="px-3 py-2 text-right">Ansatte</th>
                        <th className="px-3 py-2 text-left">Kilde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.financials.map((f) => (
                        <tr key={f.year}>
                          <td className="px-3 py-2 tabular-nums">{f.year}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatDkk(f.revenue, { compact: true })}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatDkk(f.grossProfit, { compact: true })}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatDkk(f.balanceSheet, { compact: true })}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{f.employeesAvg ?? "—"}</td>
                          <td className="px-3 py-2">
                            {f.reportUrl ? (
                              <a
                                href={f.reportUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-xs text-slate-500 underline hover:text-slate-800"
                              >
                                {f.reportFormat}
                              </a>
                            ) : (
                              "—"
                            )}
                            {f.parseWarnings?.length > 0 && (
                              <span className="ml-1 text-xs text-amber-600" title={f.parseWarnings.join("\n")}>
                                ⚠
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ---------- Outreach ---------- */}
            <section className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Pipeline</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(OUTREACH_LABELS) as OutreachStatus[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={data.outreach?.status === s ? "default" : "outline"}
                    disabled={saving}
                    onClick={() => patchStatus(s)}
                  >
                    {OUTREACH_LABELS[s]}
                  </Button>
                ))}
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Noter…"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Sidst opdateret {formatDate(data.company.updatedAt)}</span>
                <Button
                  size="sm"
                  variant="subtle"
                  disabled={saving}
                  onClick={() => patchStatus(data.outreach?.status ?? "NEW")}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Gem noter
                </Button>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
