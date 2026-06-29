import type { Status } from "@/types/common";

type StatusBadgeProps = {
  status: Status;
};

const statusStyles: Record<Status, string> = {
  online: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  offline: "border-slate-500/20 bg-slate-500/10 text-slate-200",
  warning: "border-amber-400/20 bg-amber-400/10 text-amber-100",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
