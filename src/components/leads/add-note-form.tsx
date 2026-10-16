"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CALL_TYPES } from "@/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { addNote } from "@/lib/actions/leads";

export function AddNoteForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await addNote(leadId, formData);

    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't add note", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Note added", variant: "success" });
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="space-y-1.5">
        <Label htmlFor="note_text">Add a note</Label>
        <Textarea
          id="note_text"
          name="note_text"
          rows={3}
          placeholder="What happened on this call?"
          required
        />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48 space-y-1.5">
          <Label htmlFor="call_type">Call type</Label>
          <Select id="call_type" name="call_type" defaultValue="">
            <option value="">None</option>
            {CALL_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
