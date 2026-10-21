/** Where to go after signing in: a screen of the dashboard named by the page asked for, or nowhere in particular. Never another site. */
export function safeNext(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return /^\/dashboard(\/[A-Za-z0-9._~%\-/]*)?$/.test(value) && !value.includes("//") ? value : null;
}
