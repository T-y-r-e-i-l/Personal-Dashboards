import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  averageMood,
  computeStreak,
  waterProgress,
} from "./habits";

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const today = new Date("2026-08-10T12:00:00Z");
    const streak = computeStreak(
      ["2026-08-08", "2026-08-09", "2026-08-10"],
      today,
    );
    assert.equal(streak, 3);
  });

  it("starts from yesterday if today missing", () => {
    const today = new Date("2026-08-10T12:00:00Z");
    const streak = computeStreak(["2026-08-08", "2026-08-09"], today);
    assert.equal(streak, 2);
  });
});

describe("averageMood", () => {
  it("returns null for empty", () => {
    assert.equal(averageMood([]), null);
  });

  it("averages values", () => {
    assert.equal(averageMood([6, 8]), 7);
  });
});

describe("waterProgress", () => {
  it("caps at 100", () => {
    assert.equal(waterProgress(10, 8), 100);
  });

  it("handles zero goal", () => {
    assert.equal(waterProgress(2, 0), 0);
  });
});
