"use server";

import { redirect } from "next/navigation";
import { requestSession } from "@/composition/identity";
import { safeNext } from "./next";

/* The sign-in steps (Phase 8A, ADR 0020): a password, then a code from an authenticator app. A
   person invited sets a password first and enrols an app. Every step answers with a redirect, so
   a refreshed page never repeats a step. Failure says only that the step failed, not why: it
   never says whether an address has an account. */

const withNext = (path: string, next: string | null, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams(extra);
  if (next !== null) params.set("next", next);
  const query = params.toString();
  return query === "" ? path : `${path}?${query}`;
};

export async function signIn(form: FormData): Promise<void> {
  const next = safeNext(form.get("next"));
  const session = await requestSession();
  const result = await session.signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!result.ok) redirect(withNext("/login", next, { error: result.reason }));
  const factor = await session.verifiedFactor();
  redirect(withNext(factor === null ? "/login/enrol" : "/login/verify", next));
}

export async function verifyCode(form: FormData): Promise<void> {
  const next = safeNext(form.get("next"));
  const session = await requestSession();
  const enrolling = form.get("factorId");
  const factorId = typeof enrolling === "string" && enrolling !== "" ? enrolling : await session.verifiedFactor();
  if (factorId === null) redirect(withNext("/login/enrol", next));
  const ok = await session.verify(factorId, String(form.get("code") ?? ""));
  if (!ok) redirect(withNext(typeof enrolling === "string" && enrolling !== "" ? "/login/enrol" : "/login/verify", next, { error: "code" }));
  redirect(withNext("/login/continue", next));
}

export async function setPassword(form: FormData): Promise<void> {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) redirect("/login/set-password?error=match");
  const session = await requestSession();
  if (!(await session.setPassword(password))) redirect("/login/set-password?error=password");
  redirect("/login/enrol");
}
