import { notFound } from "next/navigation";
import { connection } from "next/server";
import { frontDoor } from "@/composition/initiatives";
import { aheadOfTime, preparing } from "../dashboard/utility/screen";

/* The front door is served by the public demonstration only (ADR 0021). On a tenant deployment
   every page under /preview is not found, before anything is read, and is rendered on request
   like every other page there, so the tenant build holds none of them (ADR 0020). On a dataset
   that is not fixed, a page with figures shows the preparing page while the server computes
   (ADR 0012). */
export async function frontDoorOnly(): Promise<void> {
  if (frontDoor.available()) return;
  await connection();
  notFound();
}

export async function frontDoorPreparing(): Promise<boolean> {
  await frontDoorOnly();
  return preparing();
}

/** A route's addresses built ahead of time, on the fixed demonstration dataset only. */
export const frontDoorParams = aheadOfTime;
