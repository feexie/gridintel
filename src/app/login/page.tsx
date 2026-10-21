import { notFound } from "next/navigation";
import { AuthCard, Field, Submit } from "@/components/auth/AuthCard";
import { accountsEnabled } from "@/composition/identity";
import { signIn } from "./actions";
import { safeNext } from "./next";

const ERRORS: Record<string, string> = {
  invalid: "That email address and password do not match an account.",
  unavailable: "Signing in is not available just now. Try again in a minute.",
  invite: "That invitation link has expired or has been used. Ask your organization's administrator for a new one.",
};

/* Signing in, step 1 of 2: the password. Only people invited by their organization's administrator
   have an account; there is no way to sign up here. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!accountsEnabled()) notFound();
  const { next, error } = await searchParams;
  return (
    <AuthCard title="Sign in" lead="For people invited by their organization. A code from an authenticator app is asked for next." error={error ? (ERRORS[error] ?? null) : null}>
      <form action={signIn} className="space-y-3">
        <input type="hidden" name="next" value={safeNext(next) ?? ""} />
        <Field label="Email address" name="email" type="email" autoComplete="username" inputMode="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        <Submit>Continue</Submit>
      </form>
    </AuthCard>
  );
}
