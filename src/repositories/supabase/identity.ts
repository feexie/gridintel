import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

/* ==========================================================
   SUPABASE IDENTITY ADAPTER

   The identity port over Supabase Auth and its Postgres
   (supabase/migrations). Three kinds of client, by whose rights
   they act:

   - the session client: the publishable key and one request's
     cookies. It signs in, enrols and verifies the second factor,
     and reads `organizations` and `memberships` as the signed-in
     person: row-level security answers only their organization's
     rows, and only at aal2;
   - the admin client: the secret key, server only. It creates an
     invitation and writes memberships. The composition root calls
     it only after checking, from the person's own membership, that
     they administer the organization written to;
   - nothing in the browser: no key is sent to it.

   The membership row is the record of truth. Its copy in the
   person's app_metadata (`gridintel`) rides in the session token,
   which the proxy reads without a database query; a changed grant
   reaches the token when it is next refreshed (within the hour),
   and every data read checks the row itself at once.
========================================================== */

export interface SupabaseSettings {
  url: string;
  publishableKey: string;
  /** The secret (service role) key: server only, and only where an administrator writes. */
  secretKey?: string;
}

interface Mirror {
  organization_id: string | null;
  sectors: string[];
  screens: string[] | null;
  role: MemberRole | null;
}

type Row = Record<string, unknown>;

function sessionClient(settings: SupabaseSettings, cookies: CookieJar): SupabaseClient {
  return createServerClient(settings.url, settings.publishableKey, {
    cookies: {
      getAll: () => cookies.getAll(),
      // Where cookies cannot be written (a page), the proxy refreshes the session instead.
      setAll: (list) => cookies.setAll?.(list),
    },
  });
}

function membershipOf(row: Row): Membership {
  return {
    userId: String(row.user_id),
    email: String(row.email),
    organizationId: String(row.organization_id),
    role: row.role === "admin" ? "admin" : "member",
    screens: Array.isArray(row.screens) ? row.screens.map(String) : null,
    accepted: row.accepted === true,
  };
}

function organizationOf(row: Row): TenantOrganization {
  return { id: String(row.id), name: String(row.name), sectors: Array.isArray(row.sectors) ? row.sectors.map(String) : [], synthetic: row.synthetic !== false };
}

const assuranceOf = (aal: unknown): Assurance => (aal === "aal2" ? "aal2" : "aal1");

export function supabaseIdentitySession(settings: SupabaseSettings, cookies: CookieJar): IdentitySession & { reader(user: SessionUser): AccountsReader } {
  const client = sessionClient(settings, cookies);

  /** The token's claims, verified (against the project's signing keys, or by the Auth server). */
  async function claims() {
    const { data, error } = await client.auth.getClaims();
    return error || !data ? null : data.claims;
  }

  return {
    async user() {
      const verified = await claims();
      if (verified === null) return null;
      return { userId: verified.sub, email: verified.email ?? "", assurance: assuranceOf(verified.aal) };
    },
    async hint(): Promise<SessionHint | null> {
      const verified = await claims();
      if (verified === null) return null;
      const mirror = (verified.app_metadata?.gridintel ?? null) as Mirror | null;
      return {
        userId: verified.sub,
        assurance: assuranceOf(verified.aal),
        organizationId: mirror?.organization_id ?? null,
        sectors: mirror?.sectors ?? [],
        screens: mirror?.screens ?? null,
        administrator: mirror?.role === "admin",
      };
    },
    async signIn(email, password): Promise<SignInResult> {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return { ok: true };
      return { ok: false, reason: error.status !== undefined && error.status >= 500 ? "unavailable" : "invalid" };
    },
    async verifiedFactor() {
      const { data } = await client.auth.mfa.listFactors();
      return data?.all.find((factor) => factor.factor_type === "totp" && factor.status === "verified")?.id ?? null;
    },
    async enrol(): Promise<TotpEnrolment> {
      const { data: listed } = await client.auth.mfa.listFactors();
      for (const factor of listed?.all ?? []) {
        if (factor.status !== "verified") await client.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `GridIntel ${new Date().toISOString().slice(0, 10)}` });
      if (error || !data) throw new Error("The authenticator app could not be enrolled.");
      return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri, qrSvg: data.totp.qr_code };
    },
    async verify(factorId, code) {
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      return !error;
    },
    async acceptInvite(tokenHash) {
      const { error } = await client.auth.verifyOtp({ type: "invite", token_hash: tokenHash });
      return !error;
    },
    async setPassword(password) {
      if (password.length < 12) return false;
      const { data, error } = await client.auth.updateUser({ password });
      if (error || !data.user) return false;
      // The person's own row: row-level security lets them set this one column on it.
      await client.from("memberships").update({ accepted: true }).eq("user_id", data.user.id);
      return true;
    },
    async signOut() {
      await client.auth.signOut();
    },
    reader(): AccountsReader {
      return {
        async membership(userId) {
          const { data } = await client.from("memberships").select("user_id,email,organization_id,role,screens,accepted").eq("user_id", userId).maybeSingle();
          return data ? membershipOf(data) : null;
        },
        async organization(organizationId) {
          const { data } = await client.from("organizations").select("id,name,sectors,synthetic").eq("id", organizationId).maybeSingle();
          return data ? organizationOf(data) : null;
        },
        async members(organizationId) {
          const { data } = await client.from("memberships").select("user_id,email,organization_id,role,screens,accepted").eq("organization_id", organizationId).order("email");
          return (data ?? []).map(membershipOf);
        },
      };
    },
  };
}

export function supabaseAccountsAdmin(settings: SupabaseSettings): AccountsAdmin {
  if (!settings.secretKey) throw new Error("The secret key is needed to administer accounts.");
  const admin = createClient(settings.url, settings.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function mirror(userId: string, organizationId: string | null, role: MemberRole | null, screens: readonly string[] | null): Promise<void> {
    let sectors: string[] = [];
    if (organizationId !== null) {
      const { data } = await admin.from("organizations").select("sectors").eq("id", organizationId).single();
      sectors = Array.isArray(data?.sectors) ? data.sectors.map(String) : [];
    }
    const value: Mirror = { organization_id: organizationId, sectors, screens: screens === null ? null : [...screens], role };
    const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { gridintel: value } });
    if (error) throw new Error("The session's copy of the grant could not be written.");
  }

  return {
    async invite(input: InviteInput) {
      const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email: input.email.trim().toLowerCase() });
      if (error || !data.user) throw new Error(error?.message ?? "The invitation could not be made.");
      const userId = data.user.id;
      const { error: written } = await admin.from("memberships").insert({
        user_id: userId,
        email: input.email.trim().toLowerCase(),
        organization_id: input.organizationId,
        role: input.role,
        screens: input.screens === null ? null : [...input.screens],
      });
      if (written) throw new Error("The membership could not be written.");
      await mirror(userId, input.organizationId, input.role, input.screens);
      return { tokenHash: data.properties.hashed_token, userId };
    },
    async setGrant(userId: string, organizationId: string, role: MemberRole, screens: readonly string[] | null) {
      const { data, error } = await admin
        .from("memberships")
        .update({ role, screens: screens === null ? null : [...screens] })
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .select("user_id");
      if (error || !data || data.length !== 1) throw new Error("No such member.");
      await mirror(userId, organizationId, role, screens);
    },
    async remove(userId: string, organizationId: string) {
      const { data, error } = await admin.from("memberships").delete().eq("user_id", userId).eq("organization_id", organizationId).select("user_id");
      if (error || !data || data.length !== 1) throw new Error("No such member.");
      await mirror(userId, null, null, []);
    },
  };
}
