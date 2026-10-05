import Link from "next/link";

export default function OperationsNotFound() {
  return (
    <div className="border border-line bg-panel p-4 text-sm text-ink-3">
      <p className="font-semibold text-ink">Not in the registry</p>
      <p className="mt-1 text-ink-4">No asset with that identifier is held in the registry.</p>
      <Link href="/dashboard/utility/operations" className="mt-2 inline-block text-link hover:underline">
        Back to Operations
      </Link>
    </div>
  );
}
