import { NextResponse, type NextRequest } from "next/server";
import { accountsEnabled, requestSession } from "@/composition/identity";

/* Signing out: the session ends on the server and its cookie is cleared. A form posts here. */
export async function POST(request: NextRequest): Promise<Response> {
  if (!accountsEnabled()) return new NextResponse("Not found.", { status: 404 });
  await (await requestSession()).signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
