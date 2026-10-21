import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { asSystem, deploymentMode, isSystemWork, unsafeConfiguration } from "./mode.ts";

/* A deployment configured unsafely serves nothing (Phase 8A, ADR 0020). */

const NAMES = ["GRIDINTEL_MODE", "GRIDINTEL_BUILT_AS_TENANT", "GRIDINTEL_AUTH", "VERCEL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;
const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));

function environment(values: Partial<Record<(typeof NAMES)[number], string>>) {
  for (const name of NAMES) {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  }
}

afterEach(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("which deployment this is", () => {
  it("is the public demonstration unless it is told it is a tenant deployment", () => {
    environment({});
    assert.equal(deploymentMode(), "demo");
    assert.equal(unsafeConfiguration(), null);
    environment({ GRIDINTEL_MODE: "Tenant" });
    assert.equal(deploymentMode(), "demo");
  });

  it("refuses a demonstration that holds the secret key", () => {
    environment({ SUPABASE_SECRET_KEY: "x" });
    assert.match(unsafeConfiguration() ?? "", /must hold no secret/);
  });

  it("refuses a tenant deployment on a build made ahead of time, or without its Supabase settings", () => {
    environment({ GRIDINTEL_MODE: "tenant" });
    assert.match(unsafeConfiguration() ?? "", /built with GRIDINTEL_MODE=tenant/);
    environment({ GRIDINTEL_MODE: "tenant", GRIDINTEL_BUILT_AS_TENANT: "true" });
    assert.match(unsafeConfiguration() ?? "", /SUPABASE_URL/);
    environment({ GRIDINTEL_MODE: "tenant", GRIDINTEL_BUILT_AS_TENANT: "true", SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "k" });
    assert.equal(unsafeConfiguration(), null);
  });

  it("refuses the in-memory identity adapter on Vercel", () => {
    environment({ GRIDINTEL_MODE: "tenant", GRIDINTEL_BUILT_AS_TENANT: "true", GRIDINTEL_AUTH: "memory" });
    assert.equal(unsafeConfiguration(), null);
    environment({ GRIDINTEL_MODE: "tenant", GRIDINTEL_BUILT_AS_TENANT: "true", GRIDINTEL_AUTH: "memory", VERCEL: "1" });
    assert.match(unsafeConfiguration() ?? "", /must not run on Vercel/);
  });

  it("marks the server's own work, and nothing else, as done for no one", async () => {
    assert.equal(isSystemWork(), false);
    assert.equal(await asSystem(async () => isSystemWork()), true);
    assert.equal(isSystemWork(), false);
  });
});
