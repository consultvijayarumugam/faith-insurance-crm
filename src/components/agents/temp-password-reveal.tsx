"use client";

import * as React from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { TempPasswordResult } from "@/types";

export function TempPasswordReveal({
  result,
  heading,
  onDone,
}: {
  result: TempPasswordResult;
  heading: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(
      `Email: ${result.email}\nTemporary password: ${result.tempPassword}`
    );
    setCopied(true);
  }

  return (
    <div className="space-y-4">
      <Alert variant="success">{heading}</Alert>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <p>
          <span className="text-slate-500">Email: </span>
          <span className="font-medium text-slate-900">{result.email}</span>
        </p>
        <p>
          <span className="text-slate-500">Temporary password: </span>
          <span className="font-mono font-medium text-slate-900">{result.tempPassword}</span>
        </p>
      </div>

      <Alert variant="warning">
        This password won&apos;t be shown again. Share it with {result.name} securely —
        they can sign in with it right away.
      </Alert>

      <div className="flex gap-2">
        <Button type="button" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy credentials"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
