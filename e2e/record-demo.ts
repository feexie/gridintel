/* Not a test: records the Global Energy Hackathon demo, one scene at a time, for the video.

     npm run geh:record                 every scene
     npm run geh:record -- c e          only scenes c and e

   Starts a dev server on port 3300 (or uses one already running there), then records each scene at
   1920x1080 into docs/geh/recordings/: <letter>-<name>.webm, and a PNG of each key moment. The
   recordings are not committed (.gitignore keeps only the README). Every Metering screen is filmed
   in presentation mode (?present=1); the Planning overview keeps its navigation. Every scene is in
   the dark theme. Nothing on a screen is changed for the camera: Next.js's development badge is
   hidden, a small pointer is drawn where the mouse is (a headless browser films none), and every
   route is loaded once before filming so no scene shows it compiling. The dashboard scrolls inside <main>,
   so the scrolling here moves <main>, not the window. */

import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Page, chromium } from "@playwright/test";

const PORT = 3300;
const BASE = `http://localhost:${PORT}`;
const OUT = join(import.meta.dirname, "..", "docs", "geh", "recordings");
const SIZE = { width: 1920, height: 1080 };
const PLANNING = "/dashboard/planning";
const FUND = `${PLANNING}/metering?case=nigeria&present=1`;

type Scene = { id: string; name: string; path: string; play: (page: Page, shot: (moment: string) => Promise<void>) => Promise<void> };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Scrolls <main> smoothly to a vertical position: about 400 px a second, so a short move reads slowly;
    at least 0.8 s, and at most 3.5 s, so a jump across a long page does not stall the scene. */
