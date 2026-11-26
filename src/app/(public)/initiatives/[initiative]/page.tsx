import { notFound } from "next/navigation";
import { InitiativePage } from "@/components/front/InitiativePage";
import { BackLink, PublicFrame } from "@/components/front/PublicFrame";
import { PreparingData } from "@/components/system/PreparingData";
import { frontDoor, tenantSignInHref } from "@/composition/initiatives";
import { PUBLIC_HOME } from "@/constants/frontDoor";
import { INITIATIVES } from "@/constants/initiatives";
import { frontDoorParams, frontDoorPreparing } from "@/app/(public)/front";

export const generateStaticParams = frontDoorParams(() => INITIATIVES.map((initiative) => ({ initiative: initiative.id })));

/* An initiative's own page (brief 3c.1; NAV-B step 7): what it is, who it is for, its status flow,
   who takes part, its figures with their status and source, and one button, Take part. */
export default async function InitiativeOwnPage({ params }: { params: Promise<{ initiative: string }> }) {
  if (await frontDoorPreparing()) return <PreparingData />;
  const page = await frontDoor.initiativePage((await params).initiative);
  if (page === null) notFound();
  return (
    <PublicFrame signInHref={tenantSignInHref()}>
      <div className="space-y-4">
        <BackLink href={PUBLIC_HOME}>All initiatives</BackLink>
        <InitiativePage page={page} />
      </div>
    </PublicFrame>
  );
}
