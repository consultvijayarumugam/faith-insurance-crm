# CLAUDE.md - Project Rules

> Rules Claude follows in every conversation.

---

## Product

Faith Insurance CRM — internal tool for an insurance agency selling
third-party policies. Agents manage their own leads through to conversion;
admins see and manage every agent's pipeline.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Database/Auth:** Supabase (Postgres + Supabase Auth, email/password)
- **Authorization:** Two roles, `agent` and `admin`, enforced via Postgres
  Row Level Security — never trust the UI alone for data scoping
- **UI:** Tailwind CSS
- **Forms/validation:** react-hook-form + zod
- **Bulk import:** papaparse (CSV), xlsx (Excel) — client-side parsing only

---

## Project Structure

```
src/
├── app/
│   ├── login/                 # public
│   ├── agent/                 # role: agent — layout enforces + redirects
│   │   ├── dashboard/
│   │   └── leads/
│   │       └── [id]/          # lead detail: info card, status/proposal, notes
│   └── admin/                  # role: admin — layout enforces + redirects
│       ├── dashboard/          # org-wide stats + charts
│       ├── leads/               # all leads, reassignable
│       ├── closed-cases/        # won leads filtered by converted_at month
│       ├── statuses/            # CRUD on lead_statuses
│       ├── agents/              # invite/list agents (uses admin.ts)
│       └── upload/              # bulk CSV/Excel import wizard
├── components/
│   ├── ui/                    # Button, Input, Card, StatCard, etc.
│   ├── layout/                 # Sidebar, Topbar, MobileNav, nav-items
│   ├── auth/                   # LoginForm, SignOutButton
│   ├── leads/, agents/, statuses/, upload/, charts/
├── lib/
│   ├── actions/                # Server Actions ("use server") — all writes go here
│   ├── validations/             # zod schemas, one file per action group
│   ├── parsing/                 # client-side CSV/Excel parsing for bulk upload
│   ├── supabase/
│   │   ├── client.ts            # browser client (Client Components)
│   │   ├── server.ts            # server client (Server Components/Actions)
│   │   ├── admin.ts             # service-role client — server-only, bypasses RLS
│   │   └── middleware.ts        # session refresh + route guard
│   ├── format.ts, constants.ts, utils.ts
├── types/                      # database.types.ts, domain types
└── middleware.ts

supabase/
├── schema.sql                 # fresh-install schema — run once in SQL Editor
└── migrations/                 # numbered, one-time patches for a live DB
```

There is currently no `app/api/` — the only operation needing the service-role
key (inviting agents) is a Server Action, not a route handler. Add route
handlers under `app/api/` only if a future feature genuinely needs an
HTTP endpoint (webhook, non-Next.js client); keep the same
"verify admin before touching `admin.ts`" rule either way.

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
- Admin-only operations that must bypass RLS (inviting agents, bulk
  reassignment) → `lib/supabase/admin.ts`, imported **only** from Route
  Handlers/Server Actions that have already verified the caller is an admin.
  Never import it in a Client Component.

### Data access
- Every table has RLS enabled (see `supabase/schema.sql`). Do not add a
  feature that relies on the client filtering rows the query itself could
  have returned unfiltered — RLS is the actual security boundary, not
  component logic.
- Lead pipeline stages are **not** a fixed enum — they're admin-managed rows
  in `lead_statuses` (`id, name, color, sort_order, is_won, is_lost`).
  `leads.status_id` references it. Never hardcode a status list in app code;
  always query `lead_statuses` (ordered by `sort_order`).
- `leads.converted` and `leads.converted_at` are trigger-maintained (see
  `sync_lead_converted()`), not generated columns and not directly
  app-writable in practice — set `status_id` and they follow automatically
  based on the target status's `is_won` flag. `quote_shared` no longer
  exists.
- `users.role`/`email`/`id`/`created_at` cannot be changed via a
  self-submitted update even though `users_self_update` RLS allows a user to
  update their own row — `protect_users_privileged_columns()` clamps those
  columns back to their previous values for non-admins. Only `name`/
  `birthday` are genuinely self-editable.

### Server Actions
- All writes (create/update/delete, invites, imports) go through a Server
  Action in `lib/actions/*.ts`, marked `"use server"` — never a direct
  client-side Supabase mutation.
- Every action re-derives the caller server-side (`createClient()` →
  `auth.getUser()` → look up `users.role`) before doing anything
  privileged; don't trust a role passed in from the client. Admin-only
  actions share a small `requireAdmin()`-style helper that returns an
  `{ error }` the caller renders directly.
- Validate `FormData` with a zod schema from `lib/validations/` via
  `schema.safeParse(Object.fromEntries(formData.entries()))` before
  touching the database; return `{ error: parsed.error.issues[0]?.message }`
  on failure. Keep zod literal unions (e.g. `call_type`) in sync with the
  matching Postgres enum/constraint.
- Call `revalidatePath()` for every path that renders the data you just
  changed (both the admin and agent views of leads, where applicable).

---

## Migrations

- `supabase/schema.sql` is for a **fresh** project only — run once in the SQL
  Editor. Do not re-run it against a project that already has data.
- Everything after that ships as a numbered, hand-applied file in
  `supabase/migrations/` (e.g. `0002_...sql`). There is no migration runner —
  each file is pasted into the Supabase SQL Editor and run manually, once,
  as a single execution.
- Each migration wraps itself in `begin; ... commit;` so it applies
  atomically, and is written to be **not idempotent** — re-running a file
  after a successful commit will error or corrupt data. Read the file's own
  header comment before running it; some include a post-migration
  read-only verification query to run afterward.
- When adding a new migration: write it against the *current live* schema
  (not just `schema.sql`), number it sequentially, and prefer additive,
  backfill-safe steps (add nullable → backfill → add constraint) over
  destructive ones, matching the pattern in `0002_...sql`.

---

## Built Features

- Email/password auth (Supabase Auth) with role-based routing
  (`agent` vs `admin`) enforced by middleware + per-section layouts.
- Agent: own-leads dashboard, leads list, lead detail page with proposal/
  policy/follow-up fields and a call-notes timeline.
- Admin: org-wide dashboard (totals, pipeline value, conversion-rate-by-agent
  and leads-by-status charts), all-leads view with reassignment, closed-cases
  report (won leads by month closed + total value), lead-status manager
  (add/rename/recolor/reorder/delete pipeline stages, with `is_won`/`is_lost`
  flags), agent invite/management, and a bulk CSV/Excel lead-import wizard
  (file → column mapping → preview → result).
- Admin-editable lead pipeline (no hardcoded status list), trigger-maintained
  `converted`/`converted_at`, and self-serve name/birthday profile edits with
  a role-escalation guard.

---

## Forbidden

- `any` type in TypeScript
- `console.log` left in committed code (use during local debugging only)
- Hardcoded secrets → use `.env.local` (never commit it; see `.env.local.example`)
- Plain-text passwords → Supabase Auth handles hashing; never build a
  parallel password path
- Inline styles → use Tailwind utility classes
- Importing `lib/supabase/admin.ts` from any Client Component

---

## Validation

```bash
npm run lint
npm run build
```

---

## Environment Variables

See `.env.local.example`. Required:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
