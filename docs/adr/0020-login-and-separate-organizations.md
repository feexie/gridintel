# ADR 0020: Login, and organizations that never see each other's records

Date: 2026-10-21
Status: Accepted for Phase 8A. The gate answers are the Founder's
(2026-10-20 and 2026-10-21): Supabase Auth with TOTP, Supabase's free plan
for synthetic data only, nothing paid before a partner signs, the public
demonstration as its own Vercel Hobby project, `@supabase/supabase-js` and
`@supabase/ssr` as the only new dependencies, secrets in Vercel and GitHub
only. The rest is engineering, recorded here.

## Context

A pilot asks an organization for three to six months of its records.
GridIntel had one public viewer, no login, a result cache shared by the
whole server process, and screens built ahead of time for that viewer
(ADR 0012). None of that may hold real records. ADR 0014 and ADR 0018 had
already put a viewer on every spatial call and a screen grant on every
route, waiting for login.

## Decisions

1. **Two deployments from one codebase.** `GRIDINTEL_MODE` names them
   (`src/composition/mode.ts`). The public demonstration (the default):
   no login, one viewer who sees everything, synthetic records, screens
   built ahead of time, and no secret. It refuses to serve if the secret
   key is in its environment. A tenant deployment (`tenant`): every page
   asks who is signed in and is rendered on request. The build writes
   whether it was made as a tenant (`next.config.ts`, `env`), and a tenant
   deployment refuses to serve from any other build, since a page built
   ahead of time was rendered for the public viewer, frame and menu
   included. A deployment configured unsafely answers 503 to everything.
   The tenant build holds nothing rendered ahead of time but the state and
   LGA outlines, `robots.txt`, the icon and the error page (a browser test
   reads its prerender manifest).

2. **Identity behind a port.** `src/repositories/ports/identity.ts`: the
   request's session (`IdentitySession`: sign in, the second factor, an
   invitation, signing out), the organizations and memberships read with
   the signed-in person's own rights (`AccountsReader`), and written with
   the platform's (`AccountsAdmin`). Two adapters: Supabase
   (`src/repositories/supabase`, the pilot) and in memory
   (`src/repositories/memory/identity.ts`, the browser tests and a machine
   with no project; refused on Vercel). Leaving Supabase is a new adapter.

3. **Invited people only, with a second factor.** No sign-up page. An
   administrator invites; the invitation's token is used once, within a
   day; the person chooses a password of at least 12 characters and adds
   an authenticator app (TOTP). Every sign-in asks for the password and
   the code. Until the code, the session is aal1 and opens nothing: the
   proxy sends it to the code page, and row-level security answers it
   nothing.

4. **Invitations are not emailed.** Supabase's built-in email reaches only
   the members of the Supabase project's own team, two messages an hour.
   It cannot send to a partner's staff. A paid sending service was not to
   be added (Founder, 2026-10-21). So the admin API makes the invitation
   (`generateLink`) without sending it, and the People screen shows the
   link once for the administrator to pass on by their own means. The
   first administrator of each organization is invited with
   `scripts/pilot-invite.ts`.

5. **The membership is the record of truth.** `memberships` (person,
   organization, role, permission keys or none for every screen) and
   `organizations` (with the sectors whose records each holds), in
   `supabase/migrations/0001_identity.sql`. A person's grant is their keys
   cut to their organization's sectors and the platform's screens
   (`grantFor`): a key of a sector the organization does not hold is
   dropped, whatever the membership says. An administrator also holds the
   People screen.

6. **Organizations kept apart on the server, twice.**
   - The proxy (`src/proxy.ts`) makes the quick check Next's guidance asks
     for, without a database query: the session token's copy of the
     membership (`app_metadata.gridintel`, written by the server only).
     It refuses with 403 an address the grant does not open, and writes
     the address asked for into the request.
   - Every read of a sector's records passes the gate
     (`src/composition/runtime.ts`), which asks the membership itself,
     read with the person's own rights: the organization must hold the
     sector, and the grant must open the address asked for. Either "no"
     is "not found". A request whose address is not known reads nothing.
   - Beneath both, Postgres row-level security answers a person only their
     own organization's rows, and only at aal2.
   - Each sector's records, and its result cache, belong to one
     organization. An organization's map is built from its own records
     (its repositories with the states and LGAs added) and its own
     sectors' layers. The Platform Overview computes only the sectors the
     viewer holds. On a tenant deployment the utility's repositories do
     not list the mini-grid operator's sources.

7. **Links cut to the grant** (ADR 0018's acceptance items), in the read
   models (`src/services/overview/links.ts`). The "Go to" ways in, a
   line's link (the line stays; its link goes), and the Platform
   Overview's sectors, its "open the overview" link and the ways in at
   its top.

8. **The warm-up is the server's own work.** It runs for no one
   (`asSystem`) and computes each sector's screens into that sector's own
   cache. On a tenant deployment it does not warm the maps or the
   overviews, which are put together for the person who asks.

9. **Tested on a tenant build.** `npm run build:tenant` builds a tenant
   deployment into `.next-tenant` with the in-memory adapter, and
   `npm run test:e2e:tenant` tests it (`playwright.tenant.config.ts`, port
   3214, a fresh server each run). `verify`, `verify:local` and CI run
   both. The tests sign in each organization's people and check every
   screen and download of the other organization is refused and names
   nothing of it.

10. **Hosting, at no cost (Founder, 2026-10-21).** Supabase free plan,
    region Paris (`eu-west-3`). Supabase has no region in Africa; Paris is
    the closest to Lagos by distance (about 4,700 km), then Frankfurt and
    London. Vercel Hobby: the existing project stays the public
    demonstration, with no Supabase setting; a second Hobby project serves
    the tenant deployment. Two free-plan limits are accepted for
    synthetic data only:
    - a free project is paused after a week without database activity;
      `.github/workflows/keep-awake.yml` writes one row a day through a
      function only the secret key may call (a workaround, not needed on
      a paid plan);
    - the free plan has no automatic backups. A paid plan, or an
      equivalent, is a precondition of G9: no real record before it.

## Not done in 8A

- `/api/areas` stays open on a tenant deployment. It serves the state and
  LGA outlines, which are public reference geography, the same for
  everyone and built with the application. The grant has no key for an
  API route. Giving API routes their own keys belongs to the API boundary
  (8B).
- A changed grant reaches the proxy's copy when the session token is next
  refreshed (within the hour). Every data read checks the membership at
  once, so a removed person reads nothing from their next request; only
  the proxy's quick check lags.
- The audit log (8B), pilot data and its storage (8C), and any paid plan
  (G9).

## Consequences

- Nothing changes on the public demonstration: same screens, built ahead
  of time, no login. A browser test holds that it has no sign-in pages.
- Every data screen of a tenant deployment is rendered on request.
- A test or script that reads the composition root outside a request
  reads as the demonstration, unless it sets the mode.
