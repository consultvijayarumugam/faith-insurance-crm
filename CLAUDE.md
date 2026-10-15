# CLAUDE.md - Project Rules

> Rules Claude follows in every conversation.

---

## Product

Faith Insurance CRM — internal tool for an insurance agency selling
third-party policies. Agents manage their own leads through to conversion;
admins see and manage every agent's pipeline, reporting, attendance, and
data retention.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript, React 19
- **Database/Auth:** Supabase (Postgres + Supabase Auth, email/password)
- **Authorization:** Two roles, `agent` and `admin`, enforced via Postgres
  Row Level Security — never trust the UI alone for data scoping
- **UI:** Tailwind CSS
- **Forms/validation:** react-hook-form + zod
- **Bulk import:** papaparse (CSV), xlsx (Excel) — client-side parsing only.
  `xlsx` is installed from SheetJS's own CDN tarball
  (`https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`), not the npm
  registry — the registry copy has been stuck on an old, CVE-affected
  release since SheetJS stopped publishing there. Same API either way
  (`XLSX.read`, `XLSX.utils.sheet_to_json`); `npm audit` won't track future
  advisories against this dependency since it's not a registry-resolved
  semver range, so check https://cdn.sheetjs.com/ periodically instead.
- **Cron:** Vercel Cron Jobs (`vercel.json`), hitting a Next.js route handler
  protected by a shared-secret bearer header — see **Cron Jobs** below.

---

## Project Structure

```
src/
├── app/
│   ├── login/                   # public
│   ├── forgot-password/         # public — request a reset link
│   ├── reset-password/          # public — set a new password from the emailed link
│   ├── agent/                   # role: agent — layout enforces + redirects
│   │   ├── dashboard/
│   │   ├── leads/
│   │   │   ├── [id]/            # lead detail: info, custom fields, tags,
│   │   │   │                    #   follow-ups, call log, notes timeline
│   │   │   └── new/             # manual single-lead creation
│   │   ├── calendar/            # follow-up calendar
│   │   └── attendance/          # punch in/out, correction requests, own history
│   └── admin/                   # role: admin — layout enforces + redirects
│       ├── dashboard/           # org-wide stats + charts
│       ├── leads/                # all leads, reassignable
│       │   ├── [id]/
│       │   └── new/
│       ├── calendar/             # follow-up calendar, all agents
│       ├── closed-cases/         # won leads filtered by converted_at month
│       ├── statuses/             # CRUD on lead_statuses
│       ├── custom-fields/        # CRUD on lead_field_definitions
│       ├── tags/                 # tag management (delete is admin-only)
│       ├── dispositions/         # CRUD on call_dispositions
│       ├── reports/performance/  # agent call-performance report + threshold
│       ├── attendance/           # monthly report, correction queue, location setting
│       ├── agents/               # invite/list agents, admin password-reset fallback
│       ├── upload/               # bulk CSV/Excel import wizard
│       └── settings/             # data-retention controls + run log
│   └── api/
│       └── cron/retention-cleanup/   # the only route handler — see Cron Jobs
├── components/
│   ├── ui/                       # Button, Input, Card, StatCard, Select, Alert, etc.
│   ├── layout/                   # Sidebar, Topbar, MobileNav, nav-items
│   ├── auth/                     # LoginForm, ForgotPasswordForm, ResetPasswordForm
│   ├── charts/                   # HorizontalBarChart, VerticalBarChart (plain
│   │                              #   Tailwind divs — recharts is installed but
│   │                              #   unused; keep new charts consistent with this)
│   ├── leads/, agents/, statuses/, custom-fields/, tags/, dispositions/,
│   │   upload/, reports/, settings/, attendance/
├── lib/
│   ├── actions/                  # Server Actions ("use server") — all writes go here
│   │                              #   leads, agents, statuses, custom-fields, tags,
│   │                              #   follow-ups, call-logs, dispositions, settings,
│   │                              #   attendance, retention
│   ├── validations/               # zod schemas, one file per action group
│   ├── parsing/                   # client-side CSV/Excel parsing for bulk upload
│   ├── geolocation.ts             # one-shot navigator.geolocation capture for
│   │                              #   attendance punches — no background tracking
│   ├── attendance.ts              # IST work-date helpers, Google Maps link builder,
│   │                              #   low-accuracy threshold
│   ├── supabase/
│   │   ├── client.ts              # browser client (Client Components)
│   │   ├── server.ts              # server client (Server Components/Actions)
│   │   ├── admin.ts               # service-role client — server-only, bypasses RLS
│   │   └── middleware.ts          # session refresh + route guard
│   ├── format.ts, constants.ts, utils.ts
├── types/                        # database.types.ts, domain types
└── middleware.ts

supabase/
├── schema.sql                    # fresh-install schema — run once in SQL Editor
└── migrations/                   # numbered, one-time patches for a live DB — see
                                   #   Migration History below
```

