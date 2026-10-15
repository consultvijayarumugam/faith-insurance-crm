"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import type { RowResult } from "@/lib/parsing/validate-rows";

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function PreviewStep({
  results,
  agents,
  selectedAgentId,
  onAgentChange,
  includeDuplicates,
  onIncludeDuplicatesChange,
  onImport,
  onBack,
  importing,
}: {
  results: RowResult[];
  agents: { id: string; name: string }[];
  selectedAgentId: string;
  onAgentChange: (id: string) => void;
  includeDuplicates: boolean;
  onIncludeDuplicatesChange: (value: boolean) => void;
  onImport: () => void;
  onBack: () => void;
  importing: boolean;
}) {
  const validRows = results.filter((r) => r.status === "valid");
  const invalidRows = results.filter((r) => r.status === "invalid");
  const duplicateRows = validRows.filter((r) => r.status === "valid" && r.isDuplicate);
  const cleanRows = validRows.filter((r) => r.status === "valid" && !r.isDuplicate);
  const willImportCount = cleanRows.length + (includeDuplicates ? duplicateRows.length : 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBlock label="Total rows" value={results.length} />
        <StatBlock label="Ready to import" value={cleanRows.length} />
        <StatBlock label="Duplicates" value={duplicateRows.length} />
        <StatBlock label="Invalid" value={invalidRows.length} />
      </div>

      {invalidRows.length > 0 && (
        <div className="space-y-2">
          <Alert variant="error">
            {invalidRows.length} row{invalidRows.length === 1 ? "" : "s"} will
            be skipped due to errors.
          </Alert>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {invalidRows.map((row) =>
                  row.status === "invalid" ? (
                    <tr key={row.rowNumber} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-4 py-2 text-slate-700">{row.preview}</td>
                      <td className="px-4 py-2 text-danger-600">
                        {row.errors.join("; ")}
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {duplicateRows.length > 0 && (
        <div className="space-y-2">
          <Alert variant="warning">
            {duplicateRows.length} row{duplicateRows.length === 1 ? "" : "s"}{" "}
            look like duplicates and are excluded by default.
          </Alert>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Mobile</th>
                  <th className="px-4 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {duplicateRows.map((row) =>
                  row.status === "valid" ? (
                    <tr key={row.rowNumber} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">{row.rowNumber}</td>
                      <td className="px-4 py-2 text-slate-700">{row.data.name}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {row.data.mobile_number}
                      </td>
                      <td className="px-4 py-2 text-warning-700">
                        {row.duplicateReason}
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeDuplicates}
              onChange={(e) => onIncludeDuplicatesChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Import duplicate rows anyway
          </label>
        </div>
      )}

      <div className="space-y-1.5 border-t border-slate-100 pt-5">
        <Label htmlFor="bulk-agent">Assign all imported leads to</Label>
        <Select
          id="bulk-agent"
          value={selectedAgentId}
          onChange={(e) => onAgentChange(e.target.value)}
          className="max-w-sm"
        >
          <option value="">Select an agent…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={importing}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onImport}
          disabled={importing || willImportCount === 0 || !selectedAgentId}
        >
          {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {importing ? "Importing…" : `Import ${willImportCount} lead${willImportCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
