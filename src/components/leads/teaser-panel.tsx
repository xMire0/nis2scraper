"use client";

import * as React from "react";
import { Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";

interface Props {
  teaser: { subject: string; body: string };
  recipientEmail: string | null;
  auditHook: string | null;
}

/**
 * The teaser is editable in place: reps always want to change a sentence, and
 * a copy button on read-only text just makes them paste and then edit in their
 * mail client, where the personalisation gets lost.
 */
export function TeaserPanel({ teaser, recipientEmail, auditHook }: Props) {
  const [subject, setSubject] = React.useState(teaser.subject);
  const [body, setBody] = React.useState(teaser.body);

  React.useEffect(() => {
    setSubject(teaser.subject);
    setBody(teaser.body);
  }, [teaser.subject, teaser.body]);

  const mailto = `mailto:${recipientEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Outreach-teaser
        </h3>
        <div className="flex gap-2">
          <CopyButton value={`${subject}\n\n${body}`} label="Kopiér mail" />
          <Button variant="default" size="sm" asChild disabled={!recipientEmail}>
            <a href={mailto}>
              <Mail className="h-3.5 w-3.5" /> Åbn i mailklient
            </a>
          </Button>
        </div>
      </header>

      {auditHook && (
        <div className="rounded-md border border-violet-200 bg-violet-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-violet-700">Audit hook</div>
          <p className="mt-1 text-sm text-violet-900">{auditHook}</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Emne</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Brødtekst</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-slate-400"
          />
        </label>
      </div>

      <p className="text-xs text-slate-400">
        Sidste afsnit er art. 14-oplysningspligten. Data er indsamlet uden om den registrerede, så den skal med i
        første kontakt — fjern den ikke.
      </p>
    </section>
  );
}
