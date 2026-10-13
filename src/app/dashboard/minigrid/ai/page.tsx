import { AssistantPlanned } from "@/components/ai/AssistantPlanned";
import { MINIGRID_HOME } from "@/constants/navigation";

/* Mini-grid's AI Assistant: planned, not built (ADR 0017). The page holds no data and no figure. */
export default function MinigridAssistantPage() {
  const sites = { label: "Sites", href: `${MINIGRID_HOME}/sites` };
  return (
    <AssistantPlanned
      sector="Mini-grid Intelligence"
      questions={[
        { question: "Which site's report differs from its records, and on which figures?", today: sites },
        { question: "Which site burns the most fuel for each kWh, and how long did its generator run?", today: sites },
        { question: "Where is solar energy being held back for want of demand?", today: sites },
        { question: "Which customer classes owe the revenue that was not collected?", today: sites },
      ]}
    />
  );
}
