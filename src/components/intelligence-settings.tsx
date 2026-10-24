"use client";
import { useState } from "react";
import { Save, Plus, Trash2, SlidersHorizontal } from "lucide-react";
import { type Config } from "@/lib/intelligence/config";
import type { Perform, Workspace } from "./intelligence-types";
export function Settings({
  initial,
  version,
  perform,
  busy,
  websiteSearch,
}: {
  initial: Config;
  version: number;
  perform: Perform;
  busy: string;
  websiteSearch: Workspace["websiteSearch"];
}) {
  const [config, setConfig] = useState<Config>({
    ...structuredClone(initial),
    openaiMaxRequestsPerDay:
      initial.openaiMaxRequestsPerDay ?? websiteSearch.maxRequestsPerDay,
  });
  const validLimit =
    Number.isInteger(config.openaiMaxRequestsPerDay) &&
    config.openaiMaxRequestsPerDay !== null &&
    config.openaiMaxRequestsPerDay >= 0 &&
    config.openaiMaxRequestsPerDay <= 1000;
  const [segmentTexts, setSegmentTexts] = useState(
    initial.segments.map((s) => s.keywords.join(", ")),
  );
  const set = (key: keyof Config, value: unknown) =>
    setConfig({ ...config, [key]: value });
  return (
    <div className="settings-layout">
      <div className="settings-main">
        <section className="panel settings-panel">
          <p className="eyebrow">OPENAI · HJEMMESIDESØGNING</p>
          <h2>Søgebudget</h2>
          <p>
            {websiteSearch.requestsToday} af {websiteSearch.maxRequestsPerDay}{" "}
            søgeforsøg brugt i dag (UTC).
          </p>
          <label>
            Maks. OpenAI-søgninger pr. dag
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              value={config.openaiMaxRequestsPerDay ?? ""}
              onChange={(e) =>
                set(
                  "openaiMaxRequestsPerDay",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <div className="channel-grid">
            <button
              type="button"
              className="secondary"
              disabled={
                Boolean(busy) ||
                !validLimit ||
                config.openaiMaxRequestsPerDay! >= 1000
              }
              onClick={() =>
                set(
                  "openaiMaxRequestsPerDay",
                  Math.min(1000, config.openaiMaxRequestsPerDay! + 10),
                )
              }
            >
              +10 søgninger
            </button>
            <button
              type="button"
              className="primary"
              disabled={Boolean(busy) || !validLimit}
              onClick={() => perform({ action: "settings", config })}
            >
              <Save size={16} />
              {busy === "settings" ? "Gemmer…" : "Gem indstillinger"}
            </button>
          </div>
          {!validLimit && (
            <p role="alert">Angiv et helt tal mellem 0 og 1.000.</p>
          )}
          <p className="tiny muted">
            Gem for at anvende ændringen med det samme. Dagens forbrug
            nulstilles ikke. 0 pauser nye betalte søgninger. OpenAI opkræver
            betaling for søgning og tokens; loftet er antal forsøg, ikke kroner.
            API-pauser gælder fortsat.
          </p>
          {!websiteSearch.configured && (
            <p className="notice">OpenAI-nøglen mangler på serveren.</p>
          )}
        </section>
        <section className="panel settings-panel">
          <div className="section-line">
            <div>
              <p className="eyebrow">JERES IDEELLE KUNDE</p>
              <h2>Målgruppe & prioritering</h2>
            </div>
            <SlidersHorizontal size={20} />
          </div>
          <p className="muted">
            Tilpas reglerne til jeres marked. Ændringer gemmes som en ny version
            og bruges ved næste analyse.
          </p>
          <div className="form-grid three">
            {(
              [
                ["minEmployees", "Min. ansatte"],
                ["maxEmployees", "Maks. ansatte"],
                ["sizeWeight", "Point for størrelse"],
                ["priorityA", "A-prioritet fra"],
                ["priorityB", "B-prioritet fra"],
                ["priorityC", "C-prioritet fra"],
                ["enterprisePenalty", "Fradrag: stor virksomhed"],
                ["smallPenalty", "Fradrag: lille uden kunder"],
                ["noSignalsPenalty", "Fradrag: ingen signaler"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  value={config[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="panel settings-panel">
          <p className="eyebrow">SPORBARE SIGNALER</p>
          <h2>Søgeord & vægte</h2>
          <p className="muted">
            Ét fund tæller højst én gang pr. signalgruppe. Nøgleord er
            indikatorer, som altid skal læses i kontekst.
          </p>
          {config.groups.map((g, i) => (
            <div className="signal-editor" key={g.id}>
              <div>
                <h3>{g.label}</h3>
                <label>
                  Maks. point
                  <input
                    type="number"
                    min={0}
                    max={40}
                    disabled={g.id === "direct"}
                    value={g.weight}
                    onChange={(e) =>
                      set(
                        "groups",
                        config.groups.map((x, j) =>
                          j === i
                            ? { ...x, weight: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <label>
                Søgeord, adskilt af komma
                <textarea
                  rows={3}
                  defaultValue={g.keywords.join(", ")}
                  onChange={(e) =>
                    set(
                      "groups",
                      config.groups.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              keywords: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            }
                          : x,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </section>
        <section className="panel settings-panel">
          <div className="section-line">
            <h2>Målsegmenter</h2>
            <button
              className="secondary small"
              onClick={() => {
                set("segments", [
                  ...config.segments,
                  { name: "Nyt segment", keywords: ["søgeord"] },
                ]);
                setSegmentTexts([...segmentTexts, "søgeord"]);
              }}
            >
              <Plus size={14} />
              Tilføj
            </button>
          </div>
          {config.segments.map((s, i) => (
            <div className="segment-editor" key={i}>
              <label>
                Segment
                <input
                  value={s.name}
                  onChange={(e) =>
                    set(
                      "segments",
                      config.segments.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Søgeord
                <input
                  value={segmentTexts[i] ?? ""}
                  onChange={(e) => {
                    setSegmentTexts(
                      segmentTexts.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    );
                    set(
                      "segments",
                      config.segments.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              keywords: e.target.value
                                .split(",")
                                .map((k) => k.trim())
                                .filter(Boolean),
                            }
                          : x,
                      ),
                    );
                  }}
                />
              </label>
              <button
                className="icon-button"
                aria-label={`Fjern segment ${s.name}`}
                onClick={() => {
                  set(
                    "segments",
                    config.segments.filter((_, j) => j !== i),
                  );
                  setSegmentTexts(segmentTexts.filter((_, j) => j !== i));
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </section>
      </div>
      <aside className="settings-aside">
        <section className="panel settings-panel">
          <p className="eyebrow">VERSION {version}</p>
          <h3>Gem jeres regelsæt</h3>
          <p>
            Eksisterende analyser bevarer deres oprindelige regler og
            pointforklaring.
          </p>
          <button
            className="primary full"
            disabled={Boolean(busy) || !validLimit}
            onClick={() => perform({ action: "settings", config })}
          >
            <Save size={16} />
            Gem indstillinger
          </button>
        </section>
        <section className="panel settings-panel">
          <h3>Hjemmesideanalyse</h3>
          <label>
            Sider pr. analyse (1–8)
            <input
              type="number"
              min={1}
              max={8}
              value={config.maxPages}
              onChange={(e) => set("maxPages", Number(e.target.value))}
            />
          </label>
          <label>
            Pause mellem sider (ms)
            <input
              type="number"
              min={3000}
              max={15000}
              step={1000}
              value={config.delayMs}
              onChange={(e) => set("delayMs", Number(e.target.value))}
            />
          </label>
          <label>
            Opbevaring af kontakter (dage)
            <input
              type="number"
              min={7}
              max={365}
              value={config.retentionDays}
              onChange={(e) => set("retentionDays", Number(e.target.value))}
            />
          </label>
          <p className="tiny muted">
            robots.txt og adgangsbegrænsninger respekteres altid. Ændret
            opbevaring anvendes ved næste kontaktfund.
          </p>
        </section>
        <section className="panel settings-panel">
          <h3>Afsender til udkast</h3>
          <label>
            Navn
            <input
              value={config.senderName}
              onChange={(e) => set("senderName", e.target.value)}
            />
          </label>
          <label>
            Virksomhed
            <input
              value={config.senderCompany}
              onChange={(e) => set("senderCompany", e.target.value)}
            />
          </label>
        </section>
      </aside>
    </div>
  );
}