`app/api/cron/retention-cleanup` is the only route handler in this app, and
exists only because a Vercel Cron job needs an HTTP endpoint with no
Supabase user session to call. Everything else that needs
`lib/supabase/admin.ts` is a Server Action. Add further route handlers only
for a similarly genuine non-Next.js-client need (webhook, scheduled job),
and keep the same "verify the caller before touching `admin.ts`" rule either
way — for a route handler with no user session, that means a shared-secret
header, checked **before** anything else runs (see `retention-cleanup`'s
`CRON_SECRET` check, including its fail-closed guard for an unset secret).

---

## Code Standards

### TypeScript
```typescript
// Interfaces required — NO `any` types
interface Lead { id: string; name: string; leadStatus: LeadStatus; }

const fetchLead = async (id: string): Promise<Lead> => { ... };
```

### Server vs. client Supabase clients
- Server Components / Server Actions / Route Handlers → `lib/supabase/server.ts`
- Client Components → `lib/supabase/client.ts`
- Admin-only operations that must bypass RLS (inviting agents, resetting an
  agent's password, bulk reassignment) → `lib/supabase/admin.ts`, imported
  **only** from Route Handlers/Server Actions that have already verified the
  caller is an admin. Never import it in a Client Component.

### Data access
- Every table has RLS enabled (see `supabase/schema.sql` and the
  migrations). Do not add a feature that relies on the client filtering
  rows the query itself could have returned unfiltered — RLS is the actual
  security boundary, not component logic.
- Lead pipeline stages are **not** a fixed enum — they're admin-managed rows
  in `lead_statuses` (`id, name, color, sort_order, is_won, is_lost`).
  `leads.status_id` references it. Never hardcode a status list in app code;
  always query `lead_statuses` (ordered by `sort_order`). `call_dispositions`
  follows the identical admin-managed-lookup-table pattern.
- `leads.converted` and `leads.converted_at` are trigger-maintained (see
  `sync_lead_converted()`), not generated columns and not directly
  app-writable in practice — set `status_id` and they follow automatically
  based on the target status's `is_won` flag. Note the trigger fires on
  INSERT too and forces `converted_at` to `now()` for a lead inserted
  directly into a won status — it cannot be backdated by a plain insert.
- `leads.next_follow_up_date` is trigger-derived (`sync_lead_next_follow_up`,
  0006) from the earliest **pending** row in `lead_follow_ups` — never
  written directly by app code. A lead with a pending follow-up always has
  this column non-null.
- `users.role`/`email`/`id`/`created_at` cannot be changed via a
  self-submitted update even though `users_self_update` RLS allows a user to
  update their own row — `protect_users_privileged_columns()` clamps those
  columns back to their previous values for non-admins. Only `name`/
  `birthday` are genuinely self-editable. The same "RLS can't compare OLD vs
  NEW columns, a trigger can" pattern is reused by
  `enforce_attendance_session_self_edit()` (0010/0011) to stop an agent
  editing their own punch-in time/location or a day other than today.
- `app_settings` (key/value jsonb) is select-all / write-admin-only, same
  split as the lookup tables above — any signed-in user can read a setting
  (e.g. an agent's own punch action needs `attendance_location.
  require_location_for_punch`), only admins can change one.
- A privileged Postgres function that must never be callable by a normal
  session — `run_retention_cleanup()` (0012) — has `EXECUTE` revoked from
  `anon`/`authenticated` and granted only to `service_role`, **and**
  independently checks `auth.role() = 'service_role'` before doing anything
  destructive. Follow both layers (grant + in-function check), not just one,
  for any future function with the same shape.

### Server Actions
- All writes (create/update/delete, invites, imports) go through a Server
  Action in `lib/actions/*.ts`, marked `"use server"` — never a direct
  client-side Supabase mutation.
- Every action re-derives the caller server-side (`createClient()` →
  `auth.getUser()` → look up `users.role`) before doing anything
  privileged; don't trust a role passed in from the client. Admin-only
  actions share a small `requireAdmin()`-style helper that returns an
  `{ error }` the caller renders directly.
- Validate input with a zod schema from `lib/validations/` before touching
  the database; return `{ error: parsed.error.issues[0]?.message }` on
  failure. For a plain `FormData` action that's
  `schema.safeParse(Object.fromEntries(formData.entries()))`; for an action
  called with a plain object argument (e.g. `punchIn(location)`,
  `reviewCorrection(id, decision)`), `schema.safeParse(arg)` directly. Keep
  zod literal unions (e.g. `call_type`) in sync with the matching Postgres
  enum/constraint. A checkbox needing a reliable `false` (not just "key
  absent") pairs the input with a same-named hidden `"false"` input and
  parses an explicit `"true"`/`"false"` string — see
  `retention-settings-form.tsx` — rather than `z.coerce.boolean()`, which
  treats the string `"false"` as truthy.
- Call `revalidatePath()` for every path that renders the data you just
  changed (both the admin and agent views, where applicable).
- Dynamic route `params`/`searchParams` are async (Next.js 15) — `await
  props.params` / `await props.searchParams`, not direct destructuring.

---

## Migrations

- `supabase/schema.sql` is for a **fresh** project only — run once in the SQL
  Editor. Do not re-run it against a project that already has data.
- Everything after that ships as a numbered, hand-applied file in
  `supabase/migrations/` (e.g. `0012_...sql`). There is no migration runner —
  each file is pasted into the Supabase SQL Editor and run manually, once,
  as a single execution.
- Each migration wraps itself in `begin; ... commit;` so it applies
  atomically, and is written to be **not idempotent** — re-running a file
  after a successful commit will error or corrupt data (the one exception:
  a migration that only does `create or replace function` is safe to
  re-run, since that statement has no data effect — note this explicitly in
  the file's header if you write one). Read the file's own header comment
  before running it; some include a post-migration read-only verification
  query to run afterward.
- When adding a new migration: write it against the *current live* schema
  (not just `schema.sql`), number it sequentially, and prefer additive,
  backfill-safe steps (add nullable → backfill → add constraint) over
  destructive ones, matching the pattern in `0002_...sql`.
- Before assuming a migration was applied to the live database, verify it —
  this project has been bitten once by a migration (0004) that was recorded
  as "confirmed applied" but actually never ran, which surfaced as a
  confusing, hard-to-diagnose failure in an unrelated later feature (the
  retention cleanup function, which reads `lead_tags`). When a table/column
  a migration should have created isn't behaving as expected, check the
  Supabase Table Editor directly rather than trusting assumptions.

### Migration history

| File | What it does |
|---|---|
| `0002_lead_statuses_and_profile_fields.sql` | `lead_statuses` CRUD support + self-serve profile field guard |
| `0003_custom_lead_fields.sql` | `lead_field_definitions` + `lead_field_values` — admin-defined custom lead fields |
| `0004_lead_tags.sql` | `tags` + `lead_tags` — shared tag list, any signed-in user can tag, admin-only delete |
| `0005_lead_duplicate_lookup.sql` | `find_lead_by_mobile()` RPC — cross-agent duplicate-mobile check for manual lead creation |
| `0006_follow_ups.sql` | `lead_follow_ups` + trigger syncing `leads.next_follow_up_date` to the earliest pending row |
| `0007_call_logs.sql` | `call_dispositions` + `call_logs` — structured call/activity log, separate from free-text `lead_notes` |
| `0008_app_settings.sql` | `app_settings` (key/value jsonb), seeded with `performance_threshold` and `retention` defaults |
| `0009_attendance.sql` | `attendance_sessions` + `attendance_corrections` — punch-clock + admin-approved correction workflow |
| `0010_fix_attendance_punch_out.sql` | Fixes the punch-out RLS policy (WITH CHECK wrongly re-required the pre-update "still open" state) + adds the self-edit trigger |
| `0011_attendance_location.sql` | Adds punch-in/punch-out lat/lng/accuracy/status columns, the `require_location_for_punch` setting, loosens `app_settings` SELECT to any signed-in user |
| `0012_retention.sql` | `retention_log` + `run_retention_cleanup()` — single-transaction batch sweep of closed/lost leads and old attendance records, service-role-only |

---

## Cron Jobs

- `app/api/cron/retention-cleanup/route.ts` is called daily by Vercel Cron
  (`vercel.json`: `"schedule": "0 3 * * *"`, 3am UTC). Vercel attaches
  `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is
  set as a project env var; the route checks it and **fails closed** (500)
  if the env var itself is unset, rather than ever comparing against the
  literal string `"Bearer undefined"`.
- The route reads `app_settings.retention` (`years`, `dry_run`) and calls
  `run_retention_cleanup()` via the service-role client — the only caller
  allowed to, per that function's grants (see **Data access** above).
- To test the route directly: `curl -H "Authorization: Bearer $CRON_SECRET"
  https://<deployment>/api/cron/retention-cleanup` should return
  `{"mode": "dry_run" | "live", "counts": {...}}`; no/wrong header should
  return 401, and an unset `CRON_SECRET` on the deployment should return
  500, never 200.
- Vercel's env var UI can silently fail to reach a deployment if the
  "Production" target checkbox isn't checked, or if the var was added after
  the last deploy — always redeploy after adding/changing it, and verify
  with the curl check above rather than assuming it's wired up.

---

## Built Features

- Email/password auth (Supabase Auth) with role-based routing
  (`agent` vs `admin`) enforced by middleware + per-section layouts, plus a
  dedicated forgot/reset-password flow (`/forgot-password`,
  `/reset-password`, both always public, enumeration-safe) and an
  admin-only "reset an agent's password" fallback on `/admin/agents` for
  when email isn't viable (service-role password reset, shown once with a
  copy button, same UI as the invite flow).
- Agent: own-leads dashboard, leads list + manual lead creation (with
  cross-agent duplicate-mobile warning), lead detail page with
  proposal/policy fields, admin-defined custom fields, tags, a follow-up
  history list + calendar, a structured call log (disposition + duration +
  source, alongside the existing free-text notes timeline), and a
  punch-clock (attendance) page with one-shot geolocation capture on each
  punch and a correction-request form.
- Admin: org-wide dashboard (totals, pipeline value, conversion-rate and
  leads-by-status charts), all-leads view with reassignment, closed-cases
  report, lead-status manager, custom-field manager, tag manager (delete
  only), call-disposition manager, agent invite/management (incl. password
  reset), bulk CSV/Excel lead-import wizard, a follow-up calendar across all
  agents, an agent call-performance report (threshold-flagged, CSV export),
  an attendance report (monthly per-agent summary, pending-correction
  approve/reject queue, map link + accuracy + low-accuracy/missing flags per
  punch, CSV export, an admin toggle for whether location is required to
  punch), and a data-retention settings page (years 1/2/3, dry-run toggle
  defaulting on, a dry-run-only "Run now" button, and a log of recent runs).
- Admin-editable lead pipeline (no hardcoded status list), trigger-maintained
  `converted`/`converted_at`/`next_follow_up_date`, and self-serve
  name/birthday profile edits with a role-escalation guard.
- Daily automated data retention (see **Cron Jobs**): closed/lost leads (and
  their cascaded notes/call logs/follow-ups/tags) and old attendance records
  past an admin-configured cutoff are cleaned up, with pending follow-ups,
  pending corrections, and any recent activity always protected from
  deletion regardless of age.

---

## Forbidden

- `any` type in TypeScript
- `console.log` left in committed code (use during local debugging only)
- Hardcoded secrets → use `.env.local` (never commit it; see `.env.local.example`)
- Plain-text passwords → Supabase Auth handles hashing; never build a
  parallel password path
- Inline styles → use Tailwind utility classes
- Importing `lib/supabase/admin.ts` from any Client Component
- Granting a privileged Postgres function `EXECUTE` to `authenticated`/`anon`
  when it should only ever run as `service_role` (see `run_retention_cleanup`)

---

## Validation

```bash
npm run lint
npm run build
```

`npm run lint` runs `next lint`, which is deprecated as of Next.js 15 and
will be removed in Next.js 16 (not yet upgraded to — see Tech Stack). It
still works today; if this project ever moves to 16, migrate with
`npx @next/codemod@canary next-lint-to-eslint-cli .` first.

---

## Environment Variables

See `.env.local.example`. Required:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

`CRON_SECRET` must also be set as a Vercel **Production** environment
variable (not just locally) for the retention cron to authenticate — see
**Cron Jobs**.
