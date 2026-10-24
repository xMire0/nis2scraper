import { Building2, Link2, MailCheck, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadsResponse } from "@/lib/types";

interface Metric {
  key: string;
  label: string;
  value: number;
  hint: string;
  Icon: typeof Building2;
  tone: string;
}

export function KpiBar({ kpis, loading }: { kpis: LeadsResponse["kpis"] | null; loading?: boolean }) {
  const metrics: Metric[] = [
    {
      key: "total",
      label: "Scopede leads",
      value: kpis?.total ?? 0,
      hint: "Virksomheder kørt gennem hele pipelinen",
      Icon: Building2,
      tone: "text-slate-600 bg-slate-50",
    },
    {
      key: "essential",
      label: "Bilag 1 — særlig kritisk",
      value: kpis?.essential ?? 0,
      hint: "Tilsyn på forhånd, bøde op til 10 mio. EUR / 2 %",
      Icon: ShieldAlert,
      tone: "text-rose-600 bg-rose-50",
    },
    {
      key: "important",
      label: "Bilag 2 — vigtig enhed",
      value: kpis?.important ?? 0,
      hint: "Tilsyn efterfølgende, bøde op til 7 mio. EUR / 1,4 %",
      Icon: ShieldCheck,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      key: "supply",
      label: "Leverandørkæde / MSP",
      value: kpis?.supplyChain ?? 0,
      hint: "Ikke selv omfattet, men mødes af kundernes krav",
      Icon: Link2,
      tone: "text-violet-600 bg-violet-50",
    },
    {
      key: "review",
      label: "Til gennemgang",
      value: kpis?.needsReview ?? 0,
      hint: "Modstridende signaler eller manglende tal",
      Icon: AlertTriangle,
      tone: "text-sky-600 bg-sky-50",
    },
    {
      key: "contacts",
      label: "Verificerede kontakter",
      value: kpis?.verifiedContacts ?? 0,
      hint: "Direkte e-mails bekræftet af udbyderen",
      Icon: MailCheck,
      tone: "text-emerald-600 bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {metrics.map(({ key, label, value, hint, Icon, tone }) => (
        <div key={key} className="rounded-lg border border-slate-200 bg-white p-4" title={hint}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">{label}</span>
            <span className={cn("rounded-md p-1.5", tone)}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {loading ? <span className="inline-block h-7 w-12 animate-pulse rounded bg-slate-100" /> : value.toLocaleString("da-DK")}
          </div>
        </div>
      ))}
    </div>
  );
}
