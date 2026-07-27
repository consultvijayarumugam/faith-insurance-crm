"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { BulkImportResult } from "@/lib/actions/leads";

export function ResultStep({
  result,
  onReset,
}: {
  result: BulkImportResult;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <Alert variant={result.insertedCount > 0 ? "success" : "warning"}>
        {result.insertedCount} lead{result.insertedCount === 1 ? "" : "s"}{" "}
        imported successfully.
      </Alert>

      {result.failed.length > 0 && (
        <div className="space-y-2">
          <Alert variant="error">
            {result.failed.length} row{result.failed.length === 1 ? "" : "s"}{" "}
            failed to import.
          </Alert>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2">Row</th>
                  <th className="px-4 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {result.failed.map((f) => (
                  <tr key={f.rowNumber} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-500">{f.rowNumber}</td>
                    <td className="px-4 py-2 text-rose-600">{f.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-slate-100 pt-5">
        <Button type="button" variant="secondary" onClick={onReset}>
          Upload another file
        </Button>
        <Link href="/admin/leads" className={buttonVariants({ variant: "ghost" })}>
          View all leads
        </Link>
      </div>
    </div>
  );
}
