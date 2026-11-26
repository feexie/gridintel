import { expect, type Page } from "@playwright/test";

/** On the public demonstration, a load with ?workspace= keeps the choice and loads the address again
    without it (components/workspace/DemoWorkspace.tsx). The workspace is settled once the page marks it. */
export async function demoSettled(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-demo-workspace", /.+/);
}
