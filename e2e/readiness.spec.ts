import { spawn, type ChildProcess } from "node:child_process";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { OPERATIONS, REQUEST_ENV } from "./routes";

/* What a visitor gets from a server that has only just started, on each build (ADR 0012).
   The other tests use servers that are already up, so each test here starts a server of its
   own, on another port, and asks it for a screen from the moment it listens. */

const FEEDER = `${OPERATIONS}/feeders/FD-OLD`;
const servers: ChildProcess[] = [];

test.afterAll(() => {
  for (const server of servers) server.kill();
});

/** Starts `next start` without a shell, so that it can be stopped. */
function start(port: number, env: NodeJS.ProcessEnv): string {
  servers.push(spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], { stdio: "ignore", env }));
  return `http://localhost:${port}`;
}

/** The first answer a server gives for an address, from the moment it accepts a connection, and how long that answer took. */
async function firstAnswer(request: APIRequestContext, url: string): Promise<{ status: number; body: string; ms: number }> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const started = performance.now();
    try {
      const response = await request.get(url, { timeout: 30_000 });
      return { status: response.status(), body: await response.text(), ms: performance.now() - started };
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

test("on request: a server that is still warming up answers at once with a preparing page, then with the screen", async ({ page, request }) => {
  test.setTimeout(120_000);
  const base = start(3211, REQUEST_ENV);
  const first = await firstAnswer(request, `${base}${FEEDER}`);

  // It is the preparing page, not the screen. That it came while the server was still warming,
  // rather than after, is shown by the readiness check below; how fast it comes is not asserted
  // here, because this server shares the machine with the other tests' servers.
  expect(first.status).toBe(200);
  expect(first.body).toContain("data-preparing");
  expect(first.body).toContain("Preparing data");
  expect(first.body).not.toContain("Old Town 11 kV feeder");
  // It still says what the data is, and it holds no figure.
  expect(first.body).toContain("SYNTHETIC DATA");
  expect(first.body).not.toContain("data-metric");
  expect((await request.get(`${base}/api/ready`)).status()).toBe(503);

  // In a browser the page reloads by itself and becomes the screen, with nothing to click.
  await page.goto(`${base}${FEEDER}`);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Old Town 11 kV feeder", { timeout: 60_000 });
  await expect(page.locator("[data-preparing]")).toHaveCount(0);
  const ready = await request.get(`${base}/api/ready`);
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "ready" });
});

test("built ahead: a server that has only just started answers with the screen itself, and never with a preparing page", async ({ request }) => {
  test.setTimeout(120_000);
  const base = start(3213, { ...process.env, GRIDINTEL_RENDER: "" });

  // A network screen is a file: its figures are in the very first answer.
  const feeder = await firstAnswer(request, `${base}${FEEDER}`);
  expect(feeder.status).toBe(200);
  expect(feeder.body).toContain("Old Town 11 kV feeder");
  expect(feeder.body).toContain("data-metric");
  expect(feeder.body).toContain("SYNTHETIC DATA");
  expect(feeder.body).not.toContain("data-preparing");
  // No warm-up was started, and the readiness check says so.
  const ready = await request.get(`${base}/api/ready`);
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "not_started" });

  for (const route of ["/dashboard/utility/executive", "/dashboard/utility/events", "/dashboard/utility/assets/all", `${OPERATIONS}/transformers/DT-GOV-3/all`, OPERATIONS]) {
    const body = await (await request.get(`${base}${route}`)).text();
    expect(body, route).not.toContain("data-preparing");
    expect(body, route).toContain("SYNTHETIC DATA");
  }

  // A service point is not built ahead: its first visit computes that one screen. It comes with
  // its figures, without a preparing page, and well inside the time a visitor will wait. The
  // target on a cold hosted instance is 2 s; this machine is also running the other servers.
  const point = await firstAnswer(request, `${base}${OPERATIONS}/service-points/SP-FRM3-010`);
  expect(point.status).toBe(200);
  expect(point.body).not.toContain("data-preparing");
  expect(point.body).toContain("SP-FRM3-010");
  expect(point.body).toContain("data-metric");
  expect(point.ms, `the first visit to a service point took ${Math.round(point.ms)} ms`).toBeLessThan(4_000);
  // From then on it is a file.
  const again = await firstAnswer(request, `${base}${OPERATIONS}/service-points/SP-FRM3-010`);
  expect(again.ms).toBeLessThan(500);
  // Its warm-up never ran: the first visit did not start one.
  expect(await (await request.get(`${base}/api/ready`)).json()).toEqual({ status: "not_started" });
});

test("the old addresses of the longer lists lead to the new ones", async ({ page }) => {
  await page.goto("/dashboard/utility/revenue?valuation=all");
  await expect(page).toHaveURL(/\/revenue\/all(\?valuation=all)?$/);
  await expect(page.locator("[data-valuation]")).toHaveAttribute("data-valuation", "all");
  await page.goto(`${OPERATIONS}/transformers/DT-OLD-2?rows=all`);
  await expect(page).toHaveURL(/\/transformers\/DT-OLD-2\/all(\?rows=all)?$/);
});
