import { notFound, redirect } from "next/navigation";
import { AuthCard, Field, Submit } from "@/components/auth/AuthCard";
import { accountsEnabled, requestSession } from "@/composition/identity";
import { verifyCode } from "../actions";
import { safeNext } from "../next";

/* Signing in, step 2 of 2: the six-digit code from the authenticator app the person enrolled. */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!accountsEnabled()) notFound();
  const { next, error } = await searchParams;
  const session = await requestSession();
  if ((await session.user()) === null) redirect("/login");
  if ((await session.verifiedFactor()) === null) redirect("/login/enrol");
  return (
    <AuthCard title="Enter your code" lead="The six-digit code your authenticator app shows for GridIntel now." error={error === "code" ? "That code is not right, or it has expired. Codes change every 30 seconds." : null}>
      <form action={verifyCode} className="space-y-3">
        <input type="hidden" name="next" value={safeNext(next) ?? ""} />
        <Field label="Code" name="code" autoComplete="one-time-code" inputMode="numeric" />
        <Submit>Sign in</Submit>
      </form>
    </AuthCard>
  );
}
