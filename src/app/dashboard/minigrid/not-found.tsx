import Link from "next/link";

export default function MinigridNotFound() {
  return (
    <div className="border border-line bg-panel p-4 text-sm text-ink-3">
      <h1 className="font-semibold text-ink">Not in the site register</h1>
      <p className="mt-1 text-ink-4">No site with that identifier is held in the site register.</p>
      <Link href="/dashboard/minigrid" className="mt-2 inline-block text-link hover:underline">
        Back to Sites
      </Link>
    </div>
  );
}
