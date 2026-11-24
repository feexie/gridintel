/* The deployment items of scripts/pilot-check.ts, as pure functions of what a deployment answered,
   so they can be tested without a network (scripts/pilot-check-outcomes.test.ts).

   Both items fetch /dashboard without following redirects:
   - the public demonstration serves it (2xx); with SUPABASE_SECRET_KEY set it refuses every
     request (503); a redirect to /login means the address is a tenant build;
   - the tenant answers with a redirect to /login. */

export type Outcome = "PASS" | "FAIL";

export interface Answer {
  status: number;
  /** The Location header, or "" when there is none. */
  location: string;
}

export interface Verdict {
  outcome: Outcome;
  detail: string;
}

const isRedirect = (status: number) => status >= 300 && status < 400;
const leadsToLogin = (answer: Answer, address: string) => isRedirect(answer.status) && answer.location !== "" && new URL(answer.location, address).pathname === "/login";

/** The demonstration holds no secret: it serves /dashboard. */
export function demoVerdict(answer: Answer, address: string): Verdict {
  if (answer.status === 503) return { outcome: "FAIL", detail: "the demonstration refuses to serve (503): remove SUPABASE_SECRET_KEY from its project and redeploy" };
  if (answer.status >= 200 && answer.status < 300) return { outcome: "PASS", detail: `/dashboard serves (HTTP ${answer.status}), so its running deployment has no SUPABASE_SECRET_KEY. Its Preview environment is not seen from here` };
  if (leadsToLogin(answer, address)) return { outcome: "FAIL", detail: `/dashboard leads to /login: ${address} is a tenant build, not the demonstration` };
  return { outcome: "FAIL", detail: `unexpected HTTP ${answer.status} for /dashboard from ${address}` };
}

/** The tenant deployment was built as one: /dashboard leads to /login. */
export function tenantVerdict(answer: Answer, address: string): Verdict {
  if (leadsToLogin(answer, address)) return { outcome: "PASS", detail: "/dashboard leads to /login" };
  if (answer.status === 503) return { outcome: "FAIL", detail: "the tenant refuses to serve (503): check GRIDINTEL_MODE=tenant was set before the build, and SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY; then redeploy" };
  if (answer.status >= 200 && answer.status < 300) return { outcome: "FAIL", detail: "/dashboard is shown to someone not signed in: this is not a tenant build (GRIDINTEL_MODE unset, or the branch has no Phase 8A)" };
  return { outcome: "FAIL", detail: `unexpected HTTP ${answer.status} from ${address}` };
}
