"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Upload,
  FileSpreadsheet,
  X,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { fields, type Mapping } from "@/lib/intelligence/csv-fields";
import type { Perform } from "./intelligence-types";
interface Preview {
  headers: string[];
  mapping: Mapping;
  needsMapping: boolean;
  rows: {
    rowNumber: number;
    outcome: string;
    message: string | null;
    raw: Record<string, string>;
    company: { name: string; cvr: string } | null;
  }[];
}
export function ImportDialog({
  perform,
  busy,
  onClose,
}: {
  perform: Perform;
  busy: string;
  onClose: () => void;
}) {
  const [csv, setCsv] = useState(""),
    [filename, setFilename] = useState(""),
    [source, setSource] = useState("Proff / CVR"),
    [preview, setPreview] = useState<Preview | null>(null),
    [mapping, setMapping] = useState<Mapping>({}),
    [error, setError] = useState("");
  async function load(text: string, name: string) {
    setError("");
    setCsv(text);
    setFilename(name);
    const result = await perform({ action: "preview", csv: text });
    if (result) {
      setPreview(result);
      setMapping(result.mapping);
    }
  }
  const counts = {
    valid: preview?.rows.filter((r) => r.outcome === "VALID").length ?? 0,
    duplicates:
      preview?.rows.filter((r) => r.outcome === "DUPLICATE").length ?? 0,
    invalid: preview?.rows.filter((r) => r.outcome === "INVALID").length ?? 0,
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="import-dialog">
          <div className="drawer-heading">
            <div>
              <p className="eyebrow">FRA DATA TIL MULIGHEDER</p>
              <Dialog.Title>Importér virksomheder</Dialog.Title>
              <Dialog.Description>
                Upload en CSV fra en kilde, I har adgang til.
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Luk import">
              <X />
            </Dialog.Close>
          </div>
          <div className="import-body">
            <div className="upload-zone">
              <FileSpreadsheet size={34} />
              <strong>{filename || "Vælg jeres CSV-fil"}</strong>
              <p>UTF-8 · komma eller semikolon · højst 1.000 rækker / 2 MB</p>
              <label className="secondary file-button">
                Vælg fil
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 2000000) {
                      setError("Filen må højst være 2 MB");
                      return;
                    }
                    await load(await f.text(), f.name);
                  }}
                />
              </label>
              <a className="text-link" href="/eksempel-import.csv" download>
                Hent CSV-skabelon med fiktive eksempelvirksomheder
              </a>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {preview && (
              <>
                <div className="section-line">
                  <h3>Kontrollér kolonnerne</h3>
                  <span className="count-tag">
                    {preview.headers.length} kolonner
                  </span>
                </div>
                <div className="mapping-grid">
                  {Object.entries(fields).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      {["cvr", "name"].includes(key) ? " *" : ""}
                      <select
                        value={mapping[key as keyof Mapping] ?? ""}
                        onChange={(e) => {
                          setMapping({ ...mapping, [key]: e.target.value });
                          setPreview({ ...preview, needsMapping: true });
                        }}
                      >
                        <option value="">Ikke med i filen</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label>
                  Datakilde
                  <input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    maxLength={150}
                    placeholder="Fx Proff-udtræk, september 2026"
                  />
                </label>
                <button
                  className="secondary"
                  disabled={Boolean(busy)}
                  onClick={async () => {
                    const result = await perform({
                      action: "preview",
                      csv,
                      mapping,
                    });
                    if (result) setPreview(result);
                  }}
                >
                  <CheckCircle2 size={16} />
                  Validér kolonner
                </button>
                {!preview.needsMapping && (
                  <>
                    <div className="import-counts">
                      <span>
                        <b>{counts.valid}</b> klar til import
                      </span>
                      <span>
                        <b>{counts.duplicates}</b> dubletter springes over
                      </span>
                      <span>
                        <b>{counts.invalid}</b> ugyldige rækker
                      </span>
                    </div>
                    <div className="preview-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Række</th>
                            <th>Virksomhed</th>
                            <th>CVR</th>
                            <th>Validering</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((r) => (
                            <tr key={r.rowNumber}>
                              <td>{r.rowNumber}</td>
                              <td>
                                {r.company?.name ??
                                  r.raw[mapping.name ?? ""] ??
                                  "—"}
                              </td>
                              <td>
                                {r.company?.cvr ??
                                  r.raw[mapping.cvr ?? ""] ??
                                  "—"}
                              </td>
                              <td
                                className={
                                  r.outcome === "VALID" ? "success" : "error"
                                }
                              >
                                {r.message ?? "Klar"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="tiny muted">
                      Eksisterende virksomheder ændres ikke. Råfil, kilde og
                      valideringsresultat gemmes. Omsætning angives i hele DKK,
                      ikke tusinder.
                    </p>
                    <button
                      className="primary full"
                      disabled={
                        Boolean(busy) || !counts.valid || !source.trim()
                      }
                      onClick={async () => {
                        const result = await perform({
                          action: "import",
                          csv,
                          mapping,
                          source,
                          filename,
                        });
                        if (result) onClose();
                      }}
                    >
                      <Upload size={16} />
                      Importér {counts.valid} virksomheder
                      <ArrowRight size={16} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
