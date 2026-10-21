"use client";

import { useActionState } from "react";

export interface InviteResult {
  link: string | null;
  email: string | null;
  error: string | null;
}

/* Inviting a person (Phase 8A). Nothing is emailed: the free plan's email reaches only the
   project's own team (ADR 0020). The link is shown here once, for the administrator to pass on
   by their own means; it can be used once, within a day. */
export function InviteForm({ action, departments }: { action: (state: InviteResult, form: FormData) => Promise<InviteResult>; departments: { id: string; label: string }[] }) {
  const [state, submit, pending] = useActionState(action, { link: null, email: null, error: null });
  return (
    <div className="space-y-3" data-invite>
      <form action={submit} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-sm">
          <span className="font-medium text-ink-2">Email address</span>
          <input name="email" type="email" required className="mt-1 block w-full rounded-tile border border-line-strong bg-app px-3 py-2 text-ink outline-none focus:border-brand" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-2">May open</span>
          <select name="department" className="mt-1 block w-full rounded-tile border border-line-strong bg-app px-3 py-2 text-ink">
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink-2">Role</span>
          <select name="role" defaultValue="member" className="mt-1 block w-full rounded-tile border border-line-strong bg-app px-3 py-2 text-ink">
            <option value="member">Member</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        <button type="submit" disabled={pending} className="gi-tap rounded-tile bg-brand-strong px-4 py-2 text-sm font-semibold text-on-brand hover:opacity-90 disabled:opacity-60">
          Invite
        </button>
      </form>
      {state.error ? (
        <p role="alert" className="text-sm text-ink" data-invite-error>
          {state.error}
        </p>
      ) : null}
      {state.link ? (
        <div className="rounded-tile border border-line bg-app px-3 py-2 text-sm" data-invite-link>
          <p className="text-ink-2">
            Send this link to {state.email} yourself. It works once, for a day; GridIntel has not sent it.
          </p>
          <code className="mt-1 block break-all font-mono text-caption text-ink">{state.link}</code>
        </div>
      ) : null}
    </div>
  );
}
