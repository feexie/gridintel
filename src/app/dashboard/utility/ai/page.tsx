import { AssistantPlanned } from "@/components/ai/AssistantPlanned";
import { hrefOf } from "@/constants/views";

/* Utility's AI Assistant: planned, not built (ADR 0017). The page holds no data and no figure. */
export default function UtilityAssistantPage() {
  return (
    <AssistantPlanned
      sector="Utility Intelligence"
      questions={[
        { question: "Which feeder lost the most revenue this month, and is the loss commercial or collection?", today: { label: "Revenue", href: hrefOf("utility.revenue") } },
        { question: "What is in progress on the network right now, and how many customers are behind it?", today: { label: "Events / Alarms", href: hrefOf("utility.events") } },
        { question: "Which transformers were loaded above their rating, and for how many hours?", today: { label: "Assets", href: hrefOf("utility.assets") } },
        { question: "Does a substation's reported SAIDI match the outage log, and if not, why?", today: { label: "Reliability", href: hrefOf("utility.reliability") } },
      ]}
    />
  );
}
