import { notFound } from "next/navigation";
import { BackLink, PublicFrame } from "@/components/front/PublicFrame";
import { ChargingNetworkPlanned, MeterApplicationShell, MinigridSummary, SignInHandoff } from "@/components/front/PublicViews";
import { PreparingData } from "@/components/system/PreparingData";
import { frontDoor, tenantSignInHref } from "@/composition/initiatives";
import { initiativeHref, NIGERIAN_STATES, TRACK_PATH } from "@/constants/frontDoor";
import { INITIATIVES } from "@/constants/initiatives";
import { frontDoorParams, frontDoorPreparing } from "../../../front";

export const generateStaticParams = frontDoorParams(() => INITIATIVES.flatMap((initiative) => initiative.roles.map((role) => ({ initiative: initiative.id, role: role.id }))));

async function body(page: NonNullable<ReturnType<typeof frontDoor.rolePage>>) {
  if (page.kind === "sign-in") return <SignInHandoff handoff={page.view} />;
  if (page.view.view === "meter-application") return <MeterApplicationShell discos={frontDoor.discoOptions()} states={NIGERIAN_STATES} trackHref={TRACK_PATH} />;
  if (page.view.view === "charging-network") return <ChargingNetworkPlanned states={NIGERIAN_STATES} />;
  return <MinigridSummary summary={await frontDoor.minigridSummary()} />;
}

/* A role's page: a public role's view, or, for an organization role, sign in or the demo workspace. */
export default async function RolePage({ params }: { params: Promise<{ initiative: string; role: string }> }) {
  if (await frontDoorPreparing()) return <PreparingData />;
  const { initiative, role } = await params;
  const page = frontDoor.rolePage(initiative, role);
  if (page === null) notFound();
  return (
    <PublicFrame signInHref={tenantSignInHref()}>
      <div className="space-y-4">
        <BackLink href={initiativeHref(initiative)}>Who are you?</BackLink>
        {await body(page)}
      </div>
    </PublicFrame>
  );
}
