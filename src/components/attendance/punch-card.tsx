"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, LogIn, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { punchIn, punchOut } from "@/lib/actions/attendance";
import { captureLocation } from "@/lib/geolocation";

function locationNoticeFor(status: "denied" | "unavailable"): string {
  return status === "denied"
    ? "Location permission was denied — your punch was recorded without a location."
    : "Location wasn't available — your punch was recorded without a location.";
}

export function PunchCard({
  punchInAt,
  punchOutAt,
}: {
  punchInAt: string | null;
  punchOutAt: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [locationNotice, setLocationNotice] = React.useState<string | null>(null);

  async function handlePunchIn() {
    setPending(true);
    setError(null);
    setLocationNotice(null);
    const location = await captureLocation();
    const result = await punchIn(location);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't punch in", description: result.error, variant: "error" });
      return;
    }
    if (!result.locationCaptured && location.status !== "captured") {
      setLocationNotice(locationNoticeFor(location.status));
    }
    toast({ title: "Punched in", variant: "success" });
    router.refresh();
  }

  async function handlePunchOut() {
    setPending(true);
    setError(null);
    setLocationNotice(null);
    const location = await captureLocation();
    const result = await punchOut(location);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't punch out", description: result.error, variant: "error" });
      return;
    }
    if (!result.locationCaptured && location.status !== "captured") {
      setLocationNotice(locationNoticeFor(location.status));
    }
    toast({ title: "Punched out", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Clock className="h-4 w-4 text-slate-400" />
          Today
        </h3>

        {error && <Alert variant="error">{error}</Alert>}
        {locationNotice && <Alert variant="warning">{locationNotice}</Alert>}

        {!punchInAt ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">You haven&apos;t punched in today.</p>
            <Button type="button" className="min-h-11" onClick={handlePunchIn} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
              Punch In
            </Button>
          </div>
        ) : !punchOutAt ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              Punched in at <span className="font-medium">{formatDateTime(punchInAt)}</span>
            </p>
            <Button type="button" className="min-h-11" variant="secondary" onClick={handlePunchOut} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Punch Out
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            Punched in at <span className="font-medium">{formatDateTime(punchInAt)}</span>, out at{" "}
            <span className="font-medium">{formatDateTime(punchOutAt)}</span>. Done for today.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
