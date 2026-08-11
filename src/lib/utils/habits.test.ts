import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  averageMood,
  buildContributionWeeks,
  computeStreak,
  contributionLevel,
  habitRangeWeekCount,
  normalizeHabitDateRange,
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

describe("buildContributionWeeks", () => {
  it("returns weekCount columns of 7 days ending on end week", () => {
    const end = new Date(2026, 7, 10, 12); // Aug 10 2026 (Monday)
    const weeks = buildContributionWeeks(end, 4);
    assert.equal(weeks.length, 4);
    assert.equal(weeks[0].days.length, 7);
    assert.equal(weeks[3].days[1].date, "2026-08-10");
  });

  it("respects activeStart for inRange", () => {
    const end = new Date(2026, 7, 10, 12);
    const activeStart = new Date(2026, 7, 4, 12);
    const weeks = buildContributionWeeks(end, 2, activeStart);
    const dates = weeks.flatMap((w) => w.days);
    assert.equal(dates.find((d) => d.date === "2026-08-03")?.inRange, false);
    assert.equal(dates.find((d) => d.date === "2026-08-04")?.inRange, true);
    assert.equal(dates.find((d) => d.date === "2026-08-10")?.inRange, true);
  });
});

describe("contributionLevel", () => {
  it("returns 0 when nothing completed", () => {
    assert.equal(contributionLevel(0, 3), 0);
  });

  it("returns 4 when all completed", () => {
    assert.equal(contributionLevel(3, 3), 4);
  });
});

describe("habit range helpers", () => {
  it("defaults to 7d", () => {
    assert.equal(normalizeHabitDateRange(undefined), "7d");
  });

  it("normalizes legacy 90d to 6m", () => {
    assert.equal(normalizeHabitDateRange("90d"), "6m");
  });

  it("maps ranges to week counts", () => {
    assert.equal(habitRangeWeekCount("7d"), 2);
    assert.equal(habitRangeWeekCount("30d"), 5);
    assert.equal(habitRangeWeekCount("6m"), 26);
    assert.equal(habitRangeWeekCount("1y"), 53);
  });
});
