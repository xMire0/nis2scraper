"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactAvatars } from "./contact-avatars";
import { Nis2StatusBadge } from "./status-badge";
import { cn, cvrFormat, formatDkk } from "@/lib/utils";
import { OUTREACH_LABELS, SECTOR_LABELS, type Lead, type LeadsResponse } from "@/lib/types";

interface Props {
  leads: Lead[];
  pagination: LeadsResponse["pagination"] | null;
  loading: boolean;
  onSelect: (cvr: string) => void;
  onPageChange: (page: number) => void;
}

export function LeadTable({ leads, pagination, loading, onSelect, onPageChange }: Props) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Virksomhed",
        cell: ({ row }) => (
          <div className="min-w-[220px]">
            <div className="font-medium text-slate-900">{row.original.name}</div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="tabular-nums">{cvrFormat(row.original.cvr)}</span>
              {row.original.city && <span>· {row.original.city}</span>}
              {row.original.domain && (
                <a
                  href={`https://${row.original.domain}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-slate-400 hover:text-slate-700"
                >
                  {row.original.domain}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "sector",
        header: "Sektor",
        cell: ({ row }) => {
          const nis2 = row.original.nis2;
          return (
            <div className="min-w-[160px]">
              <div className="text-sm text-slate-700">{nis2 ? SECTOR_LABELS[nis2.sector] ?? nis2.sector : "—"}</div>
              <div className="text-xs text-slate-400">
                {row.original.db07Code ? `DB07 ${row.original.db07Code}` : "—"}
                {nis2?.subSector ? ` · ${nis2.subSector}` : ""}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "employeeCount",
        header: ({ column }) => (
          <button
            className="inline-flex items-center gap-1 hover:text-slate-900"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Ansatte <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-slate-700">{row.original.employeeCount ?? "—"}</span>
        ),
      },
      {
        id: "balance",
        header: "Balancesum",
        cell: ({ row }) => {
          const f = row.original.financials;
          return (
            <div className="text-right tabular-nums">
              <div className="text-sm text-slate-700">{formatDkk(f?.balanceSheetDkk ?? null, { compact: true })}</div>
              <div className="text-xs text-slate-400">{f?.year ? `regnskab ${f.year}` : "—"}</div>
            </div>
          );
        },
      },
      {
        id: "nis2",
        header: "NIS2",
        cell: ({ row }) => {
          const nis2 = row.original.nis2;
          if (!nis2) return <Badge variant="muted">Ikke scopet</Badge>;
          return (
            <div className="flex flex-col items-start gap-1">
              <Nis2StatusBadge status={nis2.status} annex={nis2.annexType} />
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                {nis2.sizeExempt && <span title="Omfattet uanset størrelse">uanset størrelse</span>}
                {nis2.conflict && <span className="text-sky-600">konflikt</span>}
                {nis2.confidence !== null && <span>tillid {(nis2.confidence * 100).toFixed(0)}%</span>}
              </div>
            </div>
          );
        },
      },
      {
        id: "contacts",
        header: "Beslutningstagere",
        cell: ({ row }) => (
          <ContactAvatars contacts={row.original.contacts} total={row.original.contactCount} />
        ),
      },
      {
        id: "outreach",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant="outline">{OUTREACH_LABELS[row.original.outreach.status]}</Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(row.original.cvr);
            }}
          >
            Åbn
          </Button>
        ),
      },
    ],
    [onSelect],
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/60">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-slate-100">
                  {columns.map((_c, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-slate-500">
                  Ingen leads matcher filtrene. Kør en ny prospekteringskørsel eller løsn kriterierne.
                </td>
              </tr>
            )}

            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row.original.cvr)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50",
                    row.original.nis2?.status === "ESSENTIAL" && "bg-rose-50/30",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <span>
            Side {pagination.page} af {pagination.pages} · {pagination.total.toLocaleString("da-DK")} leads
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Forrige
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Næste <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
