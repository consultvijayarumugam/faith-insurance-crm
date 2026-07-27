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
│   ├── login/                # public
│   ├── agent/                # role: agent — layout enforces + redirects
│   │   ├── dashboard/
│   │   └── leads/
│   ├── admin/                 # role: admin — layout enforces + redirects
│   │   ├── dashboard/
│   │   ├── leads/
│   │   ├── agents/            # agent invite/management
│   │   └── upload/            # bulk CSV/Excel import
│   └── api/                   # route handlers needing the service role key
├── components/
│   ├── ui/                    # Button, Input, Card, StatCard, etc.
│   ├── layout/                # Sidebar, Topbar, MobileNav
│   ├── auth/                  # LoginForm, SignOutButton
│   ├── leads/
│   └── admin/
├── lib/
│   └── supabase/
│       ├── client.ts          # browser client (Client Components)
│       ├── server.ts          # server client (Server Components/Actions)
│       ├── admin.ts           # service-role client — server-only, bypasses RLS
│       └── middleware.ts      # session refresh + route guard
├── types/                     # database.types.ts, domain types
└── middleware.ts

supabase/
└── schema.sql                 # run in Supabase SQL Editor — tables, enums, RLS
```

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
- `quote_shared` and `converted` on `leads` are Postgres generated columns
  derived from `lead_status`. Never write to them directly — set
  `lead_status` and they follow automatically.

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
