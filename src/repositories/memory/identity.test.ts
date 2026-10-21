import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CookieJar, SessionUser, TenantOrganization } from "../ports/index.ts";
import { createMemoryIdentityStore, memoryAccountsAdmin, memoryAccountsReader, memoryIdentitySession, MEMORY_SESSION_COOKIE, seedMemoryIdentity } from "./identity.ts";
import { base32Encode, totpCode, totpMatches } from "./totp.ts";

/* The in-memory identity adapter keeps the rules the Supabase adapter and its row-level security
   keep: aal2 only after the second factor, a person reads their own organization only, an
   invitation is used once. A fixed clock throughout. */

const NOW = Date.UTC(2026, 9, 21, 9, 0, 0);
const clock = () => NOW;

const ORGANIZATIONS: TenantOrganization[] = [
  { id: "org-a", name: "A (synthetic)", sectors: ["utility"], synthetic: true },
  { id: "org-b", name: "B (synthetic)", sectors: ["minigrid"], synthetic: true },
];
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

function browser(): CookieJar & { value: () => string | null } {
  let value: string | null = null;
  return {
    getAll: () => (value === null ? [] : [{ name: MEMORY_SESSION_COOKIE, value }]),
    setAll: (list) => {
      for (const cookie of list) value = cookie.value === "" ? null : cookie.value;
    },
    value: () => value,
  };
}

function store() {
  const held = createMemoryIdentityStore();
  seedMemoryIdentity(held, ORGANIZATIONS, [
    { email: "admin@a.test", password: "a-long-password-1", totpSecret: SECRET, organizationId: "org-a", role: "admin", screens: null },
    { email: "member@a.test", password: "a-long-password-2", totpSecret: SECRET, organizationId: "org-a", role: "member", screens: ["utility.revenue"] },
    { email: "admin@b.test", password: "a-long-password-3", totpSecret: SECRET, organizationId: "org-b", role: "admin", screens: null },
  ]);
  return held;
}

async function signedIn(held: ReturnType<typeof store>, email: string, password: string): Promise<SessionUser> {
  const jar = browser();
  const session = memoryIdentitySession(held, jar, clock);
  assert.deepEqual(await session.signIn(email, password), { ok: true });
  assert.equal((await session.user())?.assurance, "aal1");
  assert.equal(await session.verify((await session.verifiedFactor())!, totpCode(SECRET, NOW)), true);
  const user = await memoryIdentitySession(held, jar, clock).user();
  assert.equal(user?.assurance, "aal2");
  return user!;
}

describe("time-based one-time passwords", () => {
  it("give the RFC 6238 test vectors (SHA-1, the last six digits)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    assert.equal(totpCode(secret, 59_000), "287082");
    assert.equal(totpCode(secret, 1_111_111_109_000), "081804");
    assert.equal(totpCode(secret, 1_234_567_890_000), "005924");
  });

  it("accept the step either side for a slow clock, and nothing further or malformed", () => {
    assert.equal(totpMatches(SECRET, totpCode(SECRET, NOW - 30_000), NOW), true);
    assert.equal(totpMatches(SECRET, totpCode(SECRET, NOW - 90_000), NOW), false);
    assert.equal(totpMatches(SECRET, "12345", NOW), false);
  });
});

