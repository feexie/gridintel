import { NextResponse, type NextRequest } from "next/server";
import { accountsEnabled, requestSession } from "@/composition/identity";

/* An invitation's link (Phase 8A): /auth/confirm?token_hash=…&type=invite. The token is used once;
   the person is then signed in to choose a password and add an authenticator app. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!accountsEnabled()) return new NextResponse("Not found.", { status: 404 });
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash === null || type !== "invite") return NextResponse.redirect(new URL("/login?error=invite", request.url));
  const session = await requestSession();
  const ok = await session.acceptInvite(tokenHash);
  return NextResponse.redirect(new URL(ok ? "/login/set-password" : "/login?error=invite", request.url));
}
