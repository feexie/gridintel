import { notFound, redirect } from "next/navigation";
import { AuthCard, Field, Submit } from "@/components/auth/AuthCard";
import { accountsEnabled, requestSession } from "@/composition/identity";
import { verifyCode } from "../actions";
import { safeNext } from "../next";

/* Adding an authenticator app: every account needs one, and signing in asks for its code each
   time. The page starts a new enrolment each time it is shown, and the code from the app
   finishes it. */
export default async function EnrolPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!accountsEnabled()) notFound();
  const { next, error } = await searchParams;
  const session = await requestSession();
  if ((await session.user()) === null) redirect("/login");
  if ((await session.verifiedFactor()) !== null) redirect("/login/verify");
  const enrolment = await session.enrol();
  return (
    <AuthCard
      title="Add an authenticator app"
      lead="Scan the code with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password or any other), or type the key into it. Then enter the six-digit code it shows."
      error={error === "code" ? "That code is not right. Here is a new key: add it to your app again." : null}
    >
      {enrolment.qrSvg ? (
        // The provider draws the QR code as SVG; it is shown as an image, never as markup.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrolment.qrSvg)}`} alt="QR code for your authenticator app" className="mx-auto h-44 w-44 rounded-tile bg-white p-2" />
      ) : null}
      <p className="text-sm">
        <span className="text-ink-4">Key: </span>
        <code className="break-all font-mono text-ink" data-totp-secret>
          {enrolment.secret}
        </code>
      </p>
      <form action={verifyCode} className="space-y-3">
        <input type="hidden" name="next" value={safeNext(next) ?? ""} />
        <input type="hidden" name="factorId" value={enrolment.factorId} />
        <Field label="Code from the app" name="code" autoComplete="one-time-code" inputMode="numeric" />
        <Submit>Finish</Submit>
      </form>
    </AuthCard>
  );
}
