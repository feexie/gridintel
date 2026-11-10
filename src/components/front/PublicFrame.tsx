import Link from "next/link";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Wordmark from "@/components/layout/Wordmark";
import { PlannedTag } from "@/components/system/Brand";
import { PREVIEW_HOME } from "@/constants/frontDoor";

/* The frame of a public page (ADR 0021): the name, Sign in and the theme, and the page. There is
   no rail, no data bar and no link to a report: the public layer shows only what anyone may see.
   It is light on purpose: no map or chart library and no dataset is loaded on the client.

   Sign in leads to the tenant deployment's sign-in page when its address is set in configuration;
   until then it says that signing in is not open here. */
export function PublicFrame({ signInHref, children }: { signInHref: string | null; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-app text-ink" data-public-frame>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-3">
            <Wordmark href={PREVIEW_HOME} />
            <PlannedTag>Prototype</PlannedTag>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {signInHref ? (
              <a href={signInHref} className="gi-tap whitespace-nowrap rounded-tile bg-brand-strong px-3 py-1.5 text-sm font-medium text-white hover:opacity-90" data-sign-in>
                Sign in
              </a>
            ) : (
              <span className="whitespace-nowrap rounded-tile border border-line-strong px-3 py-1.5 text-sm text-ink-4" title="The sign-in address is not set on this site." data-sign-in data-sign-in-unset>
                Sign in
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

/** A link back, at the top of a public page. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-link hover:text-link-hover hover:underline">
      ← {children}
    </Link>
  );
}
