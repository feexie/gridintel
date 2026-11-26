import Link from "next/link";
import type { InitiativePageView } from "@/services/initiatives/views";
import { InitiativeCard } from "./Initiatives";

/* An initiative's own page (brief 3c.1): drawn from its catalogue entry only. Its figures are
   its card's, with their status and source. The host is shown only when one is set, which needs
   that organization's written agreement (brief 3c.2): none is set today. */
export function InitiativePage({ page }: { page: InitiativePageView }) {
  return (
    <article className="space-y-4" data-initiative-page={page.id}>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{page.title}</h1>
        <p className="max-w-2xl text-sm leading-snug text-ink-3">{page.summary}</p>
        {page.hostedBy ? (
          <p className="text-caption text-ink-4" data-hosted-by>
            Hosted by {page.hostedBy.name}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-4">
          <section className="space-y-2" data-for-who>
            <h2 className="text-xs font-semibold uppercase tracking-title text-ink-2">Who it is for</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {page.forWho.map((one) => (
                <li key={one.label} className="rounded-panel border border-line bg-panel p-3">
                  <p className="text-sm font-medium text-ink">{one.label}</p>
                  <p className="mt-0.5 text-caption text-ink-4">{one.description}</p>
                  <p className="mt-1 text-micro uppercase tracking-wide text-ink-5">{one.audience === "public" ? "No account needed" : "Signs in to its own workspace"}</p>
                </li>
              ))}
            </ul>
          </section>

          {page.statusFlow ? (
            <section className="space-y-2" data-status-flow>
              <h2 className="text-xs font-semibold uppercase tracking-title text-ink-2">How it moves</h2>
              <ol className="flex flex-wrap gap-1.5">
                {page.statusFlow.steps.map((step, index) => (
                  <li key={step} className="rounded-tile border border-line bg-panel px-2.5 py-1 text-sm text-ink-2">
                    {index + 1}. {step}
                  </li>
                ))}
              </ol>
              <p className="text-caption text-ink-4">{page.statusFlow.note}</p>
            </section>
          ) : null}

          <section className="space-y-2" data-taking-part>
            <h2 className="text-xs font-semibold uppercase tracking-title text-ink-2">Who takes part</h2>
            <ul className="flex flex-wrap gap-2">
              {page.takingPart.map((one) => (
                <li key={one.typeLabel} className="rounded-tile border border-line bg-panel px-3 py-1.5 text-sm text-ink-2">
                  {one.typeLabel}: {one.count}
                  {one.synthetic ? <span className="ml-1 text-micro uppercase tracking-wide text-caution">Synthetic</span> : null}
                </li>
              ))}
            </ul>
            <p className="text-caption text-ink-4">Demonstration organizations, synthetic, until real organizations join.</p>
          </section>
        </div>

        <div className="space-y-3">
          <InitiativeCard card={page.card} onItsPage />
          <Link href={page.takePartHref} className="gi-tap block rounded-tile bg-brand-strong px-4 py-2 text-center text-sm font-semibold text-white hover:opacity-90" data-take-part>
            Take part
          </Link>
        </div>
      </div>
    </article>
  );
}
