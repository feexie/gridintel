import Link from "next/link";
import { PlannedTag, SectorBand } from "@/components/system/Brand";
import { Panel } from "@/components/system/Metric";

/* A sector's AI Assistant page while the assistant is not built (ADR 0017). It says so first and
   plainly, gives examples of what the assistant will answer for this sector, and says how every
   answer will be held to the figures.

   Nothing on it may look like a working assistant: there is no box to type in, no button to
   send, no conversation and no answer. Each example question leads to the screen that answers
   it today. */

export interface PlannedQuestion {
  question: string;
  /** The screen that answers it today. */
  today: { label: string; href: string };
}

const HOW = [
  { title: "One assistant for the platform", text: "The same AI layer serves every sector. It is not a separate product inside each one." },
  { title: "This sector's own tools", text: "Each sector registers tools that wrap its own services, one to one. The assistant can ask only what those services already answer." },
  { title: "Every answer cites the figures", text: "A number in an answer is the service's own result, shown with its status and origin and a link to its source and method. Where the engine says insufficient data, so will the assistant." },
  { title: "It sees what you may see", text: "The assistant is given the viewer's scope, like the map. It cannot read, count or total anything outside it." },
  { title: "Never a source of facts", text: "AI explains and points. It replaces no calculation, and nothing it writes is stored or shown as measured or calculated data." },
];

export function AssistantPlanned({ sector, questions }: { sector: string; questions: PlannedQuestion[] }) {
  return (
    <div className="space-y-4" data-assistant-planned>
      <SectorBand eyebrow={sector} title="AI Assistant" aside={<PlannedTag>Planned · not built</PlannedTag>}>
        This assistant is not built yet. Nothing on this page can be asked a question, and nothing on it is an answer.
      </SectorBand>

      <Panel title="What it will answer here" aside="Examples only">
        <ul className="divide-y divide-line/60" data-planned-questions>
          {questions.map((one) => (
            <li key={one.question} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
              <p className="text-sm leading-snug text-ink">“{one.question}”</p>
              <p className="text-caption text-ink-4">
                Answered today on{" "}
                <Link href={one.today.href} className="font-medium text-link hover:text-link-hover hover:underline">
                  {one.today.label} →
                </Link>
              </p>
            </li>
          ))}
        </ul>
        <p className="text-caption leading-snug text-ink-4">These are examples of questions, not a working feature. Until the assistant is built, the screens named beside them hold the answers, each figure with its source and method.</p>
      </Panel>

      <Panel title="How it will work" aside="Decided in ADR 0017">
        <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2" data-planned-how>
          {HOW.map((rule) => (
            <li key={rule.title}>
              <p className="text-sm font-semibold text-ink">{rule.title}</p>
              <p className="mt-0.5 text-caption leading-snug text-ink-4">{rule.text}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
