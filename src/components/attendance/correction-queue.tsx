"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatDate, formatDateTime } from "@/lib/format";
import { reviewCorrection } from "@/lib/actions/attendance";
import { LocationCell } from "@/components/attendance/location-cell";
import type { AttendanceCorrection, AttendanceSession } from "@/types";

export type CorrectionSessionLocation = Pick<
  AttendanceSession,
  | "agent_id"
  | "work_date"
  | "punch_in_latitude"
  | "punch_in_longitude"
  | "punch_in_accuracy_m"
  | "punch_in_location_status"
  | "punch_out_latitude"
  | "punch_out_longitude"
  | "punch_out_accuracy_m"
  | "punch_out_location_status"
>;

export function CorrectionQueue({
  corrections,
  sessionLocations = new Map(),
}: {
  corrections: AttendanceCorrection[];
  sessionLocations?: Map<string, CorrectionSessionLocation>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleReview(id: string, decision: "approved" | "rejected") {
    setPendingId(id);
    setError(null);
    const result = await reviewCorrection(id, decision);
    setPendingId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Pending Corrections</h3>
        {error && <Alert variant="error">{error}</Alert>}
        {corrections.length === 0 ? (
          <p className="text-sm text-slate-500">No pending correction requests.</p>
        ) : (
          <ul className="space-y-2">
            {corrections.map((c) => {
              const existingSession = sessionLocations.get(`${c.agent_id}|${c.work_date}`);
              return (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {c.agent_name ?? "Unknown agent"}
                    <span className="ml-2 text-xs font-normal text-slate-400">{formatDate(c.work_date)}</span>
                  </p>
                  <p className="text-sm text-slate-600">{c.reason}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.requested_punch_in_at && `In: ${formatDateTime(c.requested_punch_in_at)}`}
                    {c.requested_punch_in_at && c.requested_punch_out_at && " · "}
                    {c.requested_punch_out_at && `Out: ${formatDateTime(c.requested_punch_out_at)}`}
                  </p>
                  {existingSession && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <LocationCell
                        label="Punch in"
                        status={existingSession.punch_in_location_status}
                        latitude={existingSession.punch_in_latitude}
                        longitude={existingSession.punch_in_longitude}
                        accuracyM={existingSession.punch_in_accuracy_m}
                      />
                      <LocationCell
                        label="Punch out"
                        status={existingSession.punch_out_location_status}
                        latitude={existingSession.punch_out_latitude}
                        longitude={existingSession.punch_out_longitude}
                        accuracyM={existingSession.punch_out_accuracy_m}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pendingId === c.id}
                    onClick={() => handleReview(c.id, "approved")}
                  >
                    {pendingId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-success-600" />
                    )}
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pendingId === c.id}
                    onClick={() => handleReview(c.id, "rejected")}
                  >
                    <X className="h-3.5 w-3.5 text-danger-500" />
                    Reject
                  </Button>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
