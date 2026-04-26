# Construction Inspection App

Web app for civil engineering site inspections. Manages project hierarchy (floors → branches → apartments), file uploads (photos, drawings), defect tracking, material inventory, and tasks/notes.

Built with Next.js 15 (App Router), Supabase, Tailwind CSS, and shadcn/ui.

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Wait for provisioning (~1 min).

### 2. Run the database migration

1. Open your project in the Supabase Dashboard.
2. Navigate to **SQL Editor** → **New query**.
3. Paste the entire contents of `supabase/migrations/001_initial.sql`.
4. Click **Run**.

### 3. Create the storage bucket

1. In the Supabase Dashboard, go to **Storage** → **New bucket**.
2. Name it `files`.
3. Set it to **Private** (not public).
4. The storage RLS policies are already included in the migration.

### 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

Find the values in your Supabase Dashboard under **Project Settings** → **API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 5. Enable magic link auth

In Supabase Dashboard → **Authentication** → **Providers** → **Email**:
- Ensure **Enable Email provider** is on.
- **Confirm email** can be left on (magic link handles it).

For local dev, set the **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to **Redirect URLs**.

### 6. Install dependencies and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import in [Vercel](https://vercel.com).
3. Add the two environment variables in **Project Settings → Environment Variables**.
4. In Supabase Dashboard → Authentication → URL Configuration, set:
   - **Site URL**: `https://your-vercel-domain.vercel.app`
   - **Redirect URLs**: `https://your-vercel-domain.vercel.app/auth/callback`

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase Postgres |
| Auth | Supabase Auth (magic link) |
| Storage | Supabase Storage |
| Hosting | Vercel |

See `DECISIONS.md` for architectural rationale and tradeoffs.
