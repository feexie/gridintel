import type { TenantOrganization } from "../repositories/ports/index.ts";
import type { SeededPerson } from "../repositories/memory/identity.ts";
import { DEMO_ORGANIZATION_ID } from "../repositories/demo/sources.ts";
import { MINIGRID_ORGANIZATION_ID, MINIGRID_ORGANIZATION_NAME } from "../repositories/demo/minigrid/design.ts";

/* ==========================================================
   THE TWO SYNTHETIC ORGANIZATIONS AS TENANTS (Phase 8A)

   The distribution utility and the mini-grid operator of the
   demonstration dataset, each holding its own sector's records.
   The same two rows are seeded into Supabase by
   supabase/migrations/0001_identity.sql.

   The people below exist only in the in-memory identity adapter,
   which the browser tests run on and which refuses to run on
   Vercel. Their passwords and authenticator secrets are test
   fixtures, not credentials of anything.
========================================================== */

export const TENANT_ORGANIZATIONS: readonly TenantOrganization[] = [
  { id: DEMO_ORGANIZATION_ID, name: "Savanna Electricity Distribution (synthetic)", sectors: ["utility"], synthetic: true },
  { id: MINIGRID_ORGANIZATION_ID, name: MINIGRID_ORGANIZATION_NAME, sectors: ["minigrid"], synthetic: true },
];

export const TEST_PASSWORD = "synthetic-test-only-1";

export const TEST_PEOPLE = {
  discoAdmin: { email: "admin@disco.test", password: TEST_PASSWORD, totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", organizationId: DEMO_ORGANIZATION_ID, role: "admin", screens: null },
  discoRevenue: {
    email: "revenue@disco.test",
    password: TEST_PASSWORD,
    totpSecret: "KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU",
    organizationId: DEMO_ORGANIZATION_ID,
    role: "member",
    // The revenue department of ADR 0018.
    screens: ["utility.overview", "utility.map", "utility.revenue"],
  },
  minigridAdmin: { email: "admin@minigrid.test", password: TEST_PASSWORD, totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", organizationId: MINIGRID_ORGANIZATION_ID, role: "admin", screens: null },
  // Signed up, with no authenticator app yet: asked to enrol one at sign-in.
  discoNew: { email: "new@disco.test", password: TEST_PASSWORD, organizationId: DEMO_ORGANIZATION_ID, role: "member", screens: null },
} as const satisfies Record<string, SeededPerson>;
