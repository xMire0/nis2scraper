"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SECTOR_LABELS, STATUS_LABELS, OUTREACH_LABELS, type Nis2Status, type OutreachStatus } from "@/lib/types";

export interface FilterState {
  search: string;
  status: Nis2Status[];
  sector: string[];
  annex: "" | "ANNEX_1" | "ANNEX_2";
  outreachStatus: OutreachStatus[];
  minEmployees: string;
  minBalance: string;
  hasVerifiedContact: boolean;
}

export const EMPTY_FILTERS: FilterState = {
  search: "",
  status: [],
  sector: [],
  annex: "",
  outreachStatus: [],
  minEmployees: "",
  minBalance: "",
  hasVerifiedContact: false,
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

export function LeadFilters({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) => onChange({ ...value, [key]: v });

  const activeCount =
    value.status.length +
    value.sector.length +
    value.outreachStatus.length +
    (value.annex ? 1 : 0) +
    (value.minEmployees ? 1 : 0) +
    (value.minBalance ? 1 : 0) +
    (value.hasVerifiedContact ? 1 : 0);

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={value.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Søg på navn, CVR eller domæne…"
            className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="number"
            min={0}
            value={value.minEmployees}
            onChange={(e) => set("minEmployees", e.target.value)}
            placeholder="Min. ansatte"
            className="h-9 w-32 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="number"
            min={0}
            step={1_000_000}
            value={value.minBalance}
            onChange={(e) => set("minBalance", e.target.value)}
            placeholder="Min. balance (DKK)"
            className="h-9 w-44 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={value.hasVerifiedContact}
            onChange={(e) => set("hasVerifiedContact", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Kun med verificeret e-mail
        </label>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS, search: value.search })}>
            <X className="h-3.5 w-3.5" /> Ryd {activeCount}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 self-center text-xs font-medium uppercase tracking-wide text-slate-400">NIS2</span>
        {(Object.keys(STATUS_LABELS) as Nis2Status[]).map((s) => (
          <Chip key={s} active={value.status.includes(s)} onClick={() => set("status", toggle(value.status, s))}>
            {STATUS_LABELS[s]}
          </Chip>
        ))}
        <span className="mx-2 self-center text-slate-200">|</span>
        <Chip active={value.annex === "ANNEX_1"} onClick={() => set("annex", value.annex === "ANNEX_1" ? "" : "ANNEX_1")}>
          Bilag 1
        </Chip>
        <Chip active={value.annex === "ANNEX_2"} onClick={() => set("annex", value.annex === "ANNEX_2" ? "" : "ANNEX_2")}>
          Bilag 2
        </Chip>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 self-center text-xs font-medium uppercase tracking-wide text-slate-400">Sektor</span>
        {Object.entries(SECTOR_LABELS)
          .filter(([key]) => key !== "NONE")
          .map(([key, label]) => (
            <Chip key={key} active={value.sector.includes(key)} onClick={() => set("sector", toggle(value.sector, key))}>
              {label}
            </Chip>
          ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="mr-1 self-center text-xs font-medium uppercase tracking-wide text-slate-400">Pipeline</span>
        {(Object.keys(OUTREACH_LABELS) as OutreachStatus[]).map((s) => (
          <Chip
            key={s}
            active={value.outreachStatus.includes(s)}
            onClick={() => set("outreachStatus", toggle(value.outreachStatus, s))}
          >
            {OUTREACH_LABELS[s]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function filtersToQuery(f: FilterState, page: number, pageSize: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (f.search) params.set("search", f.search);
  if (f.status.length) params.set("status", f.status.join(","));
  if (f.sector.length) params.set("sector", f.sector.join(","));
  if (f.annex) params.set("annex", f.annex);
  if (f.outreachStatus.length) params.set("outreachStatus", f.outreachStatus.join(","));
  if (f.minEmployees) params.set("minEmployees", f.minEmployees);
  if (f.minBalance) params.set("minBalance", f.minBalance);
  if (f.hasVerifiedContact) params.set("hasVerifiedContact", "true");
  return params.toString();
}
