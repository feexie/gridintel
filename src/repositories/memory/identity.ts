import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type {
  AccountsAdmin,
  AccountsReader,
  Assurance,
  CookieJar,
  IdentitySession,
  InviteInput,
  Membership,
  MemberRole,
  SessionHint,
  SessionUser,
  SignInResult,
  TenantOrganization,
  TotpEnrolment,
} from "../ports/index.ts";
import { newTotpSecret, totpMatches, totpUri } from "./totp.ts";

/* ==========================================================
   IN-MEMORY IDENTITY ADAPTER

   The identity port held in the server process: for the browser
   tests, and for a machine with no Supabase project. It keeps the
   same rules as the Supabase adapter and its row-level security:

   - a session is a random id in an httpOnly cookie; it is aal1
     after the password and aal2 after the second factor;
   - passwords are kept as scrypt hashes;
   - an invitation's token is single use and expires in a day;
   - the reader answers a person with their own membership and
     organization only, and with the other members only when they
     are its administrator; at aal1 it answers nothing.

   It is never used on Vercel (composition/identity.ts refuses it),
   and it forgets everything when the process ends.
========================================================== */

export const MEMORY_SESSION_COOKIE = "gi-session";
const SESSION_SECONDS = 8 * 60 * 60;
const INVITE_MS = 24 * 60 * 60 * 1000;
const ISSUER = "GridIntel";

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string | null;
  factors: { id: string; secret: string; verified: boolean }[];
}

interface StoredSession {
  userId: string;
  assurance: Assurance;
  expiresAt: number;
}

export interface MemoryIdentityStore {
  users: Map<string, StoredUser>;
  organizations: Map<string, TenantOrganization>;
  memberships: Map<string, Membership>;
  sessions: Map<string, StoredSession>;
  /** sha-256 of the token → the person and when it expires. */
  invites: Map<string, { userId: string; expiresAt: number }>;
}

export function createMemoryIdentityStore(): MemoryIdentityStore {
  return { users: new Map(), organizations: new Map(), memberships: new Map(), sessions: new Map(), invites: new Map() };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 32).toString("hex")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(scryptSync(password, Buffer.from(salt, "hex"), 32), Buffer.from(hash, "hex"));
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** A person seeded for the tests: signed up, with a password and, when given, a verified authenticator app. */
export interface SeededPerson {
  email: string;
  password: string;
  /** The authenticator's secret, base32; absent for a person who has not enrolled one. */
  totpSecret?: string;
  organizationId: string;
  role: MemberRole;
  screens: readonly string[] | null;
}

export function seedMemoryIdentity(store: MemoryIdentityStore, organizations: readonly TenantOrganization[], people: readonly SeededPerson[]): void {
  for (const organization of organizations) store.organizations.set(organization.id, organization);
  for (const person of people) {
    const id = randomUUID();
    store.users.set(id, {
      id,
      email: person.email,
      passwordHash: hashPassword(person.password),
      factors: person.totpSecret ? [{ id: randomUUID(), secret: person.totpSecret, verified: true }] : [],
    });
    store.memberships.set(id, { userId: id, email: person.email, organizationId: person.organizationId, role: person.role, screens: person.screens, accepted: true });
  }
}

