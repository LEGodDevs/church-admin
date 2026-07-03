"use client";
import { ReactNode } from "react";
import { EmptyState } from "./States";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
}

export function DataTable<T>({
  columns,
  rows,
  keyField,
  onRowClick,
  emptyTitle = "Nothing here yet",
  emptyIcon = "📭",
}: {
  columns: Column<T>[];
  rows: T[];
  keyField: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyIcon?: string;
}) {
  if (rows.length === 0) return <EmptyState icon={emptyIcon} title={emptyTitle} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`py-3 px-3 font-semibold text-xs uppercase tracking-wide text-slate-400 ${
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                }`}
                style={{ width: c.width }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyField(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-slate-100 last:border-0 ${
                onRowClick ? "cursor-pointer hover:bg-slate-50" : ""
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`py-3 px-3 text-slate-700 ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                  }`}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
