import type { ReactNode } from "react";
import Wordmark from "@/components/layout/Wordmark";

/* The frame of the sign-in pages (Phase 8A): the product's name, a heading, what the page asks
   for, and its form. Plain forms posted to server actions, so they work without script. */

export function AuthCard({ title, lead, error, children }: { title: string; lead: string; error?: string | null; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-4 py-10 text-ink">
      <div className="w-full max-w-sm space-y-4 rounded-panel border border-line bg-panel p-5 shadow-panel" data-auth-card>
        <Wordmark href="/" />
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-ink-4">{lead}</p>
        </div>
        {error ? (
          <p role="alert" className="rounded-tile border border-alert-line bg-alert-surface px-3 py-2 text-sm text-ink" data-auth-error>
            {error}
          </p>
        ) : null}
        {children}
      </div>
    </main>
  );
}

export function Field({ label, name, type = "text", autoComplete, inputMode, required = true, hint }: { label: string; name: string; type?: string; autoComplete?: string; inputMode?: "numeric" | "email" | "text"; required?: boolean; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-ink-2">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        className="mt-1 block w-full rounded-tile border border-line-strong bg-app px-3 py-2 text-ink outline-none focus:border-brand"
      />
      {hint ? <span className="mt-1 block text-caption text-ink-5">{hint}</span> : null}
    </label>
  );
}

export function Submit({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="gi-tap w-full rounded-tile bg-brand-strong px-4 py-2 text-sm font-semibold text-on-brand hover:opacity-90">
      {children}
    </button>
  );
}
