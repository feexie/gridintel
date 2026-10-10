import { spatial } from "@/composition/spatial";

/* The outlines of every state, or every LGA, for the map to draw as orientation. The map asks
   for a level when its layer is switched on, so the 774 LGAs are not sent with every page.

   Built with the application and served as a file: administrative boundaries are public
   reference geography, the same for every viewer and every dataset. No figure and no asset is
   in the response. Each response carries the credit its licence requires. */

export const dynamic = "force-static";
export const dynamicParams = false;

const LEVELS = ["state", "lga"] as const;

export function generateStaticParams() {
  return LEVELS.map((kind) => ({ kind }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }): Promise<Response> {
  const { kind } = await params;
  const level = LEVELS.find((candidate) => candidate === kind);
  if (level === undefined) return Response.json({ error: "No such level of area." }, { status: 404 });
  return Response.json(await spatial.outlines(level));
}
