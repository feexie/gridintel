import type { Status } from "@/types/common";

type StatusBadgeProps = {
  status: Status;
};

const statusStyles: Record<Status, string> = {
  online:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",

  offline:
    "border-slate-500/30 bg-slate-500/10 text-slate-300",

  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-300",

  fault:
    "border-red-500/30 bg-red-500/10 text-red-300",

  maintenance:
    "border-sky-500/30 bg-sky-500/10 text-sky-300",

  unknown:
    "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

const statusLabels: Record<Status, string> = {
  online: "Online",
  offline: "Offline",
  warning: "Warning",
  fault: "Fault",
  maintenance: "Maintenance",
  unknown: "Unknown",
};

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
