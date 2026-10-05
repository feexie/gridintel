import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { OPERATIONS } from "./routes";

/* What a visitor gets from a server that has only just started. The other tests wait for the
   server to be ready (global-setup.ts), so this one starts a server of its own, on another
   port, and asks it for a data screen from the moment it listens. */

const PORT = 3211;
const BASE = `http://localhost:${PORT}`;
const FEEDER = `${OPERATIONS}/feeders/FD-OLD`;

let server: ChildProcess | undefined;

test.afterAll(() => {
  server?.kill();
});

test("a server that is still warming up answers at once with a preparing page, then with the screen", async ({ page, request }) => {
  test.setTimeout(120_000);
  // Started without a shell, so that it can be stopped.
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { stdio: "ignore" });

  // The first answer the server gives for a data screen, from the moment it accepts a connection.
  let first: { status: number; body: string; tookMs: number } | undefined;
  const deadline = Date.now() + 60_000;
  while (first === undefined) {
    const started = Date.now();
    try {
      const response = await request.get(`${BASE}${FEEDER}`, { timeout: 30_000 });
      first = { status: response.status(), body: await response.text(), tookMs: Date.now() - started };
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // It is the preparing page, not the screen, and it did not wait for the warm-up (several seconds).
  expect(first.status).toBe(200);
  expect(first.body).toContain("data-preparing");
  expect(first.body).toContain("Preparing data");
  expect(first.body).not.toContain("Old Town 11 kV feeder");
  expect(first.tookMs, `the first answer took ${first.tookMs} ms`).toBeLessThan(4_000);
  // It still says what the data is, and it holds no figure.
  expect(first.body).toContain("SYNTHETIC DATA");
  expect(first.body).not.toContain("data-metric");
  expect((await request.get(`${BASE}/api/ready`)).status()).toBe(503);

  // In a browser the page reloads by itself and becomes the screen, with nothing to click.
  await page.goto(`${BASE}${FEEDER}`);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Old Town 11 kV feeder", { timeout: 60_000 });
  await expect(page.locator("[data-preparing]")).toHaveCount(0);
  const ready = await request.get(`${BASE}/api/ready`);
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "ready" });
});
