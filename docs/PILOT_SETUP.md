# Setting up the pilot (tenant) deployment

For someone doing it for the first time. Synthetic data only: no real
record goes in before G9 (`docs/ROADMAP.md`, Phase 8). Everything here is on
free plans. Why it is built this way: ADR 0020.

There are two Vercel projects from the same repository:

| | Public demonstration | Pilot (tenant) |
| --- | --- | --- |
| Vercel project | the existing one | a new Hobby project |
| Login | none | invited people, password and authenticator code |
| Environment variables | none of GridIntel's | the four below |

## 1. Supabase

1. Create a project on the free plan, region **Paris (eu-west-3)**. Keep
   the database password somewhere safe; nothing below needs it.
2. **SQL Editor**: paste the whole of `supabase/migrations/0001_identity.sql`
   and run it. It is safe to run again.
3. **Authentication > Sign In / Providers**: turn **off** "Allow new users
   to sign up". Leave the Email provider on (sign-in uses it). Invitations
   made by GridIntel still work: they use the admin API, which this switch
   does not block.
4. **Authentication > Multi-Factor**: check that **TOTP** (authenticator
   app) is enabled. It is on by default.
5. **Project Settings > API Keys**: copy the **publishable** key
   (`sb_publishable_...`) and the **secret** key (`sb_secret_...`). The
   project URL is `https://<project-ref>.supabase.co`.

## 2. Vercel: the tenant project

**Add New > Project**, and import the same GitHub repository.

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js (detected) |
| Root Directory | the repository root (leave empty) |
| Build Command | **leave the default** (`npm run build`) |
| Install Command | leave the default (`npm install`) |
| Output Directory | leave the default (Next.js) |
| Node.js Version | 22.x or later (Settings > Build and Deployment) |

**The Build Command.** The default `npm run build` is right. With
`GRIDINTEL_MODE=tenant` set in the project, the build reads it, renders no
page ahead of time, and records in the build that it was made as a tenant.
Do **not** use `npm run build:tenant`: that is for the browser tests. It
switches to the in-memory test accounts, which refuse to run on Vercel,
and builds into a folder Vercel does not look in.

**Environment variables** (Settings > Environment Variables). Tick
**Production** and **Preview** for each one:

| Name | Value |
| --- | --- |
| `GRIDINTEL_MODE` | `tenant` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (mark it **Sensitive**) |

Set nothing else of GridIntel's: no `GRIDINTEL_AUTH`, `GRIDINTEL_RENDER`,
`GRIDINTEL_DIST_DIR` or `GRIDINTEL_E2E_HTTP`. An environment variable takes
effect only on the next deployment. After you change one, **redeploy**.

**Production Branch, until Phase 8A is merged.** The tenant code is only on
the `phase-8a` branch for now. In the tenant project, under **Settings > Git
> Production Branch**, enter `phase-8a`. Set it back to `main` after the
merge. (A `main` build without Phase 8A would ignore `GRIDINTEL_MODE` and
publish the plain public demonstration at the pilot's address.)

**What the tenant project has that the demo project does not:** the four
variables above, and, for now, the production branch. Its build and install
settings are the same.

## 3. Vercel: the demo project

Change nothing. Check under Settings > Environment Variables that it has
**no** `SUPABASE_*` and no `GRIDINTEL_MODE` variable. If it ever gets
`SUPABASE_SECRET_KEY`, it stops serving (503) rather than serve with a
secret.

## 4. GitHub (the daily keep-awake job)

Under Settings > Secrets and variables > Actions, add `SUPABASE_URL` and
`SUPABASE_SECRET_KEY`. A free Supabase project is paused after a week with
no database activity, and `.github/workflows/keep-awake.yml` writes one row
a day to prevent it. GitHub runs scheduled jobs only from `main`, so the job
starts after the merge. Until then, signing in counts as activity.

## 5. Your machine: `.env.local`

In the repository folder, create `.env.local`. It is never committed (git
ignores `.env*`).

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

## 6. Check the setup

```text
node --env-file=.env.local scripts/pilot-check.ts <demo-address> <tenant-address>
```

It only reads. It prints PASS, FAIL or NOT CHECKED for each item:

- the three tables are present, with row-level security on and their
  policies in place;
- the two organizations are present;
- someone who is not signed in reads nothing;
- sign-up is off;
- the demonstration holds no secret. The demo project's settings cannot be
  read from your machine. Instead the script checks that the demonstration
  serves: it refuses every request if the secret key is set. This covers
  its running production deployment, not its Preview settings;
- the tenant asks for sign-in, which shows it was built as a tenant.

## 7. The first administrator

```text
node --env-file=.env.local scripts/pilot-invite.ts <your-email> demo-disco <tenant-address>
```

It prints a link and sends no email. The link works once and expires in a
day. Open it, choose a password of at least 12 characters, and add the code
to an authenticator app. After that, invite people from **People** in the
account menu. For the mini-grid operator, run it again with
`demo-minigrid-operator`.

## If something fails

| What you see | Usual cause |
| --- | --- |
| The tenant answers "not configured safely" (503) | `GRIDINTEL_MODE` was not set before the build, or a Supabase variable is missing. Set them and redeploy |
| The tenant shows the dashboards without a login | The deployment was built from `main` before the merge, or `GRIDINTEL_MODE` is unset |
| The demo answers 503 | It has `SUPABASE_SECRET_KEY`. Remove it and redeploy |
| An invitation link says it has expired | It is more than a day old or has been used. Invite again |
