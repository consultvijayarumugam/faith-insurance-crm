# Faith Insurance CRM

Internal CRM for an insurance agency selling third-party policies. Agents
manage their own leads; admins see and manage every agent's pipeline.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth, with Row Level Security enforcing agent/admin data access).

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Once it's provisioned, go to **Project Settings > API** and copy:
   - Project URL
   - `anon` `public` key
   - `service_role` key (keep this one secret — server-only)

## 2. Run the database schema

1. Open **SQL Editor** in your Supabase project.
2. Paste the contents of `supabase/schema.sql` and run it.
   This creates the `users`, `leads`, and `lead_notes` tables, the
   `lead_status`/`call_type`/`user_role` enums, all Row Level Security
   policies, and the trigger that auto-provisions a `public.users` profile
   whenever a new auth user is created.

## 3. Create your first admin user

1. In Supabase: **Authentication > Users > Add user**, create yourself with
   an email + password.
2. Back in the **SQL Editor**, promote yourself to admin:
   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```
3. From then on, new agents can be created from the in-app **Agents** admin
   screen — no need to touch Supabase directly again.

## 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the three values from step 1.

## 5. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll land on `/login`. Sign in with the
admin account from step 3.

## 6. Deploy to Vercel

1. Push this repo to GitHub (skip if already done).
2. Go to [vercel.com](https://vercel.com) → **Add New… > Project** → import
   the GitHub repo. Vercel auto-detects Next.js — leave build settings as
   default (`npm run build`).
3. Before the first deploy, add the same three variables from step 4 under
   **Project Settings > Environment Variables**, applied to Production,
   Preview, and Development:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```
4. Deploy. Vercel gives you a `https://<project>.vercel.app` URL (or attach
   a custom domain under Project Settings > Domains).
5. In Supabase, go to **Authentication > URL Configuration** and set **Site
   URL** to that production URL. The app only uses email/password sign-in
   today so this isn't load-bearing yet, but it's what Supabase uses for
   password-reset emails and any OAuth provider you add later — worth
   setting correctly now rather than debugging a redirect later.

Every push to `main` redeploys automatically once the GitHub integration is
connected; pushes to other branches get their own preview URL.

---

## Project structure

```
src/
├── app/
│   ├── login/            # public sign-in page
│   ├── agent/             # agent-only routes (own leads)
│   ├── admin/             # admin-only routes (all leads, agents, upload)
│   └── api/                # route handlers using the service-role key
├── components/
│   ├── ui/                 # design system primitives
│   ├── layout/              # Sidebar, Topbar, MobileNav
│   └── auth/                # LoginForm, SignOutButton
├── lib/supabase/            # client/server/admin/middleware helpers
└── types/                   # database + domain types

supabase/
└── schema.sql               # tables, enums, RLS policies, triggers
```

## Security model

Role-based access is enforced in two layers:

1. **Postgres Row Level Security** (`supabase/schema.sql`) — the real
   boundary. An agent's queries are scoped to their own leads at the
   database level regardless of what the UI sends.
2. **Next.js middleware** (`src/middleware.ts`) — a UX layer that redirects
   unauthenticated users to `/login` and keeps agents/admins in their own
   section of the app.

## Known tradeoff

Pinned to Next.js 14.2.35 (the latest stable 14.x release) per the project
spec. Several `next`/`postcss` advisories are fixed only in Next 15/16;
upgrading is a deliberate future decision, not an oversight.
