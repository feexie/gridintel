import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { accountsEnabled, startingPoint } from "@/composition/identity";
import { safeNext } from "../next";

/* After the second factor: on to the page asked for if it is open to the person, else to their
   first screen. Someone whose membership opens nothing is told so. */
export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!accountsEnabled()) notFound();
  const { next } = await searchParams;
  const start = await startingPoint(safeNext(next));
  if (start !== null) redirect(start);
  return (
    <AuthCard title="Nothing is open to you yet" lead="You are signed in, but your organization has not given you any screen. Ask its administrator.">
      <form action="/auth/signout" method="post">
        <button type="submit" className="gi-tap text-sm text-link hover:underline">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
