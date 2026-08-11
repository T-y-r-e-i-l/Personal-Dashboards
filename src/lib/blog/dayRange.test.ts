import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatPostDateTitle,
  getDayRange,
  getDayRangeForDate,
  isValidPostDate,
  shiftPostDate,
} from "@/lib/blog/dayRange";

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

describe("isValidPostDate", () => {
  it("accepts real dates and rejects junk", () => {
    assert.equal(isValidPostDate("2026-08-10"), true);
    assert.equal(isValidPostDate("2026-02-30"), false);
    assert.equal(isValidPostDate("08-10-2026"), false);
  });
});

describe("getDayRangeForDate", () => {
  it("matches getDayRange postDate bounds for that local day", () => {
    const now = new Date("2026-08-11T06:30:00.000Z"); // 2026-08-10 evening PDT
    const fromNow = getDayRange("America/Los_Angeles", now);
    const fromDate = getDayRangeForDate("America/Los_Angeles", "2026-08-10");
    assert.equal(fromDate.postDate, "2026-08-10");
    assert.equal(fromDate.startUtc, fromNow.startUtc);
    assert.equal(fromDate.endUtc, fromNow.endUtc);
  });
});

describe("shiftPostDate", () => {
  it("moves across month boundaries", () => {
    assert.equal(shiftPostDate("2026-08-01", -1), "2026-07-31");
    assert.equal(shiftPostDate("2026-08-10", 1), "2026-08-11");
  });
});
