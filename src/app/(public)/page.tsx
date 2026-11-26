import { InitiativeGrid } from "@/components/front/Initiatives";
import { PublicFrame } from "@/components/front/PublicFrame";
import { PreparingData } from "@/components/system/PreparingData";
import { frontDoor, tenantSignInHref } from "@/composition/initiatives";
import { redirect } from "next/navigation";
import { hrefOf } from "@/constants/views";
import { frontDoorPreparing } from "@/app/(public)/front";

/* Home, for anyone (NAV-B step 7: at "/"): the initiatives, each with one headline figure from a
   service. No rail, no report, no login. A tenant deployment has no public layer: "/" leads to its
   dashboard (and so to signing in). */
export default async function HomePage() {
  if (!frontDoor.available()) redirect(hrefOf("platform.home"));
  if (await frontDoorPreparing()) return <PreparingData />;
  return (
    <PublicFrame signInHref={tenantSignInHref()}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">What are you here for?</h1>
          <p className="mt-1 max-w-2xl text-sm leading-snug text-ink-3">
            Pick an initiative, then say who you are. Customers and riders need no account; DisCos, operators, financiers and regulators sign in to their own workspace.
          </p>
        </div>
        <InitiativeGrid cards={await frontDoor.cards()} />
      </div>
    </PublicFrame>
  );
}
