import Link from "next/link";

export default function OperationsNotFound() {
  return (
    <div className="border border-slate-800 bg-[#0b1220] p-4 text-sm text-slate-300">
      <p className="font-semibold text-white">Not in the registry</p>
      <p className="mt-1 text-slate-400">No asset with that identifier is held in the registry.</p>
      <Link href="/dashboard/utility/operations" className="mt-2 inline-block text-cyan-300 hover:underline">
        Back to Operations
      </Link>
    </div>
  );
}
