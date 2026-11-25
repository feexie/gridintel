import Link from "next/link";
import { hrefOf } from "@/constants/views";

export default function OperationsNotFound() {
  return (
    <div className="border border-line bg-panel p-4 text-sm text-ink-3">
      <h1 className="font-semibold text-ink">Not in the registry</h1>
      <p className="mt-1 text-ink-4">No asset with that identifier is held in the registry.</p>
      <Link href={hrefOf("utility.operations")} className="mt-2 inline-block text-link hover:underline">
        Back to Operations
      </Link>
    </div>
  );
}
