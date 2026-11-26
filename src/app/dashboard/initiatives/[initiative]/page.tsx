import { INITIATIVES } from "@/constants/initiatives";
import { aheadOfTime } from "@/app/dashboard/screen";
import { InitiativeInWorkspace } from "../initiativePage";

/* An initiative inside the workspace (NAV-B step 6): its card and the views it shows this type. */
export const generateStaticParams = aheadOfTime(() => INITIATIVES.filter((one) => one.id !== "meter-every-customer").map((one) => ({ initiative: one.id })));

export default async function InitiativePage({ params }: { params: Promise<{ initiative: string }> }) {
  return <InitiativeInWorkspace initiativeId={(await params).initiative} />;
}
