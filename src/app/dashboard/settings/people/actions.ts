"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { people } from "@/composition/identity";
import { DEPARTMENTS } from "@/constants/departments";
import { PEOPLE_PATH } from "@/constants/navigation";

/* What an organization's administrator does on the people screen (Phase 8A). Each action is
   checked again in the composition root, on the server, against the caller's own membership:
   the form proves nothing. */

type MemberRole = "admin" | "member";

export interface InviteState {
  link: string | null;
  email: string | null;
  error: string | null;
}

const roleOf = (value: FormDataEntryValue | null): MemberRole => (value === "admin" ? "admin" : "member");

function departmentKeys(value: FormDataEntryValue | null): readonly string[] | null {
  const department = DEPARTMENTS.find((one) => one.id === value);
  if (department === undefined) throw new Error("Choose what the person may open.");
  return department.keys;
}

/** The address the invitation's link is made from: this deployment's own. */
async function origin(): Promise<string> {
  const request = await headers();
  const host = request.get("x-forwarded-host") ?? request.get("host") ?? "localhost";
  const protocol = request.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function invite(_previous: InviteState, form: FormData): Promise<InviteState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { link: null, email: null, error: "Enter an email address." };
  try {
    const { tokenHash } = await people.invite(email, roleOf(form.get("role")), departmentKeys(form.get("department")));
    const link = `${await origin()}/auth/confirm?${new URLSearchParams({ token_hash: tokenHash, type: "invite" })}`;
    return { link, email, error: null };
  } catch (error) {
    return { link: null, email: null, error: error instanceof Error ? error.message : "The invitation could not be made." };
  }
}

export async function change(form: FormData): Promise<void> {
  await people.setGrant(String(form.get("userId") ?? ""), roleOf(form.get("role")), departmentKeys(form.get("department")));
  redirect(PEOPLE_PATH);
}

export async function remove(form: FormData): Promise<void> {
  await people.remove(String(form.get("userId") ?? ""));
  redirect(PEOPLE_PATH);
}
