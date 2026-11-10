import { InitiativeGrid } from "@/components/front/Initiatives";
import { PublicFrame } from "@/components/front/PublicFrame";
import { PreparingData } from "@/components/system/PreparingData";
import { frontDoor, tenantSignInHref } from "@/composition/initiatives";
import { frontDoorPreparing } from "./front";

/* Home, for anyone: the initiatives, each with one headline figure from a service. No rail, no
   report, no login. */
export default async function PreviewHomePage() {
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
