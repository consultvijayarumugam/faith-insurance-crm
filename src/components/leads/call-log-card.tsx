"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Phone, Loader2, Trash2 } from "lucide-react";
import type { CallDisposition, CallLog } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/format";
import { createCallLog, deleteCallLog } from "@/lib/actions/call-logs";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function nowDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CallLogCard({
  leadId,
  callLogs,
  dispositions,
}: {
  leadId: string;
  callLogs: CallLog[];
  dispositions: CallDisposition[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [logging, setLogging] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dispositionById = new Map(dispositions.map((d) => [d.id, d.name]));
  const sorted = [...callLogs].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );

  async function handleLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createCallLog(leadId, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't log call", description: result.error, variant: "error" });
      return;
    }
    setLogging(false);
    toast({ title: "Call logged", variant: "success" });
    router.refresh();
  }

  async function handleDelete(callLogId: string) {
    const ok = await confirm({
      title: "Delete this call log?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await deleteCallLog(callLogId, leadId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't delete call log", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Call log deleted", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Phone className="h-4 w-4 text-slate-400" />
            Call Log
          </h3>
          {!logging && dispositions.length > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setLogging(true)}>
              Log call
            </Button>
          )}
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {dispositions.length === 0 && (
          <p className="text-sm text-slate-500">
            No call dispositions are configured yet. Set one up under Dispositions first.
          </p>
        )}

        {logging && (
          <form onSubmit={handleLog} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="disposition_id">Disposition</Label>
                <Select id="disposition_id" name="disposition_id" required defaultValue="">
                  <option value="" disabled>
                    Select…
                  </option>
                  {dispositions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="0"
                  step="0.5"
                  defaultValue={0}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="started_date">Date</Label>
                <Input id="started_date" name="started_date" type="date" defaultValue={nowDate()} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="started_time">Time</Label>
                <Input id="started_time" name="started_time" type="time" defaultValue={nowTime()} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" placeholder="Optional" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setLogging(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">No calls logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {dispositionById.get(log.disposition_id) ?? "Unknown disposition"}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {formatDuration(log.duration_seconds)}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(log.started_at)}
                    {log.source === "mobile" && (
                      <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                        Mobile
                      </span>
                    )}
                  </p>
                  {log.notes && <p className="mt-1 text-sm text-slate-600">{log.notes}</p>}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => handleDelete(log.id)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
