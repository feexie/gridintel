-- ==========================================================
-- GridIntel, Phase 8A (ADR 0020): organizations and memberships
--
-- Run once in the Supabase project's SQL editor (or `psql`). It is
-- safe to run again: every statement checks what is already there.
--
-- Row-level security is the second guard, beneath the server's own
-- checks: a person reads only their own organization's rows, and
-- only once they have passed the second factor (aal2). Nothing is
-- written with a person's own rights except the one column that
-- says they have accepted their invitation; every other write is
-- made by the server with the secret key, after it has checked
-- that the caller administers the organization.
--
-- Synthetic data only until G9 (the free plan has no backups).
-- ==========================================================

create table if not exists public.organizations (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('distribution_utility', 'minigrid_operator')),
  sectors text[] not null,
  synthetic boolean not null default true
);

create table if not exists public.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  organization_id text not null references public.organizations (id),
  role text not null check (role in ('admin', 'member')),
  -- The permission keys held (ADR 0018); null for every screen of the organization's sectors.
  screens text[],
  accepted boolean not null default false,
  invited_at timestamptz not null default now()
);

create index if not exists memberships_organization on public.memberships (organization_id);

-- The caller's organization and role, read past row-level security so that the policies below
-- do not ask the table they guard. They answer only for the caller (auth.uid()).
create or replace function public.gridintel_my_organization() returns text
  language sql stable security definer set search_path = ''
  as $$ select organization_id from public.memberships where user_id = (select auth.uid()) $$;

create or replace function public.gridintel_i_administer() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select role = 'admin' from public.memberships where user_id = (select auth.uid())), false) $$;

revoke all on function public.gridintel_my_organization() from public, anon;
revoke all on function public.gridintel_i_administer() from public, anon;
grant execute on function public.gridintel_my_organization() to authenticated;
grant execute on function public.gridintel_i_administer() to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

revoke all on public.organizations from anon, authenticated;
revoke all on public.memberships from anon, authenticated;
grant select on public.organizations to authenticated;
grant select on public.memberships to authenticated;
grant update (accepted) on public.memberships to authenticated;

drop policy if exists "own organization, after the second factor" on public.organizations;
create policy "own organization, after the second factor" on public.organizations
  for select to authenticated
  using ((select auth.jwt() ->> 'aal') = 'aal2' and id = (select public.gridintel_my_organization()));

drop policy if exists "own membership, or the organization's to its administrator" on public.memberships;
create policy "own membership, or the organization's to its administrator" on public.memberships
  for select to authenticated
  using (
    (select auth.jwt() ->> 'aal') = 'aal2'
    and organization_id = (select public.gridintel_my_organization())
    and (user_id = (select auth.uid()) or (select public.gridintel_i_administer()))
  );

-- Accepting an invitation happens before the second factor is enrolled, so it does not ask for aal2.
drop policy if exists "a person marks their own invitation accepted" on public.memberships;
create policy "a person marks their own invitation accepted" on public.memberships
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and accepted = true);

-- The two synthetic organizations of the demonstration dataset, as tenants (Phase 8A).
insert into public.organizations (id, name, kind, sectors, synthetic) values
  ('demo-disco', 'Savanna Electricity Distribution (synthetic)', 'distribution_utility', array['utility'], true),
  ('demo-minigrid-operator', 'Demonstration Mini-grid Operator (synthetic)', 'minigrid_operator', array['minigrid'], true)
on conflict (id) do nothing;

-- ==========================================================
-- Free-plan workaround: a project with no database activity for a
-- week is paused. A scheduled GitHub Actions job calls this once a
-- day with the secret key (.github/workflows/keep-awake.yml). It is
-- not needed on a paid plan, which is never paused.
-- ==========================================================

create table if not exists public.heartbeat (
  id int primary key check (id = 1),
  beat_at timestamptz not null
);
alter table public.heartbeat enable row level security;
revoke all on public.heartbeat from anon, authenticated;

create or replace function public.gridintel_heartbeat() returns timestamptz
  language sql security definer set search_path = ''
  as $$
    insert into public.heartbeat (id, beat_at) values (1, now())
    on conflict (id) do update set beat_at = excluded.beat_at
    returning beat_at
  $$;

revoke all on function public.gridintel_heartbeat() from public, anon, authenticated;
grant execute on function public.gridintel_heartbeat() to service_role;
