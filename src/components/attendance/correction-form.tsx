"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { requestCorrection } from "@/lib/actions/attendance";

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function CorrectionForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSubmitted(false);
    const result = await requestCorrection(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Request a Correction</h3>
          <p className="mt-1 text-sm text-slate-500">
            Missed a punch, or got a time wrong? Ask an admin to fix a day.
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {submitted && !error && (
          <p className="text-sm text-emerald-600">Request submitted. An admin will review it.</p>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="work_date">Date</Label>
              <Input id="work_date" name="work_date" type="date" defaultValue={todayIST()} max={todayIST()} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requested_punch_in_time">Corrected punch in</Label>
              <Input id="requested_punch_in_time" name="requested_punch_in_time" type="time" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requested_punch_out_time">Corrected punch out</Label>
              <Input id="requested_punch_out_time" name="requested_punch_out_time" type="time" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" name="reason" placeholder="e.g. Forgot to punch out before leaving" required />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
