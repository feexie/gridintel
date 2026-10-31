/* Invites an organization's first administrator into the Supabase project (Phase 8A, ADR 0020).
   After the first, administrators invite people from the People screen.

   Run on your own machine, with the project's settings in .env.local (never committed):

     node --env-file=.env.local scripts/pilot-invite.ts <email> <organization-id> <deployment-address>

   e.g. node --env-file=.env.local scripts/pilot-invite.ts you@example.com demo-disco https://gridintel-pilot.vercel.app

   It prints the invitation's link. Nothing is emailed: pass the link on yourself. It works once,
   within a day. The organizations are those of supabase/migrations/0001_identity.sql. */

import { supabaseAccountsAdmin } from "../src/repositories/supabase/identity.ts";

const [email, organizationId, address] = process.argv.slice(2);
if (!email || !organizationId || !address) {
  console.error("Usage: node --env-file=.env.local scripts/pilot-invite.ts <email> <organization-id> <deployment-address>");
  process.exit(2);
}
const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) {
  console.error("SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY must be set (in .env.local).");
  process.exit(2);
}

const { tokenHash } = await supabaseAccountsAdmin({ url, publishableKey, secretKey }).invite({ email, organizationId, role: "admin", screens: null });
const link = new URL("/auth/confirm", address);
link.searchParams.set("token_hash", tokenHash);
link.searchParams.set("type", "invite");
console.log(`Invitation for ${email}, administrator of ${organizationId}. It works once, within a day:\n${link}`);
