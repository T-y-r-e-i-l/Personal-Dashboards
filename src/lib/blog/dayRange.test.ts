import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPostDateTitle, getDayRange } from "@/lib/blog/dayRange";

describe("getDayRange", () => {
  it("returns local calendar date and hour for America/Los_Angeles", () => {
    // 2026-08-11 06:30 UTC = 2026-08-10 23:30 PDT
    const now = new Date("2026-08-11T06:30:00.000Z");
    const range = getDayRange("America/Los_Angeles", now);
    assert.equal(range.postDate, "2026-08-10");
    assert.equal(range.localHour, 23);
    assert.ok(new Date(range.startUtc) < now);
    assert.ok(new Date(range.endUtc) > now);
  });

  it("formats post titles from YYYY-MM-DD", () => {
    assert.match(formatPostDateTitle("2026-08-10"), /August 10/);
  });
});