export function memoryIdentitySession(store: MemoryIdentityStore, cookies: CookieJar, nowMs: () => number = Date.now): IdentitySession {
  // A session started in this request is the one in force for the rest of it, before the browser returns its cookie.
  let started: string | null = null;
  const sessionId = () => started ?? cookies.getAll().find((cookie) => cookie.name === MEMORY_SESSION_COOKIE)?.value ?? null;

  function current(): (StoredSession & { id: string }) | null {
    const id = sessionId();
    const session = id === null ? undefined : store.sessions.get(id);
    if (id === null || session === undefined) return null;
    if (session.expiresAt <= nowMs()) {
      store.sessions.delete(id);
      return null;
    }
    return { ...session, id };
  }

  function start(userId: string, assurance: Assurance): void {
    if (cookies.setAll === undefined) throw new Error("A session can be started only where cookies can be written.");
    const previous = sessionId();
    if (previous !== null) store.sessions.delete(previous);
    const id = randomBytes(32).toString("base64url");
    store.sessions.set(id, { userId, assurance, expiresAt: nowMs() + SESSION_SECONDS * 1000 });
    started = id;
    cookies.setAll([{ name: MEMORY_SESSION_COOKIE, value: id, options: { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.GRIDINTEL_E2E_HTTP !== "1", maxAge: SESSION_SECONDS } }]);
  }

  return {
    async user(): Promise<SessionUser | null> {
      const session = current();
      const user = session === null ? undefined : store.users.get(session.userId);
      return session === null || user === undefined ? null : { userId: user.id, email: user.email, assurance: session.assurance };
    },
    async hint(): Promise<SessionHint | null> {
      const session = current();
      if (session === null) return null;
      const membership = store.memberships.get(session.userId) ?? null;
      const organization = membership === null ? null : (store.organizations.get(membership.organizationId) ?? null);
      return {
        userId: session.userId,
        assurance: session.assurance,
        organizationId: organization?.id ?? null,
        sectors: organization?.sectors ?? [],
        screens: membership?.screens ?? null,
        administrator: membership?.role === "admin",
      };
    },
    async signIn(email: string, password: string): Promise<SignInResult> {
      const user = [...store.users.values()].find((one) => one.email.toLowerCase() === email.trim().toLowerCase());
      if (user === undefined || user.passwordHash === null || !passwordMatches(password, user.passwordHash)) return { ok: false, reason: "invalid" };
      start(user.id, "aal1");
      return { ok: true };
    },
    async verifiedFactor(): Promise<string | null> {
      const session = current();
      const user = session === null ? undefined : store.users.get(session.userId);
      return user?.factors.find((factor) => factor.verified)?.id ?? null;
    },
    async enrol(): Promise<TotpEnrolment> {
      const session = current();
      const user = session === null ? undefined : store.users.get(session.userId);
      if (user === undefined) throw new Error("No one is signed in.");
      if (user.factors.some((factor) => factor.verified)) throw new Error("An authenticator app is already enrolled.");
      const secret = newTotpSecret();
      const factor = { id: randomUUID(), secret, verified: false };
      user.factors = [factor];
      return { factorId: factor.id, secret, uri: totpUri(secret, user.email, ISSUER), qrSvg: null };
    },
    async verify(factorId: string, code: string): Promise<boolean> {
      const session = current();
      const user = session === null ? undefined : store.users.get(session.userId);
      const factor = user?.factors.find((one) => one.id === factorId);
      if (user === undefined || factor === undefined || !totpMatches(factor.secret, code.trim(), nowMs())) return false;
      factor.verified = true;
      start(user.id, "aal2");
      return true;
    },
    async acceptInvite(tokenHash: string): Promise<boolean> {
      const invite = store.invites.get(tokenHash);
      store.invites.delete(tokenHash);
      if (invite === undefined || invite.expiresAt <= nowMs() || !store.users.has(invite.userId)) return false;
      start(invite.userId, "aal1");
      return true;
    },
    async setPassword(password: string): Promise<boolean> {
      const session = current();
      const user = session === null ? undefined : store.users.get(session.userId);
      if (user === undefined || password.length < 12) return false;
      user.passwordHash = hashPassword(password);
      const membership = store.memberships.get(user.id);
      if (membership !== undefined) store.memberships.set(user.id, { ...membership, accepted: true });
      return true;
    },
    async signOut(): Promise<void> {
      const id = sessionId();
      if (id !== null) store.sessions.delete(id);
      started = null;
      cookies.setAll?.([{ name: MEMORY_SESSION_COOKIE, value: "", options: { path: "/", maxAge: 0 } }]);
    },
  };
}

/** The records as row-level security would show them to one signed-in person at one assurance. */
export function memoryAccountsReader(store: MemoryIdentityStore, user: SessionUser): AccountsReader {
  const own = () => (user.assurance === "aal2" ? (store.memberships.get(user.userId) ?? null) : null);
  return {
    async membership(userId: string) {
      const membership = own();
      return membership !== null && userId === user.userId ? { ...membership } : null;
    },
    async organization(organizationId: string) {
      const membership = own();
      return membership?.organizationId === organizationId ? (store.organizations.get(organizationId) ?? null) : null;
    },
    async members(organizationId: string) {
      const membership = own();
      if (membership === null || membership.organizationId !== organizationId) return [];
      if (membership.role !== "admin") return [{ ...membership }];
      return [...store.memberships.values()].filter((one) => one.organizationId === organizationId).map((one) => ({ ...one }));
    },
  };
}

export function memoryAccountsAdmin(store: MemoryIdentityStore, nowMs: () => number = Date.now): AccountsAdmin {
  return {
    async invite(input: InviteInput) {
      if (!store.organizations.has(input.organizationId)) throw new Error("No such organization.");
      const email = input.email.trim().toLowerCase();
      if ([...store.users.values()].some((one) => one.email.toLowerCase() === email)) throw new Error("That person already has an account.");
      const userId = randomUUID();
      store.users.set(userId, { id: userId, email, passwordHash: null, factors: [] });
      store.memberships.set(userId, { userId, email, organizationId: input.organizationId, role: input.role, screens: input.screens, accepted: false });
      const token = randomBytes(32).toString("base64url");
      const tokenHash = sha256(token);
      store.invites.set(tokenHash, { userId, expiresAt: nowMs() + INVITE_MS });
      return { tokenHash, userId };
    },
    async setGrant(userId: string, organizationId: string, role: MemberRole, screens: readonly string[] | null) {
      const membership = store.memberships.get(userId);
      if (membership === undefined || membership.organizationId !== organizationId) throw new Error("No such member.");
      store.memberships.set(userId, { ...membership, role, screens });
    },
    async remove(userId: string, organizationId: string) {
      const membership = store.memberships.get(userId);
      if (membership === undefined || membership.organizationId !== organizationId) throw new Error("No such member.");
      store.memberships.delete(userId);
      for (const [id, session] of store.sessions) if (session.userId === userId) store.sessions.delete(id);
    },
  };
}
