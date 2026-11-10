import Link from "next/link";
import type { ReactNode } from "react";
import { PlannedTag } from "@/components/system/Brand";
import type { MinigridSummaryView, SignInHandoffView } from "@/services/initiatives/views";
import { Basis, FigureRow } from "./Figure";

/* The pages a role is sent to (ADR 0021). In Phase NAV-A they are shells: the meter application
   and the tracking page show every field and submit nothing (MTR-A builds them); the charging
   network has no records yet; the mini-grid summary shows counts only. */

function Heading({ eyebrow, title, children, tag }: { eyebrow: string; title: string; children?: ReactNode; tag?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">{eyebrow}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {children ? <p className="mt-1 max-w-2xl text-sm leading-snug text-ink-3">{children}</p> : null}
      </div>
      {tag}
    </div>
  );
}

const field = "mt-1 block w-full rounded-tile border border-line-strong bg-panel px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-70";

function Field({ label, optional = false, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-ink-2">
      {label}
      {optional ? <span className="font-normal text-ink-4"> (optional)</span> : null}
      {children}
    </label>
  );
}

/** Submitting is not built yet: said before the form, so no one fills it in for nothing. */
function NotOpenYet({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-tile border border-dashed border-line-bold bg-panel px-3 py-2 text-sm text-ink-3" data-not-open>
      {children}
    </p>
  );
}

