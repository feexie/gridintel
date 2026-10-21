import { cookies } from "next/headers";
import { cache } from "react";
import type { AccountsAdmin, AccountsReader, CookieJar, IdentitySession, Membership, MemberRole, SessionUser, TenantOrganization } from "../repositories/ports/index.ts";
import type { ViewerContext } from "../services/spatial/viewer.ts";
import { canOpen, grantFor, homeFor, navigationFor } from "../constants/access.ts";
import { createMemoryIdentityStore, memoryAccountsAdmin, memoryAccountsReader, memoryIdentitySession, seedMemoryIdentity, type MemoryIdentityStore } from "../repositories/memory/identity.ts";
import { supabaseAccountsAdmin, supabaseIdentitySession, type SupabaseSettings } from "../repositories/supabase/identity.ts";
import { TENANT_ORGANIZATIONS, TEST_PEOPLE } from "./identityFixture.ts";
import { deploymentMode } from "./mode.ts";

/* ==========================================================
   COMPOSITION — WHO IS SIGNED IN (Phase 8A, ADR 0020)

   Chooses the identity adapter (Supabase, or in memory for the
   browser tests: GRIDINTEL_AUTH=memory) and answers, for one
   request, who is signed in and what they may open.

   The viewer of a tenant deployment is built from records, not
   from the session token: the person as Supabase verified them,
   their membership and their organization read with their own
   rights (row-level security), at aal2 only. Anyone else is the
   viewer who may open nothing. It is computed once per request
   (React's `cache`).

   Nothing here is reached by the public demonstration: its viewer
   is a constant (viewer.ts), and no Supabase client is created.
========================================================== */

/** Who may open nothing: no one signed in, a person without the second factor, or without a membership. */
export const NO_ONE: ViewerContext = { viewerId: "no-one", organizationId: null, access: { kind: "territory", parts: [] }, screens: { kind: "listed", keys: [] } };

interface Backend {
  session(cookies: CookieJar): IdentitySession;
  reader(cookies: CookieJar, user: SessionUser): AccountsReader;
  admin(): AccountsAdmin;
}

const processState = globalThis as typeof globalThis & { __gridintelIdentity?: MemoryIdentityStore };

/** The in-memory store, seeded once per process with the two organizations and the test people. */
function memoryStore(): MemoryIdentityStore {
  if (processState.__gridintelIdentity === undefined) {
    const store = createMemoryIdentityStore();
    seedMemoryIdentity(store, TENANT_ORGANIZATIONS, Object.values(TEST_PEOPLE));
    processState.__gridintelIdentity = store;
  }
  return processState.__gridintelIdentity;
}

function supabaseSettings(): SupabaseSettings {
  return { url: process.env.SUPABASE_URL ?? "", publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "", secretKey: process.env.SUPABASE_SECRET_KEY };
}

function backend(): Backend {
  if (deploymentMode() !== "tenant") throw new Error("The public demonstration has no accounts.");
  if (process.env.GRIDINTEL_AUTH === "memory") {
    if (process.env.VERCEL) throw new Error("The in-memory identity adapter must not run on Vercel.");
    return {
      session: (jar) => memoryIdentitySession(memoryStore(), jar),
      reader: (_jar, user) => memoryAccountsReader(memoryStore(), user),
      admin: () => memoryAccountsAdmin(memoryStore()),
    };
  }
  return {
    session: (jar) => supabaseIdentitySession(supabaseSettings(), jar),
    reader: (jar, user) => supabaseIdentitySession(supabaseSettings(), jar).reader(user),
    admin: () => supabaseAccountsAdmin(supabaseSettings()),
  };
}

/** The cookies of the request being answered. A page cannot write them; there the proxy refreshes the session. */
async function requestCookies(): Promise<CookieJar> {
  const store = await cookies();
  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      try {
        for (const cookie of list) store.set(cookie.name, cookie.value, cookie.options);
      } catch {
        // A Server Component cannot set cookies; the proxy has refreshed the session already.
      }
    },
  };
}

