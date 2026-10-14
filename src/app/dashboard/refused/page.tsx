import Link from "next/link";
import { homeFor, navigationFor } from "@/constants/access";
import { getViewer } from "@/composition/runtime";

/* What a viewer is shown, with 403, at an address their grant does not open (src/proxy.ts;
   ADR 0018). It says the screen is not theirs and nothing about what is on it. */
export default function RefusedPage() {
  const home = homeFor(navigationFor(getViewer().screens));
  return (
    <div className="rounded-panel border border-line bg-panel p-4 text-sm text-ink-3" data-refused>
      <h1 className="font-semibold text-ink">Not open to you</h1>
      <p className="mt-1 text-ink-4">Your access does not include this screen. Ask the person who manages access in your organization.</p>
      {home === null ? null : (
        <Link href={home} className="mt-2 inline-block text-link hover:underline">
          Go to your start
        </Link>
      )}
    </div>
  );
}
