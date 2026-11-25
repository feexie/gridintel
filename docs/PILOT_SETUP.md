# Setting up the pilot (tenant) deployment

For someone doing it for the first time. Synthetic data only: no real
record goes in before G9 (`docs/ROADMAP.md`, Phase 8). Everything here is on
free plans. Why it is built this way: ADR 0020.

There are two Vercel projects from the same repository:

| | Public demonstration | Pilot (tenant) |
| --- | --- | --- |
| Vercel project | the existing one (`gridintel-iota.vercel.app`) | `gridintel-pilot`, a Hobby project (`gridintel-pilot.vercel.app`) |
| Login | none | invited people, password and authenticator code |
| Environment variables | none of GridIntel's | the four below |

## 1. Supabase

1. Create a project named **`gridintel-pilot`** on the free plan, region
   **West EU (Ireland), eu-west-1**. Keep the database password somewhere
   safe; nothing below needs it. (The pilot's project is in eu-west-1, not
   Paris.)
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

**Add New > Project**, import the same GitHub repository, and name the
project **`gridintel-pilot`** (its address is then
`https://gridintel-pilot.vercel.app`).

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

**Environment variables** (Settings > Environment Variables). Add all four
as the **Secret** type (the value cannot be read back once saved), and tick
**Production** and **Preview** for each one:

| Name | Value |
| --- | --- |
| `GRIDINTEL_MODE` | `tenant` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` |

A Secret's value is hidden after saving, so a variable saved empty or with
a stray space is easy to miss. Its symptom is the tenant answering
**"not configured safely" (503)** on every page: see "If something fails".

Set nothing else of GridIntel's: no `GRIDINTEL_AUTH`, `GRIDINTEL_RENDER`,
`GRIDINTEL_DIST_DIR` or `GRIDINTEL_E2E_HTTP`. An environment variable takes
effect only on the next deployment. After you change one, **redeploy**.

**Production Branch: `main`** (Settings > Git > Production Branch), the
same as the demo project. Phase 8A is in `main`, so a `main` build reads
`GRIDINTEL_MODE`.

**What the tenant project has that the demo project does not:** the four
variables above. Its branch, build and install settings are the same.

## 3. Vercel: the demo project

Change nothing. Check under Settings > Environment Variables that it has
**no** `SUPABASE_*` and no `GRIDINTEL_MODE` variable. If it ever gets
`SUPABASE_SECRET_KEY`, it stops serving (503) rather than serve with a
secret.

## 4. GitHub (the daily keep-awake job)

Under Settings > Secrets and variables > Actions, add `SUPABASE_URL` and
`SUPABASE_SECRET_KEY`. A free Supabase project is paused after a week with
no database activity, and `.github/workflows/keep-awake.yml` writes one row
a day to prevent it. Run it once by hand (Actions > Keep the Supabase
project awake > Run workflow, or `gh workflow run keep-awake.yml`); its log
should show `HTTP 200` and a time. If either secret is missing the job
**fails**, and GitHub reports it: a paused project is the cost of a silent
one.

## 5. Your machine: `.env.local`

In the repository folder, create `.env.local`: the name starts with a dot
and has no extension. It is never committed (git ignores `.env*`, and, as a
guard, `env.local` and `*.local.`).

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

**On Windows**, File Explorer and Notepad make that name hard to get right:
Explorer may drop the leading dot or keep a trailing one (`env.local.`), and
Notepad adds `.txt`. Make the file from a terminal in the repository folder
instead:

```text
PowerShell:  New-Item -ItemType File -Name .env.local; notepad .env.local
Git Bash:    touch .env.local
```

In Notepad keep "Save as type: All files". Check the name with
`Get-ChildItem -Force .env*` (PowerShell) or `ls -a` (Git Bash). If it came
out wrong, rename it, e.g. `mv "env.local." .env.local` in Git Bash.

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
  serves `/dashboard`: it refuses every request if the secret key is set,
  and a redirect to `/login` means the address given is a tenant build.
  This covers its running production deployment, not its Preview settings;
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

If the link lapsed or failed before the password was set, run the same
command again: for someone already invited to that organization who has not
accepted, it makes a new link, leaves their membership as it is, and the
earlier link stops working.

## If something fails

| What you see | Usual cause |
| --- | --- |
| The tenant answers "not configured safely" (503) | A variable is missing or **empty** (a Secret saved blank is not visible afterwards), or `GRIDINTEL_MODE` was not set before the build. Set or re-enter them and redeploy |
| The tenant shows the dashboards without a login | `GRIDINTEL_MODE` is unset, or the deployment predates Phase 8A. Set it and redeploy |
| The keep-awake job fails with "is not set" | `SUPABASE_URL` or `SUPABASE_SECRET_KEY` is missing from the GitHub Actions secrets. Add it and run the job again |
| The demo answers 503 | It has `SUPABASE_SECRET_KEY`. Remove it and redeploy |
| An invitation link says it has expired | It is more than a day old or has been used. Invite again |
