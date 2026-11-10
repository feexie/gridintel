import Link from "next/link";
import type { InitiativeCardView, RolePickerView } from "@/services/initiatives/views";
import { Basis, FigureRow, Headline, ProgressBar } from "./Figure";

/* The initiative cards and the role picker (ADR 0021). The same card serves the public Home and
   a workspace's Home; only its link differs, and the service sets it. */

export function InitiativeCard({ card }: { card: InitiativeCardView }) {
  return (
    <article className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4 shadow-panel" data-initiative-card={card.id}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          <Link href={card.href} className="hover:underline">
            {card.title}
          </Link>
        </h2>
        <p className="mt-1 text-sm leading-snug text-ink-3">{card.summary}</p>
      </div>
      <Headline figure={card.headline} />
      {card.progress ? <ProgressBar figure={card.progress} /> : null}
      <Basis figure={card.headline} />
      {card.secondary ? (
        <div className="space-y-1 border-t border-line pt-3">
          <FigureRow figure={card.secondary} />
          <Basis figure={card.secondary} />
        </div>
      ) : null}
      <div className="mt-auto pt-1">
        <Link href={card.href} className="text-sm font-medium text-link hover:text-link-hover hover:underline">
          Open →
        </Link>
      </div>
    </article>
  );
}

export function InitiativeGrid({ cards }: { cards: InitiativeCardView[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-initiatives>
      {cards.map((card) => (
        <InitiativeCard key={card.id} card={card} />
      ))}
    </div>
  );
}

/** "Who are you?": each role a link, public roles first as the catalogue lists them. */
export function RolePicker({ picker }: { picker: RolePickerView }) {
  return (
    <div className="space-y-4" data-role-picker={picker.id}>
      <div>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">{picker.title}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">Who are you?</h1>
        <p className="mt-1 max-w-2xl text-sm leading-snug text-ink-3">{picker.summary}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {picker.roles.map((role) => (
          <li key={role.id}>
            <Link href={role.href} className="block h-full rounded-panel border border-line bg-panel p-4 shadow-panel hover:border-line-bold" data-role={role.id} data-audience={role.audience}>
              <span className="block font-semibold text-ink">{role.label}</span>
              <span className="mt-1 block text-sm leading-snug text-ink-3">{role.description}</span>
              <span className="mt-2 block text-caption text-ink-4">{role.audience === "public" ? "No sign-in needed" : "Sign in to your organization's workspace"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
