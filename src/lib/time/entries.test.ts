import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { elapsedMs, formatDuration } from "@/lib/time/entries";

describe("formatDuration", () => {
  it("formats under an hour as m:ss", () => {
    assert.equal(formatDuration(65_000), "1:05");
  });

  it("formats hours as h:mm:ss", () => {
    assert.equal(formatDuration(3_661_000), "1:01:01");
  });
});

describe("elapsedMs", () => {
  it("uses ended_at when present", () => {
    const start = "2026-08-10T12:00:00.000Z";
    const end = "2026-08-10T12:30:00.000Z";
    assert.equal(elapsedMs(start, end), 30 * 60_000);
  });
});