/** The identity session of the request being answered: for the sign-in pages and their actions. */
export async function requestSession(): Promise<IdentitySession> {
  return backend().session(await requestCookies());
}

/** A session over cookies the caller holds: the proxy's, which reads the request's and writes the response's. */
export function sessionOver(jar: CookieJar): IdentitySession {
  return backend().session(jar);
}

export interface SignedIn {
  user: SessionUser;
  membership: Membership;
  organization: TenantOrganization;
  reader: AccountsReader;
}

/** The person signed in at aal2, with their membership and organization as their own rights read them; null otherwise. */
export const signedIn = cache(async (): Promise<SignedIn | null> => {
  const jar = await requestCookies();
  const source = backend();
  const user = await source.session(jar).user();
  if (user === null || user.assurance !== "aal2") return null;
  const reader = source.reader(jar, user);
  const membership = await reader.membership(user.userId);
  if (membership === null) return null;
  const organization = await reader.organization(membership.organizationId);
  if (organization === null) return null;
  return { user, membership, organization, reader };
});

/** The viewer of the request being answered, from records; NO_ONE for anyone who may open nothing. */
export const tenantViewer = cache(async (): Promise<ViewerContext> => {
  const who = await signedIn();
  if (who === null) return NO_ONE;
  return {
    viewerId: who.user.userId,
    organizationId: who.organization.id,
    // Within its own records an organization sees all of them; the records of another are not reachable at all.
    access: { kind: "everything" },
    screens: grantFor(who.organization.sectors, who.membership.screens, who.membership.role === "admin"),
  };
});

/** True on a tenant deployment, where people sign in; the sign-in pages do not exist on the demonstration. */
export function accountsEnabled(): boolean {
  return deploymentMode() === "tenant";
}

/** Where a person signed in at aal2 starts: the page they asked for if it is open to them, else their first screen; null if they may open none. */
export async function startingPoint(next: string | null): Promise<string | null> {
  const viewer = await tenantViewer();
  if (viewer === NO_ONE) return null;
  if (next !== null && canOpen(viewer.screens, next)) return next;
  return homeFor(navigationFor(viewer.screens));
}

/* ---------------- An administrator's actions ----------------

   Each is checked here, on the server, before anything is written: the caller is signed in at
   aal2 and administers the organization, and the person acted on is a member of that same
   organization, as the caller's own rights read it. Only then is the admin adapter, with the
   platform's rights, asked to write. */

async function administrator(): Promise<SignedIn> {
  const who = await signedIn();
  if (who === null || who.membership.role !== "admin") throw new Error("Only an administrator of the organization may do this.");
  return who;
}

async function memberOfMine(who: SignedIn, userId: string): Promise<Membership> {
  const member = (await who.reader.members(who.organization.id)).find((one) => one.userId === userId);
  if (member === undefined) throw new Error("No such member of your organization.");
  return member;
}

export const people = {
  /** The organization's members, as its administrator reads them. */
  async list(): Promise<{ organization: TenantOrganization; members: Membership[]; me: string }> {
    const who = await administrator();
    return { organization: who.organization, members: await who.reader.members(who.organization.id), me: who.user.userId };
  },
  /** Makes an invitation and returns its token; the link is made by the caller from the request's origin. */
  async invite(email: string, role: MemberRole, screens: readonly string[] | null): Promise<{ tokenHash: string }> {
    const who = await administrator();
    const { tokenHash } = await backend().admin().invite({ email, organizationId: who.organization.id, role, screens });
    return { tokenHash };
  },
  async setGrant(userId: string, role: MemberRole, screens: readonly string[] | null): Promise<void> {
    const who = await administrator();
    await memberOfMine(who, userId);
    if (userId === who.user.userId && role !== "admin") throw new Error("You cannot remove your own administration.");
    await backend().admin().setGrant(userId, who.organization.id, role, screens);
  },
  async remove(userId: string): Promise<void> {
    const who = await administrator();
    await memberOfMine(who, userId);
    if (userId === who.user.userId) throw new Error("You cannot remove yourself.");
    await backend().admin().remove(userId, who.organization.id);
  },
};
