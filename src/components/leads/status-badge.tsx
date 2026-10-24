import { AlertTriangle, Link2, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type Nis2Status } from "@/lib/types";

const CONFIG: Record<
  Nis2Status,
  { variant: "essential" | "important" | "supply" | "review" | "muted"; Icon: typeof ShieldAlert }
> = {
  ESSENTIAL: { variant: "essential", Icon: ShieldAlert },
  IMPORTANT: { variant: "important", Icon: ShieldCheck },
  SUPPLY_CHAIN_TARGET: { variant: "supply", Icon: Link2 },
  NEEDS_REVIEW: { variant: "review", Icon: AlertTriangle },
  OUT_OF_SCOPE: { variant: "muted", Icon: ShieldX },
};

export function Nis2StatusBadge({ status, annex }: { status: Nis2Status; annex?: string }) {
  const { variant, Icon } = CONFIG[status] ?? CONFIG.OUT_OF_SCOPE;
  return (
    <Badge variant={variant} title={annex === "ANNEX_1" ? "Bilag 1" : annex === "ANNEX_2" ? "Bilag 2" : undefined}>
      <Icon className="h-3 w-3" aria-hidden />
      {STATUS_LABELS[status]}
      {annex && annex !== "NONE" ? (
        <span className="ml-0.5 opacity-60">{annex === "ANNEX_1" ? "B1" : "B2"}</span>
      ) : null}
    </Badge>
  );
}
