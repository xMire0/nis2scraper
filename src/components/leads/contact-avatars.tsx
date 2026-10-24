import { BadgeCheck, MailQuestion, MailX } from "lucide-react";

import { cn, initials } from "@/lib/utils";
import type { LeadContact } from "@/lib/types";

const RING: Record<string, string> = {
  VERIFIED: "ring-emerald-400",
  ACCEPT_ALL: "ring-amber-400",
  UNVERIFIED: "ring-slate-300",
  INVALID: "ring-rose-300",
};

/**
 * Overlapping avatars with a verification ring. The ring is the point: a rep
 * scanning the table needs to know at a glance whether there is a working
 * e-mail behind the row, not how many names the registry listed.
 */
export function ContactAvatars({ contacts, total }: { contacts: LeadContact[]; total: number }) {
  if (!contacts.length) {
    return <span className="text-xs text-slate-400">Ingen kontakter</span>;
  }

  const shown = contacts.slice(0, 3);
  const overflow = total - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((c) => (
          <span
            key={c.id}
            title={`${c.name}${c.title ? ` — ${c.title}` : ""}${c.directEmail ? `\n${c.directEmail}` : "\nIngen e-mail fundet"}`}
            className={cn(
              "relative flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2",
              RING[c.emailStatus] ?? RING.UNVERIFIED,
            )}
          >
            {initials(c.name)}
          </span>
        ))}
        {overflow > 0 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-[10px] font-medium text-slate-500 ring-2 ring-slate-200">
            +{overflow}
          </span>
        )}
      </div>
      <span className="ml-2">
        {contacts.some((c) => c.emailStatus === "VERIFIED") ? (
          <BadgeCheck className="h-4 w-4 text-emerald-500" aria-label="Verificeret e-mail" />
        ) : contacts.some((c) => c.directEmail) ? (
          <MailQuestion className="h-4 w-4 text-amber-500" aria-label="Uverificeret e-mail" />
        ) : (
          <MailX className="h-4 w-4 text-slate-300" aria-label="Ingen e-mail" />
        )}
      </span>
    </div>
  );
}
