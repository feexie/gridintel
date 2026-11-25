import { DASHBOARD } from "@/constants/views";

/** The characters a dashboard address may hold below the dashboard. */
const BELOW = /^\/[A-Za-z0-9._~%\-/]*$/;

/** Where to go after signing in: a screen of the dashboard named by the page asked for, or nowhere in particular. Never another site. */
export function safeNext(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string" || !value.startsWith(DASHBOARD)) return null;
  const rest = value.slice(DASHBOARD.length);
  return (rest === "" || BELOW.test(rest)) && !value.includes("//") ? value : null;
}