describe("the in-memory identity adapter", () => {
  it("signs in with a password at aal1 and with the code at aal2; a wrong password or code does not", async () => {
    const held = store();
    const session = memoryIdentitySession(held, browser(), clock);
    assert.deepEqual(await session.signIn("admin@a.test", "wrong"), { ok: false, reason: "invalid" });
    assert.deepEqual(await session.signIn("nobody@a.test", "a-long-password-1"), { ok: false, reason: "invalid" });
    assert.deepEqual(await session.signIn("ADMIN@a.test", "a-long-password-1"), { ok: true });
    const factor = (await session.verifiedFactor())!;
    assert.equal(await session.verify(factor, "000000"), false);
    assert.equal((await session.user())?.assurance, "aal1");
    await signedIn(held, "admin@a.test", "a-long-password-1");
  });

  it("answers a person with nothing before the second factor, and with their own organization only after it", async () => {
    const held = store();
    const jar = browser();
    const session = memoryIdentitySession(held, jar, clock);
    await session.signIn("admin@a.test", "a-long-password-1");
    const aal1 = (await session.user())!;
    assert.equal(await memoryAccountsReader(held, aal1).membership(aal1.userId), null);

    const admin = await signedIn(held, "admin@a.test", "a-long-password-1");
    const reader = memoryAccountsReader(held, admin);
    assert.equal((await reader.membership(admin.userId))?.organizationId, "org-a");
    assert.equal(await reader.organization("org-b"), null);
    assert.deepEqual(await reader.members("org-b"), []);
    assert.deepEqual((await reader.members("org-a")).map((one) => one.email).sort(), ["admin@a.test", "member@a.test"]);

    // A member reads themself only, not the other members.
    const member = await signedIn(held, "member@a.test", "a-long-password-2");
    assert.deepEqual((await memoryAccountsReader(held, member).members("org-a")).map((one) => one.email), ["member@a.test"]);
  });

  it("uses an invitation once, then a password and a new authenticator app make the session aal2", async () => {
    const held = store();
    const { tokenHash, userId } = await memoryAccountsAdmin(held, clock).invite({ email: "new@a.test", organizationId: "org-a", role: "member", screens: null });
    assert.equal(held.memberships.get(userId)?.accepted, false);

    const jar = browser();
    const session = memoryIdentitySession(held, jar, clock);
    assert.equal(await session.acceptInvite(tokenHash), true);
    assert.equal(await memoryIdentitySession(held, browser(), clock).acceptInvite(tokenHash), false);
    assert.equal(await session.setPassword("short"), false);
    assert.equal(await session.setPassword("a-long-password-4"), true);
    assert.equal(held.memberships.get(userId)?.accepted, true);
    assert.equal(await session.verifiedFactor(), null);
    const enrolment = await session.enrol();
    assert.match(enrolment.uri, /^otpauth:\/\/totp\/GridIntel%3Anew%40a\.test\?secret=/);
    assert.equal(await session.verify(enrolment.factorId, totpCode(enrolment.secret, NOW)), true);
    assert.equal((await session.user())?.assurance, "aal2");
  });

  it("refuses an invitation that has expired", async () => {
    const held = store();
    const { tokenHash } = await memoryAccountsAdmin(held, clock).invite({ email: "late@a.test", organizationId: "org-a", role: "member", screens: null });
    const dayLater = () => NOW + 24 * 60 * 60 * 1000;
    assert.equal(await memoryIdentitySession(held, browser(), dayLater).acceptInvite(tokenHash), false);
  });

  it("ends a removed member's sessions, and does not reach a member of another organization", async () => {
    const held = store();
    const member = await signedIn(held, "member@a.test", "a-long-password-2");
    const admin = memoryAccountsAdmin(held, clock);
    const other = [...held.memberships.values()].find((one) => one.email === "admin@b.test")!;
    await assert.rejects(admin.remove(other.userId, "org-a"));
    await assert.rejects(admin.setGrant(other.userId, "org-a", "member", []));
    await admin.remove(member.userId, "org-a");
    assert.equal([...held.sessions.values()].some((session) => session.userId === member.userId), false);
  });

  it("signs out: the session ends on the server and its cookie is cleared", async () => {
    const held = store();
    const jar = browser();
    const session = memoryIdentitySession(held, jar, clock);
    await session.signIn("admin@a.test", "a-long-password-1");
    const id = jar.value();
    await session.signOut();
    assert.equal(jar.value(), null);
    assert.equal(held.sessions.has(id!), false);
  });
});
