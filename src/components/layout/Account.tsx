import Link from "next/link";
import { PEOPLE_PATH } from "@/constants/navigation";

/** Who is signed in, for which organization (Phase 8A). Absent on the public demonstration, where no one signs in. */
export interface AccountView {
  email: string;
  organization: string;
  administrator: boolean;
}

/* Who is signed in and for which organization, the way to manage people for an administrator, and
   the way out. Signing out is a plain form posted to /auth/signout, so it works without script. */
export default function Account({ account, className = "" }: { account: AccountView; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-4 ${className}`} data-account>
      <span>
        <span className="font-medium text-ink-2" data-account-email>
          {account.email}
        </span>{" "}
        · <span data-account-organization>{account.organization}</span>
      </span>
      {account.administrator ? (
        <Link href={PEOPLE_PATH} className="text-link hover:underline">
          People
        </Link>
      ) : null}
      <form action="/auth/signout" method="post">
        <button type="submit" className="gi-tap text-link hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
