import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateMoodByDay,
  latestMoodLog,
  moodLogStreak,
  moodRangeDayCount,
  moodRangeStartDate,
  normalizeMoodDateRange,
} from "./mood";

describe("normalizeMoodDateRange", () => {
  it("defaults to 7d", () => {
    assert.equal(normalizeMoodDateRange(undefined), "7d");
  });

  it("maps habit ranges to 90d", () => {
    assert.equal(normalizeMoodDateRange("1y"), "90d");
  });
});

describe("moodRangeStartDate", () => {
  it("returns inclusive start for 7d", () => {
    assert.equal(moodRangeStartDate("2026-08-10", "7d"), "2026-08-04");
    assert.equal(moodRangeDayCount("30d"), 30);
  });
});

describe("aggregateMoodByDay", () => {
  it("averages multiple check-ins on the same day", () => {
    const points = aggregateMoodByDay([
      {
        id: "1",
        log_date: "2026-08-10",
        mood: 6,
        energy: 4,
        stress: 8,
        note: null,
      },
      {
        id: "2",
        log_date: "2026-08-10",
        mood: 8,
        energy: 6,
        stress: 4,
        note: null,
      },
      {
        id: "3",
        log_date: "2026-08-09",
        mood: 5,
        energy: null,
        stress: null,
        note: null,
      },
    ]);
    assert.equal(points.length, 2);
    assert.equal(points[0].log_date, "2026-08-09");
    assert.equal(points[1].mood, 7);
    assert.equal(points[1].energy, 5);
    assert.equal(points[1].stress, 6);
    assert.equal(points[1].count, 2);
  });
});

describe("latestMoodLog", () => {
  it("picks the newest logged_at for a day", () => {
    const latest = latestMoodLog(
      [
        {
          id: "a",
          log_date: "2026-08-10",
          logged_at: "2026-08-10T09:00:00.000Z",
          mood: 5,
          energy: 5,
          stress: 5,
          note: null,
        },
        {
          id: "b",
          log_date: "2026-08-10",
          logged_at: "2026-08-10T18:00:00.000Z",
          mood: 8,
          energy: 7,
          stress: 3,
          note: "evening",
        },
      ],
      "2026-08-10",
    );
    assert.equal(latest?.id, "b");
  });
});

describe("moodLogStreak", () => {
  it("counts consecutive logged days ending today", () => {
    const streak = moodLogStreak(
      [
        { id: "1", log_date: "2026-08-08", mood: 5, energy: null, stress: null, note: null },
        { id: "2", log_date: "2026-08-09", mood: 6, energy: null, stress: null, note: null },
        { id: "3", log_date: "2026-08-10", mood: 7, energy: null, stress: null, note: null },
      ],
      "2026-08-10",
    );
    assert.equal(streak, 3);
  });
});
