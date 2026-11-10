import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tenantSignInHref } from "./signIn.ts";

describe("where Sign in leads from the public demonstration (ADR 0021)", () => {
  it("leads to the tenant's sign-in page when an https address is set", () => {
    assert.equal(tenantSignInHref("https://tenant.example.org/login"), "https://tenant.example.org/login");
  });

  it("treats an unset, non-https or malformed address as unset", () => {
    for (const value of [undefined, "", "http://tenant.example.org/login", "javascript:alert(1)", "/login", "not a url"]) assert.equal(tenantSignInHref(value), null, String(value));
  });
});
