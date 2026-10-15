"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "destructive" | "primary";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  function handle(ok: boolean) {
    state?.resolve(ok);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-fade-in motion-reduce:animate-none"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={() => handle(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={
                  state.variant === "destructive"
                    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600"
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                }
              >
                <AlertTriangle className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-dialog-title" className="text-sm font-semibold text-slate-900">
                  {state.title}
                </h2>
                {state.description && (
                  <p className="mt-1 text-sm text-slate-500">{state.description}</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => handle(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={state.variant === "destructive" ? "destructive" : "primary"}
                size="sm"
                onClick={() => handle(true)}
                autoFocus
              >
                {state.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx.confirm;
}
