import { notFound } from "next/navigation";
import { RolePicker } from "@/components/front/Initiatives";
import { BackLink, PublicFrame } from "@/components/front/PublicFrame";
import { frontDoor, tenantSignInHref } from "@/composition/initiatives";
import { initiativeHref } from "@/constants/frontDoor";
import { INITIATIVES } from "@/constants/initiatives";
import { frontDoorOnly, frontDoorParams } from "@/app/(public)/front";

export const generateStaticParams = frontDoorParams(() => INITIATIVES.map((initiative) => ({ initiative: initiative.id })));

/* "Who are you?" for one initiative, one step from its own page (Take part). */
export default async function RolePickerPage({ params }: { params: Promise<{ initiative: string }> }) {
  await frontDoorOnly();
  const picker = frontDoor.rolePicker((await params).initiative);
  if (picker === null) notFound();
  return (
    <PublicFrame signInHref={tenantSignInHref()}>
      <div className="space-y-4">
        <BackLink href={initiativeHref(picker.id)}>{picker.title}</BackLink>
        <RolePicker picker={picker} />
      </div>
    </PublicFrame>
  );
}
