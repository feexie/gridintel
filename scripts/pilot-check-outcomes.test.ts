import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoVerdict, tenantVerdict } from "./pilot-check-outcomes.ts";

const DEMO = "https://demo.example";
const TENANT = "https://tenant.example";

describe("pilot-check: the demonstration holds no secret", () => {
  it("passes when /dashboard serves", () => {
    assert.equal(demoVerdict({ status: 200, location: "" }, DEMO).outcome, "PASS");
  });

  it("fails when it refuses to serve (503, the secret key is set)", () => {
    const verdict = demoVerdict({ status: 503, location: "" }, DEMO);
    assert.equal(verdict.outcome, "FAIL");
    assert.match(verdict.detail, /SUPABASE_SECRET_KEY/);
  });

  it("fails when /dashboard leads to /login: a tenant build, not the demonstration", () => {
    for (const location of ["/login", `${DEMO}/login`, "/login?next=%2Fdashboard"]) {
      const verdict = demoVerdict({ status: 307, location }, DEMO);
      assert.equal(verdict.outcome, "FAIL");
      assert.match(verdict.detail, /a tenant build, not the demonstration/);
    }
  });

  it("fails on any other answer, naming the status", () => {
    assert.match(demoVerdict({ status: 307, location: "/elsewhere" }, DEMO).detail, /unexpected HTTP 307/);
    assert.match(demoVerdict({ status: 404, location: "" }, DEMO).detail, /unexpected HTTP 404/);
  });
});

describe("pilot-check: the tenant asks for sign-in", () => {
  it("passes when /dashboard leads to /login", () => {
    assert.equal(tenantVerdict({ status: 307, location: "/login" }, TENANT).outcome, "PASS");
  });

  it("fails when /dashboard is served to someone not signed in", () => {
    assert.match(tenantVerdict({ status: 200, location: "" }, TENANT).detail, /not a tenant build/);
  });

  it("fails when it refuses to serve", () => {
    assert.match(tenantVerdict({ status: 503, location: "" }, TENANT).detail, /GRIDINTEL_MODE=tenant/);
  });
});
