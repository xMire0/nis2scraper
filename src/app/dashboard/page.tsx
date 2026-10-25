"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  Building2,
  GitBranch,
  Upload,
  Settings2,
  Search,
  ArrowUpRight,
  ArrowRight,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  CheckCircle2,
  ScanSearch,
  Clock3,
  Target,
  FileSpreadsheet,
  RefreshCw,
  LogOut,
  X,
} from "lucide-react";
import { relevanceLabels, stages } from "@/lib/intelligence/config";
import {
  type Workspace,
  type Company,
  date,
  employees,
} from "@/components/intelligence-types";
import { Detail } from "@/components/intelligence-detail";
import { ImportDialog } from "@/components/intelligence-import";
import { DiscoveryPanel } from "@/components/intelligence-discovery";
import { Settings } from "@/components/intelligence-settings";
import { EnrichmentQueue } from "@/components/intelligence-queue";
const nav = [
  { id: "overview", label: "Overblik", icon: LayoutDashboard },
  { id: "companies", label: "Virksomheder", icon: Building2 },
  { id: "queue", label: "Kø", icon: Clock3 },
  { id: "sales", label: "Salgsarbejde", icon: GitBranch },
  { id: "discovery", label: "Find virksomheder", icon: ScanSearch },
  { id: "imports", label: "Importer", icon: Upload },
  { id: "settings", label: "Indstillinger", icon: Settings2 },
];
export default function Dashboard() {
  const [data, setData] = useState<Workspace | null>(null),
    [view, setView] = useState("overview"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState(""),
    [priority, setPriority] = useState(""),
    [segment, setSegment] = useState(""),
    [status, setStatus] = useState(""),
    [relevance, setRelevance] = useState(""),
    [sort, setSort] = useState("score"),
    [page, setPage] = useState(1),
    [exporting, setExporting] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/intelligence");
      if (res.status === 401) {
        location.href = "/login";
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Dashboardet kunne ikke indlæses",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!busy && document.visibilityState === "visible") void load();
    }, 20000);
    return () => clearInterval(timer);
  }, [load, busy]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPage(1);
  }, [search, priority, segment, status, relevance, sort]);
  async function perform(body: Record<string, unknown>) {
    setBusy(String(body.action));
    setError("");
    try {
      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Handlingen fejlede");
      if (body.action !== "preview") {
        await load();
        setToast(
          body.action === "discover"
            ? `${result.added ?? 0} nye virksomheder · ${result.updated ?? 0} opdateret · ${result.skipped ?? 0} frasorteret`
            : body.action === "import"
              ? `${result.added} virksomheder importeret · ${result.duplicates} dubletter · ${result.invalid} ugyldige rækker`
              : body.action === "analyze"
                ? "Hjemmesideanalysen er klar"
                : body.action === "outreach"
                  ? "Udkast oprettet"
                  : "Ændringer gemt",
        );
      }
      return result;
    } catch (e) {
      if (["analyze", "discover"].includes(String(body.action))) await load();
      setError(e instanceof Error ? e.message : "Handlingen fejlede");
      return null;
    } finally {
      setBusy("");
    }
  }
  const companies = data?.companies ?? [];
  const filtered = useMemo(
    () =>
      companies
        .filter((c) => {
          const s = c.scores[0];
          return (
            (!search ||
              `${c.name} ${c.cvr} ${c.website ?? ""}`
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (!priority || s?.priority === priority) &&
            (!segment || s?.segment === segment) &&
            (!status || (c.outreach?.status ?? "NEW") === status) &&
            (!relevance || (s?.relevance ?? "REVIEW") === relevance)
          );
        })
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name, "da")
            : sort === "recent"
              ? new Date(b.scores[0]?.createdAt ?? 0).getTime() -
                new Date(a.scores[0]?.createdAt ?? 0).getTime()
              : (b.scores[0]?.value ?? -1) - (a.scores[0]?.value ?? -1),
        ),
    [companies, search, priority, segment, status, relevance, sort],
  );
  const total = companies.length,
    analyzed = companies.filter((c) => c.scores.length).length,
    high = companies.filter((c) =>
      ["A", "B"].includes(c.scores[0]?.priority ?? ""),
    ).length,
    due = companies.filter(
      (c) =>
        c.outreach?.nextFollowUpAt &&
        Date.parse(c.outreach.nextFollowUpAt) < Date.now() &&
        !["CLOSED_WON", "CLOSED_LOST"].includes(c.outreach.status),
    ).length;
  const current = companies.find((c) => c.id === selected);
  const visible = filtered.slice((page - 1) * 15, page * 15);
  function choosePriority(p: string) {
    setView("companies");
    setPriority(p);
    setRelevance("");
  }
  async function exportFiltered() {
    if (!filtered.length) {
      setError("Ingen virksomheder at eksportere med de aktuelle filtre");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({ sort });
      if (search.trim()) params.set("search", search.trim());
      if (priority) params.set("priority", priority);
      if (segment) params.set("segment", segment);
      if (status) params.set("status", status);
      if (relevance) params.set("relevance", relevance);
      const res = await fetch(`/api/intelligence/export?${params}`);
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
          ?.match(/filename="([^"]+)"/)?.[1] ?? "northstar-leads.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      setToast(
        `${filtered.length} virksomhed${filtered.length === 1 ? "" : "er"} eksporteret til Excel`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eksporten fejlede");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/dashboard">
          <div className="brand-icon">
            <ShieldCheck size={22} />
          </div>
          <div>
            NORTHSTAR<span>LEAD INTELLIGENCE</span>
          </div>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">DK</span>
          <div>
            Jeres arbejdsrum<small>Danmark · NIS2 & cyber</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">ARBEJDSOMRÅDE</p>
        <nav aria-label="Hovednavigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "companies" && (
                <span className="nav-count">{total}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-note">
            <span className="online-dot" />
            Offentlige data. Konkrete beviser.
            <p>
              Find de rigtige virksomheder.
              <br />
              Start den relevante samtale.
            </p>
          </div>
          <button
            className="profile"
            onClick={async () => {
              await fetch("/api/session", { method: "DELETE" });
              location.href = "/login";
            }}
          >
            <span className="profile-avatar">DK</span>
            <div>
              Dansk cybersikkerhed<small>Fælles arbejdsrum</small>
            </div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Arbejdsrum <span>/</span>{" "}
            <strong>{nav.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="mode-pill">
              <span className="online-dot" />
              Regelbaseret scoring
            </span>
            <button
              className="icon-button"
              onClick={() => load()}
              aria-label="Opdater dashboard"
              disabled={Boolean(busy)}
            >
              <RefreshCw size={17} />
            </button>
            <span className="top-avatar">DK</span>
          </div>
        </header>
        <main className="dashboard-main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                DANSKE VIRKSOMHEDER. RELEVANTE MULIGHEDER.
              </p>
              <h1>
                {
                  (
                    {
                      discovery: "Find jeres næste kunder",
                      overview: "Et klarere billede af jeres næste kunde.",
                      companies: "Find jeres næste relevante kunde.",
                      sales: "Fra første indsigt til samarbejde.",
                      imports: "Et godt grundlag starter med data.",
                      settings: "Jeres marked. Jeres prioritering.",
                      queue: "Følg arbejdet med jeres leads.",
                    } as Record<string, string>
                  )[view]
                }
              </h1>
              <p>
                {view === "settings"
                  ? "Tilpas målsegmenter, signaler og regler til jeres forretning."
                  : "Prioritér leverandører med mulige cyberkrav fra deres kunder — med beviserne ved hånden."}
              </p>
            </div>
            {view !== "settings" && (
              <button className="primary" onClick={() => setView("discovery")}>
                <Plus size={17} />
                Find virksomheder
              </button>
            )}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Luk fejl"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-bar" role="status">
              Henter jeres arbejdsrum…
            </div>
          )}
          {view === "overview" && (
            <>
              <section className="metric-grid">
                <Metric
                  label="Virksomheder i arbejdsrummet"
                  value={total}
                  icon={Building2}
                  note={`${analyzed} analyseret · ${total - analyzed} afventer`}
                  tone="neutral"
                />
                <Metric
                  label="Prioriterede muligheder"
                  value={high}
                  icon={Target}
                  note="Virksomheder med A- eller B-prioritet"
                  tone="orange"
                />
                <Metric
                  label="Klar til næste handling"
                  value={due}
                  icon={Clock3}
                  note="Planlagte opfølgninger, der er forfaldne"
                  tone="green"
                />
              </section>
              <div className="insight-grid">
                <section className="opportunity-card">
                  <div className="opportunity-copy">
                    <span className="mini-label">
                      <span className="online-dot" />
                      LEVERANDØRSIKKERHED
                    </span>
                    <h2>
                      Gode leads starter
                      <br />
                      med konkrete signaler.
                    </h2>
                    <p>
                      Forbind virksomhedens ydelser med dens kunder.
                      <br />
                      Brug gratis scope-afklaring som første samtale.
                    </p>
                    <button
                      onClick={() => {
                        setView("companies");
                        setRelevance("SUPPLY");
                      }}
                    >
                      Undersøg leverandørmuligheder <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="orbit-art" aria-hidden="true">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="orbit orbit-three" />
                    <div className="orbit-center">
                      <ShieldCheck size={33} />
                    </div>
                    <div className="orbit-node node-one">
                      <Building2 size={17} />
                    </div>
                    <div className="orbit-node node-two">
                      <CheckCircle2 size={17} />
                    </div>
                    <div className="orbit-node node-three">
                      <GitBranch size={17} />
                    </div>
                  </div>
                </section>
                <section className="panel distribution">
                  <div className="section-line">
                    <h3>Jeres prioritering</h3>
                    <span className="tiny muted">{analyzed} analyser</span>
                  </div>
                  {["A", "B", "C", "D"].map((p) => {
                    const count = companies.filter(
                      (c) => c.scores[0]?.priority === p,
                    ).length;
                    return (
                      <button
                        className="distribution-row"
                        key={p}
                        onClick={() => choosePriority(p)}
                      >
                        <span
                          className={`priority priority-${p.toLowerCase()}`}
                        >
                          {p}
                        </span>
                        <span className="distribution-track">
                          <span
                            style={{
                              width: `${analyzed ? (count / analyzed) * 100 : 0}%`,
                            }}
                            className={`bar-${p.toLowerCase()}`}
                          />
                        </span>
                        <strong>{count}</strong>
                      </button>
                    );
                  })}
                  <p className="tiny muted">
                    Kommerciel prioritet · ikke en NIS2-afgørelse
                  </p>
                </section>
              </div>
            </>
          )}
          {(view === "overview" || view === "companies") && (
            <section className="panel leads-panel">
              <div className="leads-heading">
                <div>
                  <h2>
                    {view === "overview"
                      ? "Virksomheder med potentiale"
                      : "Alle virksomheder"}{" "}
                    <span className="count-tag">{filtered.length}</span>
                  </h2>
                  <p className="muted">
                    Seneste vurdering pr. virksomhed. Klik for at se signaler og
                    næste skridt.
                  </p>
                </div>
                <div className="leads-heading-actions">
                  <button
                    className="secondary small"
                    disabled={exporting || !filtered.length || Boolean(busy)}
                    onClick={() => void exportFiltered()}
                  >
                    <FileSpreadsheet size={15} />
                    {exporting
                      ? "Eksporterer…"
                      : `Eksportér til Excel (${filtered.length})`}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch("");
                      setPriority("");
                      setSegment("");
                      setStatus("");
                      setRelevance("");
                    }}
                  >
                    Nulstil filtre
                  </button>
                </div>
              </div>
              <div className="filter-row">
                <label className="search-box">
                  <Search size={17} />
                  <span className="sr-only">Søg virksomheder</span>
                  <input
                    placeholder="Søg virksomhed, CVR eller hjemmeside…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrér prioritet"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">Alle prioriteter</option>
                  {["A", "B", "C", "D"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrér segment"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                >
                  <option value="">Alle segmenter</option>
                  {[
                    ...new Set(
                      companies.flatMap((c) =>
                        c.scores[0] ? [c.scores[0].segment] : [],
                      ),
                    ),
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Filtrér salgsstatus"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Alle salgsstatusser</option>
                  {Object.entries(stages).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrér relevans"
                  value={relevance}
                  onChange={(e) => setRelevance(e.target.value)}
                >
                  <option value="">Alle relevansklasser</option>
                  {Object.entries(relevanceLabels).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {filtered.length ? (
                <>
                  <div className="table-scroll">
                    <table className="leads-table">
                      <thead>
                        <tr>
                          <th>Virksomhed</th>
                          <th>Leadscore</th>
                          <th>Segment & relevans</th>
                          <th>Ansatte</th>
                          <th>Salgsstatus</th>
                          <th>Seneste analyse</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((c) => (
                          <LeadRow
                            key={c.id}
                            company={c}
                            open={() => setSelected(c.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer className="table-footer">
                    <span>
                      Viser {(page - 1) * 15 + 1}–
                      {Math.min(page * 15, filtered.length)} af{" "}
                      {filtered.length} virksomheder
                    </span>
                    <div>
                      <label className="sort-label">
                        <SlidersHorizontal size={13} />
                        <select
                          aria-label="Sortering"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="score">Højeste score først</option>
                          <option value="recent">Seneste analyse først</option>
                          <option value="name">Navn A–Å</option>
                        </select>
                      </label>
                      <button
                        className="secondary small"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Forrige
                      </button>
                      <button
                        className="secondary small"
                        disabled={page * 15 >= filtered.length}
                        onClick={() => setPage(page + 1)}
                      >
                        Næste
                      </button>
                    </div>
                  </footer>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    <ScanSearch size={30} />
                  </div>
                  <h3>
                    {total
                      ? "Ingen virksomheder matcher filtrene"
                      : "Jeres næste kunde starter her"}
                  </h3>
                  <p>
                    {total
                      ? "Prøv at justere søgning eller filtre."
                      : "Find virksomheder direkte i CVRbasen, og prioritér dem med lokale regler."}
                  </p>
                  {!total && (
                    <button
                      className="primary"
                      onClick={() => setView("discovery")}
                    >
                      <Search size={16} />
                      Find virksomheder i CVR
                    </button>
                  )}
                  <div className="empty-steps">
                    <span>
                      01 <b>Find virksomheder</b>
                    </span>
                    <i />
                    <span>
                      02 <b>Find signaler</b>
                    </span>
                    <i />
                    <span>
                      03 <b>Start samtalen</b>
                    </span>
                  </div>
                </div>
              )}
            </section>
          )}
          {view === "sales" && (
            <div className="sales-board">
              {Object.entries(stages).map(([key, label]) => {
                const group = companies.filter(
                  (c) => (c.outreach?.status ?? "NEW") === key,
                );
                return (
                  <section className="sales-column" key={key}>
                    <h3>
                      <span
                        className={`stage-dot stage-${key.toLowerCase()}`}
                      />
                      {label}
                      <span>{group.length}</span>
                    </h3>
                    {group.map((c) => (
                      <button
                        className="sales-card"
                        key={c.id}
                        onClick={() => setSelected(c.id)}
                      >
                        <div className="section-line">
                          <strong>{c.name}</strong>
                          {c.scores[0] && (
                            <span
                              className={`priority priority-${c.scores[0].priority.toLowerCase()}`}
                            >
                              {c.scores[0].priority}
                            </span>
                          )}
                        </div>
                        <p>
                          {c.scores[0]?.segment ??
                            c.db07Description ??
                            "Afventer analyse"}
                        </p>
                        <div>
                          <Clock3 size={13} />
                          {c.outreach?.nextFollowUpAt
                            ? date(c.outreach.nextFollowUpAt)
                            : "Ingen opfølgning planlagt"}
                        </div>
                        {c.outreach?.nextAction && (
                          <small>{c.outreach.nextAction}</small>
                        )}
                      </button>
                    ))}
                    {!group.length && (
                      <div className="board-empty">
                        Ingen virksomheder her endnu
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {view === "imports" && (
            <section className="panel imports-panel">
              <div className="section-line">
                <h2>Importhistorik</h2>
                <span className="count-tag">
                  {data?.imports.length ?? 0} importer
                </span>
              </div>
              <p className="muted">
                Hver import gemmer kilde, originalfil og resultat. Dubletter
                ændrer ikke eksisterende virksomheder.
              </p>
              {data?.imports.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Fil & kilde</th>
                        <th>Dato</th>
                        <th>Oprettet</th>
                        <th>Dubletter</th>
                        <th>Ugyldige</th>
                        <th>Original</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.imports.map((i) => (
                        <tr key={i.id}>
                          <td>
                            <strong>{i.filename}</strong>
                            <small>{i.source}</small>
                          </td>
                          <td>{date(i.createdAt)}</td>
                          <td>{i.result.added}</td>
                          <td>{i.result.duplicates}</td>
                          <td>{i.result.invalid}</td>
                          <td>
                            <a
                              className="text-link"
                              href={`/api/intelligence?importId=${i.id}`}
                            >
                              Hent CSV <ArrowUpRight size={12} />
                            </a>
                          </td>
                          <td>
                            <button
                              className="text-button"
                              disabled={Boolean(busy)}
                              onClick={() => {
                                if (
                                  confirm(
                                    "Slet råfil og importhistorik? Importerede virksomheder bevares.",
                                  )
                                )
                                  void perform({
                                    action: "deleteImport",
                                    id: i.id,
                                  });
                              }}
                            >
                              Slet råfil
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <FileSpreadsheet size={36} />
                  <h3>En ren start</h3>
                  <p>Jeres importer og valideringsresultater vises her.</p>
                  <button
                    className="primary"
                    onClick={() => setImportOpen(true)}
                  >
                    Importér CSV
                  </button>
                </div>
              )}
            </section>
          )}
          {view === "discovery" && data && (
            <DiscoveryPanel
              data={data.discovery}
              busy={busy}
              perform={perform}
            />
          )}
          {view === "queue" && data && (
            <EnrichmentQueue data={data} onSelect={setSelected} />
          )}
          {view === "settings" && data && (
            <Settings
              key={data.version}
              initial={data.config}
              websiteSearch={data.websiteSearch}
              version={data.version}
              perform={perform}
              busy={busy}
            />
          )}
          <footer className="page-footer">
            <ShieldCheck size={13} />
            <span>
              Offentlige kilder · sporbare signaler · manuel scope-afklaring
            </span>
            <span>NORTHSTAR / MVP</span>
          </footer>
        </main>
      </div>
      {error && (selected || importOpen) && (
        <div className="toast error-toast" role="alert">
          {error}
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Luk besked"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {busy === "analyze" && (
        <div className="analysis-progress" role="status">
          <ScanSearch className="pulse" size={18} />
          Hjemmesiden analyseres. Fund og score gemmes automatisk.
        </div>
      )}
      {current && (
        <Detail
          key={current.id}
          company={current}
          onClose={() => setSelected(null)}
          perform={perform}
          busy={busy}
          version={data?.version ?? 0}
          websiteSearch={data?.websiteSearch}
          automatic={data?.discovery.config.autoEnrich ?? false}
          onQueue={() => {
            setSelected(null);
            setView("queue");
          }}
        />
      )}
      {importOpen && (
        <ImportDialog
          perform={perform}
          busy={busy}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Building2;
  tone: string;
}) {
  return (
    <article className="panel metric">
      <div className="section-line">
        <span>{label}</span>
        <span className={`metric-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      <strong>{value.toLocaleString("da-DK")}</strong>
      <p>{note}</p>
    </article>
  );
}
function LeadRow({ company: c, open }: { company: Company; open: () => void }) {
  const s = c.scores[0];
  return (
    <tr onClick={open}>
      <td>
        <button
          className="company-button"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          <span className="company-avatar">
            {c.name
              .replace(/^DEMO\s*[—-]?\s*/, "")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span>
            <strong>{c.name}</strong>
            <small>
              {c.addressCity ?? "Danmark"} <span>·</span> CVR {c.cvr}
            </small>
          </span>
        </button>
      </td>
      <td>
        {s ? (
          <div className="table-score">
            <span className={`priority priority-${s.priority.toLowerCase()}`}>
              {s.priority}
            </span>
            <strong>{s.value}</strong>
            <span>/100</span>
          </div>
        ) : (
          <span className="unscored">Afventer</span>
        )}
      </td>
      <td>
        <span className="segment-label">
          {s?.segment ?? c.db07Description ?? "Ikke analyseret"}
        </span>
        <small className="relevance-caption">
          {s ? relevanceLabels[s.relevance] : "Klar til hjemmesideanalyse"}
        </small>
      </td>
      <td>{employees(c)}</td>
      <td>
        <span
          className={`status-pill status-${(c.outreach?.status ?? "NEW").toLowerCase()}`}
        >
          <i />
          {stages[c.outreach?.status ?? "NEW"] ?? "Undersøgt"}
        </span>
      </td>
      <td className="muted">{date(s?.createdAt)}</td>
      <td>
        <ArrowUpRight size={16} className="row-arrow" />
      </td>
    </tr>
  );
}
