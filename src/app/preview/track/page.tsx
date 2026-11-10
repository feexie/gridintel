import { BackLink, PublicFrame } from "@/components/front/PublicFrame";
import { TrackShell } from "@/components/front/PublicViews";
import { tenantSignInHref } from "@/composition/initiatives";
import { initiativeHref } from "@/constants/frontDoor";
import { frontDoorOnly } from "../front";

/* Track my application: the reference and the phone, and the status only (a shell until MTR-A). */
export default async function TrackPage() {
  await frontDoorOnly();
  return (
    <PublicFrame signInHref={tenantSignInHref()}>
      <div className="space-y-4">
        <BackLink href={initiativeHref("meter-every-customer")}>Meter every customer</BackLink>
        <TrackShell />
      </div>
    </PublicFrame>
  );
}
