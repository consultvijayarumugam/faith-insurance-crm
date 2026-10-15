"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Plus, Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { VEHICLE_TYPE_LABELS } from "@/lib/allowance";
import {
  deleteEntry,
  addExpense,
  removeExpense,
  uploadReceipt,
  deleteReceipt,
  linkLeads,
} from "@/lib/actions/allowance-entries";
import { EntryForm } from "@/components/allowance/entry-form";
import type { AllowanceEntry, AllowanceRate } from "@/types";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-warning-50 text-warning-700",
  approved: "bg-success-50 text-success-700",
  rejected: "bg-danger-50 text-danger-700",
};

export function EntryCard({
  entry,
  month,
  rates,
  categories,
  agentLeads,
}: {
  entry: AllowanceEntry;
  month: string;
  rates: AllowanceRate[];
  categories: string[];
  agentLeads: { id: string; name: string }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [resubmitting, setResubmitting] = React.useState(false);
  const [addingExpense, setAddingExpense] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = React.useState<Set<string>>(
    new Set((entry.leads ?? []).map((l) => l.id))
  );

  const editable = entry.status === "draft" || entry.status === "rejected";

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this entry?",
      description: `${formatDate(entry.entry_date)} — ${entry.purpose}`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setPending(true);
    const result = await deleteEntry(entry.id);
    setPending(false);
    if (result?.error) {
      toast({ title: "Couldn't delete entry", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Entry deleted", variant: "success" });
    router.refresh();
  }

  async function handleAddExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await addExpense(entry.id, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setAddingExpense(false);
    toast({ title: "Expense added", variant: "success" });
    router.refresh();
  }

  async function handleRemoveExpense(expenseId: string) {
    setPending(true);
    const result = await removeExpense(expenseId);
    setPending(false);
    if (result?.error) {
      toast({ title: "Couldn't remove expense", description: result.error, variant: "error" });
      return;
    }
    router.refresh();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    setPending(true);
    const result = await uploadReceipt(entry.id, formData);
    setPending(false);
    e.target.value = "";
    if (result?.error) {
      toast({ title: "Couldn't upload receipt", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Receipt uploaded", variant: "success" });
    router.refresh();
  }

  async function handleDeleteReceipt(receiptId: string) {
    setPending(true);
    const result = await deleteReceipt(receiptId);
    setPending(false);
    if (result?.error) {
      toast({ title: "Couldn't delete receipt", description: result.error, variant: "error" });
      return;
    }
    router.refresh();
  }

  async function handleToggleLead(leadId: string) {
    const next = new Set(selectedLeads);
    if (next.has(leadId)) next.delete(leadId);
    else next.add(leadId);
    setSelectedLeads(next);
    setPending(true);
    const result = await linkLeads(entry.id, Array.from(next));
    setPending(false);
    if (result?.error) {
      toast({ title: "Couldn't update linked leads", description: result.error, variant: "error" });
      return;
    }
    router.refresh();
  }

  const expensesTotal = (entry.expenses ?? []).reduce((sum, ex) => sum + ex.amount, 0);

  if (resubmitting) {
    return (
      <EntryForm mode="resubmit" entry={entry} month={month} rates={rates} onDone={() => setResubmitting(false)} />
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {formatDate(entry.entry_date)} · {VEHICLE_TYPE_LABELS[entry.vehicle_type]} · {entry.km} km
          </p>
          <p className="text-sm text-slate-600">{entry.purpose}</p>
          {entry.notes && <p className="mt-0.5 text-xs text-slate-400">{entry.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[entry.status]}`}>
            {entry.status}
          </span>
          <span className="text-sm font-medium text-slate-900">{formatCurrency(entry.travel_amount)}</span>
        </div>
      </div>

      {entry.status === "rejected" && entry.rejection_reason && (
        <Alert variant="error">
          <span className="font-medium">Rejected:</span> {entry.rejection_reason}
        </Alert>
      )}

      {expensesTotal > 0 && (
        <p className="text-xs text-slate-500">
          + {formatCurrency(expensesTotal)} in expenses ({(entry.expenses ?? []).length})
        </p>
      )}

      {(entry.expenses ?? []).length > 0 && (
        <ul className="space-y-1">
          {(entry.expenses ?? []).map((ex) => (
            <li key={ex.id} className="flex items-center justify-between text-sm text-slate-600">
              <span>
                {ex.category} — {formatCurrency(ex.amount)}
                {ex.note && <span className="text-slate-400"> ({ex.note})</span>}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => handleRemoveExpense(ex.id)}
                  disabled={pending}
                  className="text-slate-400 hover:text-danger-600"
                  aria-label="Remove expense"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div>
          {addingExpense ? (
            <form onSubmit={handleAddExpense} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
              {error && <Alert variant="error" className="w-full">{error}</Alert>}
              <div className="w-36 space-y-1">
                <Select name="category" required defaultValue="">
                  <option value="" disabled>
                    Category
                  </option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-28 space-y-1">
                <Input name="amount" type="number" step="0.01" min="0" placeholder="Amount" required />
              </div>
              <div className="w-36 space-y-1">
                <Input name="note" placeholder="Note (optional)" />
              </div>
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAddingExpense(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setAddingExpense(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add expense
            </Button>
          )}
        </div>
      )}

      {((entry.receipts ?? []).length > 0 || editable) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {(entry.receipts ?? []).map((r) => (
            <span
              key={r.id}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
            >
              <FileText className="h-3 w-3" />
              {r.file_name}
              {editable && (
                <button
                  type="button"
                  onClick={() => handleDeleteReceipt(r.id)}
                  disabled={pending}
                  aria-label="Delete receipt"
                >
                  <X className="h-3 w-3 text-slate-400 hover:text-danger-600" />
                </button>
              )}
            </span>
          ))}
          {editable && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50">
              <Upload className="h-3 w-3" />
              Add receipt
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleUpload}
                disabled={pending}
              />
            </label>
          )}
        </div>
      )}

      {editable && agentLeads.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-500">Leads visited (optional)</p>
          <div className="flex flex-wrap gap-3">
            {agentLeads.map((lead) => (
              <label key={lead.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedLeads.has(lead.id)}
                  onChange={() => handleToggleLead(lead.id)}
                  disabled={pending}
                />
                {lead.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {editable && (
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          {entry.status === "rejected" && (
            <Button type="button" size="sm" onClick={() => setResubmitting(true)}>
              Fix & resubmit
            </Button>
          )}
          {entry.status === "draft" && (
            <Button type="button" size="sm" variant="ghost" onClick={handleDelete} disabled={pending}>
              <Trash2 className="h-3.5 w-3.5 text-danger-600" />
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
