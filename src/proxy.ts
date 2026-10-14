import { NextResponse, type NextRequest } from "next/server.js";
import { canOpen, REFUSED_PATH } from "./constants/access.ts";
import { getViewer } from "./composition/viewer.ts";
import type { ViewerContext } from "./services/spatial/viewer.ts";

/* ==========================================================
   THE ROUTES A VIEWER MAY OPEN (ADR 0018)

   Before a dashboard screen is answered, the viewer's grant is asked
   whether it opens the address. If it does not, the refusal page is
   answered in its place, with 403, at the same address: the screen
   is neither shown nor redirected to.

   The menu is cut from the same grant (constants/access.ts), so a
   viewer is refused only at an address they were never shown.

   The public demonstration holds everything, so today nothing is
   refused. When people log in (Phase 8) the viewer is read from the
   request, and each screen also checks the grant where its data is
   read: by Next's own guidance a proxy is a first check, not the
   only one.
========================================================== */

/** The check, for a given way of knowing who is looking. */
export function accessProxy(viewerOf: (request: NextRequest) => ViewerContext) {
  return function check(request: NextRequest): NextResponse {
    if (canOpen(viewerOf(request).screens, request.nextUrl.pathname)) return NextResponse.next();
    return NextResponse.rewrite(new URL(REFUSED_PATH, request.url), { status: 403 });
  };
}

export const proxy = accessProxy(() => getViewer());

export const config = {
  matcher: "/dashboard/:path*",
};
