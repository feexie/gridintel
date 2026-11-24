import { notFound } from "next/navigation";
import { RolePicker } from "@/components/front/Initiatives";
import { BackLink, PublicFrame } from "@/components/front/PublicFrame";
import { frontDoor, tenantSignInHref } from "@/composition/initiatives";
import { PREVIEW_HOME } from "@/constants/frontDoor";
import { INITIATIVES } from "@/constants/initiatives";
import { frontDoorOnly, frontDoorParams } from "../../front";

export const generateStaticParams = frontDoorParams(() => INITIATIVES.map((initiative) => ({ initiative: initiative.id })));

/* "Who are you?" for one initiative. */
export default async function RolePickerPage({ params }: { params: Promise<{ initiative: string }> }) {
  await frontDoorOnly();
  const picker = frontDoor.rolePicker((await params).initiative);
  if (picker === null) notFound();
  return (
    <PublicFrame signInHref={tenantSignInHref()}>
      <div className="space-y-4">
        <BackLink href={PREVIEW_HOME}>All initiatives</BackLink>
        <RolePicker picker={picker} />
      </div>
    </PublicFrame>
  );
}
