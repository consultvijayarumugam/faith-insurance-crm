"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, X, Loader2, Trash2, Pencil, AlertTriangle } from "lucide-react";
import type { LeadFollowUp } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import {
  scheduleFollowUp,
  rescheduleFollowUp,
  completeFollowUp,
  markFollowUpMissed,
  deleteFollowUp,
} from "@/lib/actions/follow-ups";

const STATUS_STYLES: Record<LeadFollowUp["status"], string> = {
  pending: "bg-brand-50 text-brand-700 border-brand-200",
  done: "bg-success-50 text-success-700 border-success-200",
  missed: "bg-danger-50 text-danger-700 border-danger-200",
};

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function ScheduleFields({ defaultDate, defaultTime, defaultNotes }: { defaultDate?: string; defaultTime?: string; defaultNotes?: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="scheduled_date">Date</Label>
        <Input id="scheduled_date" name="scheduled_date" type="date" defaultValue={defaultDate} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scheduled_time">Time</Label>
        <Input id="scheduled_time" name="scheduled_time" type="time" defaultValue={defaultTime ?? "09:00"} />
      </div>
      <div className="space-y-1.5 sm:col-span-1">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" defaultValue={defaultNotes} placeholder="Optional" />
      </div>
    </div>
  );
}

export function FollowUpsCard({ leadId, followUps }: { leadId: string; followUps: LeadFollowUp[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scheduling, setScheduling] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const pendingFollowUps = followUps
    .filter((f) => f.status === "pending")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const history = followUps
    .filter((f) => f.status !== "pending")
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  async function handleSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await scheduleFollowUp(leadId, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't schedule follow-up", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Follow-up scheduled", variant: "success" });
    setScheduling(false);
    router.refresh();
  }

  async function handleReschedule(e: React.FormEvent<HTMLFormElement>, followUpId: string) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await rescheduleFollowUp(followUpId, leadId, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't reschedule follow-up", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Follow-up rescheduled", variant: "success" });
    setEditingId(null);
    router.refresh();
  }

  async function handleComplete(followUpId: string) {
    setPending(true);
    setError(null);
    const result = await completeFollowUp(followUpId, leadId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't mark follow-up done", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Follow-up marked done", variant: "success" });
    router.refresh();
  }

  async function handleMissed(followUpId: string) {
    setPending(true);
    setError(null);
    const result = await markFollowUpMissed(followUpId, leadId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't mark follow-up missed", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Follow-up marked missed", variant: "success" });
    router.refresh();
  }

  async function handleDelete(followUpId: string) {
    setPending(true);
    setError(null);
    const result = await deleteFollowUp(followUpId, leadId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't delete follow-up", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Follow-up deleted", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <CalendarClock className="h-4 w-4 text-slate-400" />
            Follow-ups
          </h3>
          {!scheduling && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setScheduling(true)}>
              Schedule
            </Button>
          )}
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {scheduling && (
          <form onSubmit={handleSchedule} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <ScheduleFields />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setScheduling(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {pendingFollowUps.length === 0 && !scheduling ? (
          <p className="text-sm text-slate-500">No upcoming follow-ups.</p>
        ) : (
          <ul className="space-y-2">
            {pendingFollowUps.map((f) => {
              const isOverdue = new Date(f.scheduled_at) < new Date();
              if (editingId === f.id) {
                const { date, time } = splitDateTime(f.scheduled_at);
                return (
                  <li key={f.id} className="rounded-lg border border-slate-200 p-4">
                    <form onSubmit={(e) => handleReschedule(e, f.id)} className="space-y-3">
                      <ScheduleFields defaultDate={date} defaultTime={time} defaultNotes={f.notes ?? ""} />
                      <div className="flex items-center gap-2">
                        <Button type="submit" size="sm" disabled={pending}>
                          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Save
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </li>
                );
              }
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {formatDateTime(f.scheduled_at)}
                      {isOverdue && (
                        <span className="flex items-center gap-1 text-xs font-medium text-warning-600">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </span>
                      )}
                    </p>
                    {f.notes && <p className="mt-0.5 text-sm text-slate-500">{f.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => handleComplete(f.id)}
                      title="Mark done"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => handleMissed(f.id)}
                      title="Mark missed"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setEditingId(f.id)}
                      title="Reschedule"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => handleDelete(f.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger-500" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {history.length > 0 && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">History</h4>
            <ul className="space-y-1.5">
              {history.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[f.status]}`}>
                    {f.status}
                  </span>
                  <span className="text-slate-600">{formatDateTime(f.scheduled_at)}</span>
                  {f.notes && <span className="text-slate-400">— {f.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
