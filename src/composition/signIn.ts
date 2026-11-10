/* ==========================================================
   WHERE "SIGN IN" LEADS FROM THE PUBLIC DEMONSTRATION (ADR 0021)

   The public demonstration has no sign-in page of its own (ADR
   0020): its Sign in button leads to the tenant deployment's
   sign-in page, whose address is set in GRIDINTEL_TENANT_SIGN_IN_URL
   (Founder, 2026-11-08). It must be an https address; anything else
   is treated as unset, and the button then says signing in is not
   open from this site. Read when a page is built.
========================================================== */

export function tenantSignInHref(value: string | undefined = process.env.GRIDINTEL_TENANT_SIGN_IN_URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
