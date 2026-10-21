/* ==========================================================
   REPOSITORY PORTS — IDENTITY (Phase 8A, ADR 0020)

   Who is signed in, which organization they act for and which
   screens they may open. Two adapters implement it: Supabase Auth
   with its Postgres (the pilot), and an in-memory one (the browser
   tests and a machine with no Supabase project). Leaving Supabase
   is a new adapter, not a rewrite.

   Three interfaces, by whose rights they act:

   - IdentitySession: one request's session, read from and written
     to that request's cookies. It signs in, verifies the second
     factor and says who is signed in, verified by the provider.
   - AccountsReader: the organizations and memberships, read with
     the signed-in person's own rights. In Postgres row-level
     security limits it to that person's organization; a membership
     of another organization does not exist for it.
   - AccountsAdmin: the same records written with the platform's
     own rights. Called only by the composition root, after it has
     checked on the server that the caller is an administrator of
     the organization written to.

   A membership is the record of truth for what a person may open.
   The session carries a copy (`SessionHint`) so that the proxy can
   make its quick check without a database read; every data read
   checks the membership itself.
========================================================== */

/** How strongly the session was established: aal1 after a password, aal2 after the second factor too. */
export type Assurance = "aal1" | "aal2";

/** The person signed in, as the identity provider verified it on this request. */
export interface SessionUser {
  userId: string;
  email: string;
  assurance: Assurance;
}

/** What the session's verified token says of the person's organization and screens: the proxy's quick check only. */
export interface SessionHint {
  userId: string;
  assurance: Assurance;
  organizationId: string | null;
  /** The sectors the organization holds. */
  sectors: readonly string[];
  /** The permission keys held; null for every screen of the organization's sectors. */
  screens: readonly string[] | null;
  administrator: boolean;
}

/** An organization that people sign in for, and the sectors whose records it holds. */
export interface TenantOrganization {
  id: string;
  name: string;
  /** Sector ids ("utility", "minigrid"): the records the organization's people may read. */
  sectors: readonly string[];
  /** True while every record the organization holds is synthetic. */
  synthetic: boolean;
}

export type MemberRole = "admin" | "member";

export interface Membership {
  userId: string;
  email: string;
  organizationId: string;
  role: MemberRole;
  /** The permission keys held (ADR 0018); null for every screen of the organization's sectors. */
  screens: readonly string[] | null;
  /** False until the person has accepted the invitation and set a password. */
  accepted: boolean;
}

/** A second factor being enrolled: what an authenticator app needs to add it. */
export interface TotpEnrolment {
  factorId: string;
  /** The shared secret, base32, for typing into an app by hand. */
  secret: string;
  /** The otpauth:// address an app reads from a QR code. */
  uri: string;
  /** The QR code as an SVG image, when the provider draws one. */
  qrSvg: string | null;
}

export type SignInResult = { ok: true } | { ok: false; reason: "invalid" | "unavailable" };

/** One request's cookies, as the composition root hands them to an adapter. */
export interface CookieJar {
  getAll(): { name: string; value: string }[];
  /** Absent where cookies cannot be written (a page); the session is then refreshed by the proxy. */
  setAll?(cookies: { name: string; value: string; options: CookieOptions }[]): void;
}

export interface CookieOptions {
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  expires?: Date;
}

export interface IdentitySession {
  /** The person signed in, verified by the provider; null when no one is. */
  user(): Promise<SessionUser | null>;
  /** The verified token's copy of the membership, for the proxy; null when no one is signed in. */
  hint(): Promise<SessionHint | null>;
  signIn(email: string, password: string): Promise<SignInResult>;
  /** The id of the verified authenticator app; null when none is enrolled. */
  verifiedFactor(): Promise<string | null>;
  /** Starts enrolling an authenticator app, discarding any enrolment left unfinished. */
  enrol(): Promise<TotpEnrolment>;
  /** Checks a code from the app; on success the session is aal2. */
  verify(factorId: string, code: string): Promise<boolean>;
  /** Signs in with an invitation's token; the session is aal1 until a password and a second factor are set. */
  acceptInvite(tokenHash: string): Promise<boolean>;
  setPassword(password: string): Promise<boolean>;
  signOut(): Promise<void>;
}

export interface AccountsReader {
  /** The signed-in person's own membership; null when they hold none. */
  membership(userId: string): Promise<Membership | null>;
  organization(organizationId: string): Promise<TenantOrganization | null>;
  /** The members of an organization: only an administrator of it is answered with more than themself. */
  members(organizationId: string): Promise<Membership[]>;
}

export interface InviteInput {
  email: string;
  organizationId: string;
  role: MemberRole;
  screens: readonly string[] | null;
}

export interface AccountsAdmin {
  /**
   * Creates the person and their membership, and returns the invitation's token. Nothing is
   * sent: the administrator passes the link on (the free plan's email reaches only the
   * project's own team, ADR 0020).
   */
  invite(input: InviteInput): Promise<{ tokenHash: string; userId: string }>;
  /** Changes what a member may open, in the membership and in the session's copy. */
  setGrant(userId: string, organizationId: string, role: MemberRole, screens: readonly string[] | null): Promise<void>;
  /** Removes a member from the organization: from the next request they open nothing. */
  remove(userId: string, organizationId: string): Promise<void>;
}
