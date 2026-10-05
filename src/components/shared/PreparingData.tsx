/* Shown in place of a data screen while the server computes its screens after a start.
   It answers at once and reloads by itself, so no request is held until the data is ready. */

const RELOAD_SECONDS = 2;

export function PreparingData() {
  return (
    <div role="status" data-preparing className="border border-slate-800 bg-[#0b1220] p-4 text-sm text-slate-300">
      {/* Hoisted into the document head: the page asks again without any script. */}
      <meta httpEquiv="refresh" content={String(RELOAD_SECONDS)} />
      <h1 className="font-semibold text-white">Preparing data</h1>
      <p className="mt-1 text-slate-400">
        The server has just started and is calculating its screens from the records. This usually takes a few seconds. This page reloads by itself every {RELOAD_SECONDS}{" "}
        seconds and shows the screen as soon as it is ready.
      </p>
      <p className="mt-1 text-xs text-slate-500">No figure is shown until it has been calculated.</p>
    </div>
  );
}