async function glideTo(page: Page, top: number) {
  await page.evaluate(async (target) => {
    const main = document.querySelector("main") as HTMLElement;
    const start = main.scrollTop;
    const end = Math.max(0, Math.min(target, main.scrollHeight - main.clientHeight));
    const duration = Math.min(3500, Math.max(800, (Math.abs(end - start) / 400) * 1000));
    const began = performance.now();
    await new Promise<void>((done) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        main.scrollTop = start + (end - start) * eased;
        if (t < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  }, top);
}

/** Glides until the element's top sits a little below the top of the window, then holds. */
async function glideToElement(page: Page, selector: string, hold = 3000, offset = 90) {
  const element = page.locator(selector).first();
  await element.waitFor({ state: "attached" });
  const top = await element.evaluate((node, gap) => {
    const main = document.querySelector("main") as HTMLElement;
    return node.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop - gap;
  }, offset);
  await glideTo(page, top);
  await wait(hold);
}

/** Scrolls <main> on by a distance, smoothly. */
async function glideBy(page: Page, distance: number) {
  await glideTo(page, (await page.evaluate(() => (document.querySelector("main") as HTMLElement).scrollTop)) + distance);
}

/** Moves the pointer onto an element, so the viewer's eye follows it. */
async function point(page: Page, selector: string, hold = 2500) {
  const box = await page.locator(selector).first().boundingBox();
  if (box) await page.mouse.move(box.x + Math.min(box.width / 2, 300), box.y + Math.min(box.height / 2, 24), { steps: 25 });
  await wait(hold);
}

const SCENES: Scene[] = [
  {
    id: "a", name: "about-this-build", path: `${PLANNING}/about-this-build?present=1`,
    play: async (page, shot) => {
      await wait(4000);
      await shot("headline");
      await glideToElement(page, "[data-baseline]", 4000);
      await glideToElement(page, "[data-sprint-rows]", 5000);
      await shot("sprint-commits");
      await glideTo(page, 1e6);
      await wait(4000);
      await glideTo(page, 0);
      await point(page, "[data-compare-link]", 3000);
    },
  },
  {
    id: "b", name: "planning-overview", path: PLANNING,
    play: async (page, shot) => {
      await wait(5000);
      await shot("overview");
      await point(page, '[data-planner="metering"]', 6000);
      await point(page, '[data-planner="dt"]', 3000);
      await point(page, '[data-planning-group]:not(:has([data-planner="metering"])) [data-planner]', 5000);
    },
  },
  {
    id: "c", name: "disco-allocation", path: `${PLANNING}/metering/allocation?present=1`,
    play: async (page, shot) => {
      await wait(4000);
      await shot("headline");
      await glideToElement(page, "[data-first-million]", 3500, 140);
      await glideToElement(page, "[data-discos]", 3000);
      await shot("eleven-discos");
      await glideToElement(page, '[data-disco="enugu"]', 1000, 300);
      await point(page, '[data-disco="enugu"] td:has-text("Never at this pace")', 4500);
      await shot("enugu");
      await glideToElement(page, "[data-split]", 5000);
      await shot("first-million-table");
      await glideToElement(page, "[data-pilot]", 4500);
      await shot("pilot");
    },
  },
  {
    id: "d", name: "dt-sequencing", path: `${PLANNING}/metering/dt?present=1`,
    play: async (page, shot) => {
      await wait(4000);
      await shot("headline");
      await glideToElement(page, '[data-chart="revolving"]', 6000);
      await shot("revolving-chart");
      await glideToElement(page, "[data-dts]", 5000);
      await shot("ranking");
      await glideBy(page, 700);
      await wait(4000);
    },
  },
  {
    id: "e", name: "metering-fund", path: FUND,
    play: async (page, shot) => {
      await wait(2000);
      await shot("headline");
      await glideToElement(page, "[data-headline-pair]", 1000);
      await point(page, "[data-fund-alone]", 2500);
      await shot("fund-alone");
      await point(page, "[data-structure-sentence]", 2500);
      await shot("gridintel-structure");
      await point(page, "[data-structure-failures]", 3500);
      await point(page, "[data-public-per-meter]", 3000);
      await shot("public-per-meter");
      await glideToElement(page, "[data-bands]", 3000);
      await shot("band-charges");
      await glideToElement(page, "[data-impact]", 3000);
      await shot("estimated-bills");
    },
  },
  {
    id: "f", name: "investment-break-even", path: FUND,
    play: async (page, shot) => {
      await glideToElement(page, "[data-investment]", 4000);
      await shot("investment");
      await point(page, '[data-investment-case="Fund alone"]', 4000);
      await point(page, '[data-investment-case="GridIntel structure"]', 4500);
      await glideBy(page, 450);
      await wait(4000);
      await shot("break-even");
    },
  },
  {
    id: "g", name: "shocks-and-reserve", path: FUND,
    play: async (page, shot) => {
      await glideToElement(page, "[data-inflation-line]", 2000, 300);
      await shot("inflation-line");
      await glideToElement(page, "[data-stress]", 1000);
      await point(page, '[data-stress-row="duty"]', 2500);
      await shot("shocks-before");
      await glideToElement(page, "[data-assumptions]", 500);
      const reserve = page.locator("[data-assumptions]").getByLabel(/Duty-shock reserve/);
      await point(page, "[data-assumptions] label:has-text('Duty-shock reserve')", 1000);
      await reserve.check();
      await wait(800);
      const recalculate = page.locator("[data-assumptions]").getByRole("button", { name: "Recalculate" });
      await recalculate.scrollIntoViewIfNeeded();
      await point(page, "[data-assumptions] button[type=submit]", 1000);
      await recalculate.click();
      await page.waitForURL(/dutyReserve=1/);
      await page.locator('[data-stress-row="duty"]').waitFor();
      await wait(700);
      await glideToElement(page, "[data-stress]", 700);
      await point(page, '[data-stress-row="duty"]', 3000);
      await shot("shocks-after-reserve");
    },
  },
  {
    id: "h", name: "investor-protection", path: FUND,
    play: async (page, shot) => {
      await glideToElement(page, "[data-receipt]", 4000, 200);
      await shot("receipt");
      await glideToElement(page, "[data-protection]", 5000);
      await shot("protection");
      await glideToElement(page, "[data-investor]", 5000);
      await shot("investor-outcome");
      await glideBy(page, 500);
      await wait(4000);
    },
  },
  {
    id: "i", name: "monitoring", path: `${PLANNING}/metering/monitoring?present=1`,
    play: async (page, shot) => {
      await wait(4000);
      await shot("headline");
      await point(page, "[data-tranche-line]", 3500);
      await glideToElement(page, "[data-monitoring-table]", 6000);
      await shot("plan-against-actual");
      await glideTo(page, 0);
      const later = page.locator("[data-quarters]").getByRole("link", { name: /2027 Q1/ });
      await point(page, "[data-quarters] a:has-text('2027 Q1')", 1500);
      await later.click();
      await page.locator("[data-not-reported]").waitFor();
      await wait(1000);
      await glideToElement(page, "[data-not-reported]", 5000, 300);
      await shot("not-reported");
    },
  },
  {
    id: "j", name: "marketplace", path: `${PLANNING}/metering/marketplace?present=1`,
    play: async (page, shot) => {
      await wait(4500);
      await shot("headline");
      await point(page, "[data-headline] [data-how]", 3500);
      await glideToElement(page, "[data-totals]", 3000, 160);
      await glideToElement(page, "[data-funders]", 3000, 160);
      await point(page, '[data-queued="yes"]', 3000);
      await shot("funders");
      await glideToElement(page, "[data-band-charges]", 4000, 160);
      await shot("daily-charge");
      await glideToElement(page, "[data-matching]", 4500, 160);
      await shot("matching");
    },
  },
  {
    id: "k", name: "journey", path: `${PLANNING}/metering/journey?present=1`,
    play: async (page, shot) => {
      await wait(5000);
      await shot("headline");
      await glideToElement(page, '[data-step="applied"]', 3000, 160);
      await point(page, '[data-step="priced"]', 3500);
      await shot("priced");
      await glideToElement(page, '[data-step="funded"]', 3500, 160);
      await point(page, '[data-step="installed"] [data-step-link]', 3000);
      await glideToElement(page, '[data-step="repaying"]', 3500, 160);
      await shot("repaying");
      await glideToElement(page, "[data-schedule]", 4500, 160);
      await shot("balance");
    },
  },
];

async function serverAnswers() {
  try {
    return (await fetch(`${BASE}${PLANNING}`)).ok;
  } catch {
    return false;
  }
}

async function startServer(): Promise<ChildProcess | null> {
  if (await serverAnswers()) {
    console.log(`Using the server already running on port ${PORT}.`);
    return null;
  }
  console.log(`Starting a dev server on port ${PORT}...`);
  const server = spawn("npx", ["next", "dev", "-p", String(PORT)], { shell: true, stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    if (await serverAnswers()) return server;
    await wait(1000);
  }
  throw new Error(`The dev server did not answer on port ${PORT} within 120 s.`);
}

function stopServer(server: ChildProcess | null) {
  if (!server?.pid) return;
  // On Windows the server runs under a shell; stop the whole tree.
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}

/* On every page load: hide Next.js's development badge, and draw a small pointer where the mouse is.
   Nothing else on the page is touched. */
const FILMING = `
  addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.head.append(style);
    const pointer = document.createElement("div");
    pointer.setAttribute("aria-hidden", "true");
    pointer.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
      "background:rgba(165,180,252,.35);border:2px solid rgba(255,255,255,.92);box-shadow:0 0 0 2px rgba(79,70,229,.9);pointer-events:none;z-index:2147483647;transition:transform .12s";
    document.body.append(pointer);
    addEventListener("mousemove", (event) => { pointer.style.left = event.clientX + "px"; pointer.style.top = event.clientY + "px"; }, true);
    addEventListener("mousedown", () => { pointer.style.transform = "scale(.7)"; }, true);
    addEventListener("mouseup", () => { pointer.style.transform = ""; }, true);
  });
`;

async function record(browser: Browser, scene: Scene): Promise<{ file: string; seconds: number; shots: string[] }> {
  // The video starts when the context opens, so the length is timed from here.
  const began = Date.now();
  // Filmed in the dark theme: the browser asks for dark, and the saved choice says dark.
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, colorScheme: "dark", recordVideo: { dir: OUT, size: SIZE } });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("gridintel-theme", "dark");
    } catch {
      // No storage: the dark colour scheme above still selects the dark theme.
    }
  });
  await context.addInitScript(FILMING);
  const page = await context.newPage();
  const shots: string[] = [];
  const shot = async (moment: string) => {
    const file = `${scene.id}-${scene.name}--${moment}.png`;
    await page.screenshot({ path: join(OUT, file) });
    shots.push(file);
  };
  await page.goto(`${BASE}${scene.path}`, { waitUntil: "networkidle" });
  await page.mouse.move(SIZE.width - 40, SIZE.height / 2);
  await scene.play(page, shot);
  await wait(1000);
  const seconds = (Date.now() - began) / 1000;
  const video = page.video();
  await context.close();
  const file = `${scene.id}-${scene.name}.webm`;
  rmSync(join(OUT, file), { force: true });
  if (video) renameSync(await video.path(), join(OUT, file));
  return { file, seconds, shots };
}

async function main() {
  const only = process.argv.slice(2);
  const scenes = only.length ? SCENES.filter((scene) => only.includes(scene.id)) : SCENES;
  mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  try {
    // Every route compiled and rendered once before filming.
    for (const path of new Set(scenes.map((scene) => scene.path))) await fetch(`${BASE}${path}`);
    const browser = await chromium.launch();
    const results = [];
    for (const scene of scenes) {
      const result = await record(browser, scene);
      console.log(`${result.file}  ${result.seconds.toFixed(1)} s  (${result.shots.length} PNGs)`);
      results.push(result);
    }
    await browser.close();
    const log = results.map((r) => `${r.file}\t${r.seconds.toFixed(1)} s\t${r.shots.join(", ")}`).join("\n");
    writeFileSync(join(OUT, "last-run.txt"), `${new Date().toISOString()}\n${log}\n`, "utf8");
  } finally {
    stopServer(server);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
