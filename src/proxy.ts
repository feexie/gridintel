import { NextResponse, type NextRequest } from "next/server.js";
import type { CookieJar, CookieOptions } from "./repositories/ports/index.ts";
import { canOpen, grantFor, REFUSED_PATH } from "./constants/access.ts";
import { PATH_HEADER, deploymentMode, unsafeConfiguration } from "./composition/mode.ts";
import { publicViewer } from "./composition/viewer.ts";
import type { ViewerContext } from "./services/spatial/viewer.ts";

/* ==========================================================
   THE ROUTES A VIEWER MAY OPEN (ADR 0018, ADR 0020)

   Before a screen is answered, the viewer's grant is asked whether
   it opens the address. If it does not, the refusal page is
   answered in its place, with 403, at the same address: the screen
   is neither shown nor redirected to. The menu is cut from the same
   grant (constants/access.ts), so a viewer is refused only at an
   address they were never shown.

   THE PUBLIC DEMONSTRATION holds everything, so nothing is refused.

   A TENANT DEPLOYMENT (Phase 8A) asks, on every request but the
   sign-in pages and public reference files:
   1. is anyone signed in? If not: the sign-in page (an API: 401);
   2. have they passed the second factor? If not: the code page;
   3. does their grant open the address? This is the quick check,
      from the copy of the membership in the verified session token,
      with no database query, as Next's guidance asks of a proxy.
   It writes the address into the request (PATH_HEADER) for the
   check that holds: every data read asks the membership itself
   (composition/runtime.ts, `gate`). It also refreshes the session's
   cookies, which a page cannot write.

   A deployment configured unsafely (mode.ts) answers 503 to all.
========================================================== */

/** The check, for a given way of knowing who is looking. */
export function accessProxy(viewerOf: (request: NextRequest) => ViewerContext) {
  return function check(request: NextRequest): NextResponse {
    if (canOpen(viewerOf(request).screens, request.nextUrl.pathname)) return NextResponse.next();
    return NextResponse.rewrite(new URL(REFUSED_PATH, request.url), { status: 403 });
  };
}

const demo = accessProxy(() => publicViewer());

/** Addresses a tenant deployment answers to anyone: the sign-in pages, the landing page and public reference files. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/robots.txt" || pathname === "/api/ready" || /^\/(login|auth)(\/|$)/.test(pathname) || pathname.startsWith("/api/areas/");
}

async function tenant(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  if (isPublicPath(path)) return NextResponse.next();

  const written: { name: string; value: string; options: CookieOptions }[] = [];
  const jar: CookieJar = {
    getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      for (const cookie of list) {
        request.cookies.set(cookie.name, cookie.value);
        written.push(cookie);
      }
    },
  };
  const { sessionOver } = await import("./composition/identity.ts");
  const hint = await sessionOver(jar).hint();

  const finish = (response: NextResponse) => {
    for (const cookie of written) response.cookies.set(cookie.name, cookie.value, cookie.options);
    response.headers.set("cache-control", "private, no-store");
    return response;
  };
  const api = path.startsWith("/api/");

  if (hint === null) {
    if (api) return finish(NextResponse.json({ error: "Sign in first." }, { status: 401 }));
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return finish(NextResponse.redirect(login));
  }
  if (hint.assurance !== "aal2") {
    if (api) return finish(NextResponse.json({ error: "Enter the code from your authenticator app first." }, { status: 401 }));
    return finish(NextResponse.redirect(new URL("/login/verify", request.url)));
  }

  const grant = hint.organizationId === null ? { kind: "listed" as const, keys: [] } : grantFor(hint.sectors, hint.screens, hint.administrator);
  if (!canOpen(grant, path)) {
    if (api) return finish(NextResponse.json({ error: "Not open to you." }, { status: 403 }));
    return finish(NextResponse.rewrite(new URL(REFUSED_PATH, request.url), { status: 403 }));
  }

  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, path);
  return finish(NextResponse.next({ request: { headers } }));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const problem = unsafeConfiguration();
  if (problem !== null) {
    console.error(`[gridintel] refusing to serve: ${problem}`);
    return new NextResponse("This deployment is not configured safely, so it serves nothing.", { status: 503 });
  }
  if (deploymentMode() === "demo") return request.nextUrl.pathname.startsWith("/dashboard") ? demo(request) : NextResponse.next();
  return tenant(request);
}

export const config = {
  // Every address but the build's own files and the public images and fonts.
  matcher: "/((?!_next/static|_next/image|favicon.ico|images/|fonts/).*)",
};