export function MeterApplicationShell({ discos, states, trackHref }: { discos: { id: string; name: string }[]; states: readonly string[]; trackHref: string }) {
  return (
    <div className="space-y-4" data-public-view="meter-application">
      <Heading eyebrow="Meter every customer · Customer" title="Apply for a meter" tag={<PlannedTag>Prototype · not open yet</PlannedTag>}>
        Tell us where the meter is needed. You will get a tracking reference to follow your application.
      </Heading>
      <NotOpenYet>This form is a prototype. It does not send anything yet: applications open in a later phase.</NotOpenYet>
      <form className="space-y-4 rounded-panel border border-line bg-panel p-4 shadow-panel" aria-label="Meter application (prototype)">
        <fieldset disabled className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <input className={field} name="name" autoComplete="name" />
          </Field>
          <Field label="Phone number">
            <input className={field} name="phone" type="tel" autoComplete="tel" />
          </Field>
          <Field label="Email" optional>
            <input className={field} name="email" type="email" autoComplete="email" />
          </Field>
          <Field label="State">
            <select className={field} name="state" defaultValue="">
              <option value="">Choose a state</option>
              {states.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </Field>
          <Field label="LGA or area">
            <input className={field} name="area" />
          </Field>
          <Field label="Address">
            <input className={field} name="address" autoComplete="street-address" />
          </Field>
          <Field label="Nearest landmark">
            <input className={field} name="landmark" />
          </Field>
          <Field label="DisCo">
            <select className={field} name="disco" defaultValue="">
              <option value="">Choose your DisCo</option>
              {discos.map((disco) => (
                <option key={disco.id} value={disco.id}>
                  {disco.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Meter maker">
            <select className={field} name="oem" defaultValue="none">
              <option value="none">No preference</option>
            </select>
            <span className="mt-1 block text-caption font-normal text-ink-4">Lists the makers your DisCo has approved, once you choose a DisCo.</span>
          </Field>
          <Field label="Existing account number" optional>
            <input className={field} name="account" />
          </Field>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-ink-2">
              Drop a pin on the map <span className="font-normal text-ink-4">(optional)</span>
            </p>
            <p className="mt-1 text-caption text-ink-4">Helps your DisCo find the right transformer and feeder. You never need to know them yourself.</p>
            <div
              className="mt-2 flex h-40 items-center justify-center rounded-tile border border-dashed border-line-bold bg-app text-sm text-ink-4"
              data-map-placeholder
            >
              Map for your pin: not open yet. It opens with the application form.
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-ink-2 sm:col-span-2">
            <input type="checkbox" name="consent" className="mt-1" />
            <span>I agree that my details are used to process this application, under the Nigeria Data Protection Act.</span>
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-tile bg-brand-strong px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              Send application
            </button>
          </div>
        </fieldset>
      </form>
      <p className="text-sm text-ink-3">
        Already applied?{" "}
        <Link href={trackHref} className="font-medium text-link hover:text-link-hover hover:underline">
          Track my application →
        </Link>
      </p>
    </div>
  );
}

export function TrackShell() {
  return (
    <div className="space-y-4" data-public-view="meter-track">
      <Heading eyebrow="Meter every customer" title="Track my application" tag={<PlannedTag>Prototype · not open yet</PlannedTag>}>
        Enter the reference you were given and the phone number you applied with. You will see the status of the application only.
      </Heading>
      <NotOpenYet>Tracking is a prototype. It looks nothing up yet.</NotOpenYet>
      <form className="max-w-md space-y-4 rounded-panel border border-line bg-panel p-4 shadow-panel" aria-label="Track an application (prototype)">
        <fieldset disabled className="space-y-4">
          <Field label="Tracking reference">
            <input className={field} name="reference" placeholder="GI-MTR-2026-000123" />
          </Field>
          <Field label="Phone number">
            <input className={field} name="phone" type="tel" />
          </Field>
          <button type="submit" className="rounded-tile bg-brand-strong px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Show status
          </button>
        </fieldset>
      </form>
      <p className="text-caption text-ink-4">The steps an application goes through: submitted, under review, verified, assigned a transformer and feeder, approved, funded, installed. It can be rejected at any step, with the reason.</p>
    </div>
  );
}

export function ChargingNetworkPlanned({ states }: { states: readonly string[] }) {
  return (
    <div className="space-y-4" data-public-view="charging-network">
      <Heading eyebrow="Charging hubs · Rider or fleet owner" title="Charging and swap hubs near you" tag={<PlannedTag>Planned · no data yet</PlannedTag>}>
        Choose a state to see its hubs on a map and in a list: where each one is, who runs it, what it offers and whether it is open.
      </Heading>
      <NotOpenYet>GridIntel holds no charging hub records yet, so there is no hub and no figure on this page. They come with the E-mobility planner.</NotOpenYet>
      <label className="block max-w-xs text-sm font-medium text-ink-2">
        State
        <select className={field} disabled defaultValue="">
          <option value="">Choose a state</option>
          {states.map((state) => (
            <option key={state}>{state}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function MinigridSummary({ summary }: { summary: MinigridSummaryView }) {
  return (
    <div className="space-y-4" data-public-view="minigrid-summary">
      <Heading eyebrow="Mini-grid verification · The public" title="Do the sites' reports match their records?">
        Summary figures only. Each site&apos;s detail is open to its operator, its funders and its regulator, signed in.
      </Heading>
      {summary.synthetic ? (
        <p className="rounded-tile border border-caution-line/60 px-3 py-2 text-sm text-caution" data-synthetic-note>
          Synthetic data: these sites and their records are designed for the demonstration. None is a real site.
        </p>
      ) : null}
      <div className="space-y-3 rounded-panel border border-line bg-panel p-4 shadow-panel">
        {summary.figures.map((figure) => (
          <div key={figure.id} className="space-y-1 border-b border-line pb-3 last:border-0 last:pb-0">
            <FigureRow figure={figure} />
            <Basis figure={figure} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignInHandoff({ handoff }: { handoff: SignInHandoffView }) {
  return (
    <div className="space-y-4" data-sign-in-handoff={handoff.workspaceType}>
      <Heading eyebrow={`${handoff.initiativeTitle} · ${handoff.roleLabel}`} title="Sign in to your workspace">
        Applications, customer records, approvals, funding and reports are open only to signed-in members of an organization, in its own workspace.
      </Heading>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-panel border border-line bg-panel p-4 shadow-panel">
          <h2 className="font-semibold text-ink">Your organization&apos;s workspace</h2>
          <p className="mt-1 text-sm text-ink-3">For members invited by their organization. You need your password and the code from your authenticator app.</p>
          <div className="mt-3">
            {handoff.signInHref ? (
              <a href={handoff.signInHref} className="inline-block rounded-tile bg-brand-strong px-4 py-2 text-sm font-medium text-white hover:opacity-90" data-sign-in>
                Sign in
              </a>
            ) : (
              <p className="text-sm text-ink-4" data-sign-in-unset>
                Signing in is not open from this site yet.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-panel border border-line bg-panel p-4 shadow-panel">
          <h2 className="font-semibold text-ink">The demo workspace</h2>
          <p className="mt-1 text-sm text-ink-3">
            {handoff.demoName}: a {handoff.workspaceTypeLabel} workspace on synthetic data. Read-only, and open without signing in.
          </p>
          <div className="mt-3">
            <Link href={handoff.demoHref} className="inline-block rounded-tile border border-line-strong px-4 py-2 text-sm font-medium text-ink-2 hover:border-line-bold" data-open-demo>
              Open the demo workspace →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
