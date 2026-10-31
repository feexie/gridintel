import { notFound, redirect } from "next/navigation";
import { AuthCard, Field, Submit } from "@/components/auth/AuthCard";
import { accountsEnabled, requestSession } from "@/composition/identity";
import { setPassword } from "../actions";

const ERRORS: Record<string, string> = {
  match: "The two passwords are not the same.",
  password: "Choose a password of at least 12 characters.",
};

/* After an invitation's link: the person chooses their password, then adds an authenticator app. */
export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!accountsEnabled()) notFound();
  const { error } = await searchParams;
  const session = await requestSession();
  const user = await session.user();
  if (user === null) redirect("/login?error=invite");
  return (
    <AuthCard title="Choose a password" lead={`For ${user.email}. At least 12 characters. An authenticator app is added next.`} error={error ? (ERRORS[error] ?? null) : null}>
      <form action={setPassword} className="space-y-3">
        <Field label="Password" name="password" type="password" autoComplete="new-password" />
        <Field label="The same password again" name="confirm" type="password" autoComplete="new-password" />
        <Submit>Continue</Submit>
      </form>
    </AuthCard>
  );
}
