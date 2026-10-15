"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { isBirthdayToday } from "@/lib/utils";
import { updateProfile } from "@/lib/actions/profile";
import type { Role } from "./nav-items";

export function ProfileMenu({
  id,
  name,
  email,
  role,
  birthday,
}: {
  id: string;
  name: string;
  email: string;
  role: Role;
  birthday: string | null;
}) {
  const router = useRouter();
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateProfile(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        aria-label="Open profile menu"
      >
        {initials || "?"}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-popover">
          {isBirthdayToday(birthday) && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-2 text-sm font-medium text-accent-700">
              <Cake className="h-4 w-4" />
              Happy Birthday!
            </div>
          )}

          {!editing ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">{email}</p>
              </div>
              <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-400">Role</dt>
                  <dd className="text-slate-700 capitalize">{role}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">User ID</dt>
                  <dd className="max-w-[10rem] truncate text-slate-700" title={id}>
                    {id}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-400">Birthday</dt>
                  <dd className="text-slate-700">{birthday ? formatDate(birthday) : "Not set"}</dd>
                </div>
              </dl>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit profile
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-3">
              {error && <p className="text-xs text-danger-600">{error}</p>}
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Name</Label>
                <Input id="profile-name" name="name" defaultValue={name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-birthday">Birthday</Label>
                <Input id="profile-birthday" name="birthday" type="date" defaultValue={birthday ?? ""} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
