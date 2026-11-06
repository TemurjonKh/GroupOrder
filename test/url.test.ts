import { expect, it } from "vitest";
import { inviteCodeFrom, safeNext } from "../src/lib/url";

it("only follows same-site redirects", () => {
  expect(safeNext("/g/abc/now")).toBe("/g/abc/now");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "", null, undefined]) {
    expect(safeNext(bad)).toBe("/");
  }
});

it("reads invite codes from a code or a link", () => {
  expect(inviteCodeFrom(" ABC123 ")).toBe("abc123");
  expect(inviteCodeFrom("https://x.app/g/abc123/now?x=1")).toBe("abc123");
});
