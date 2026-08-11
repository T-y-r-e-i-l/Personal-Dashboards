import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoodActivity,
  formatTimeTrackedActivity,
  formatTodoCompletedActivity,
} from "./logActivity";

describe("formatMoodActivity", () => {
  it("includes note and metrics", () => {
    const text = formatMoodActivity({
      mood: 8,
      energy: 6,
      stress: 4,
      note: "Winding down",
    });
    assert.match(text, /Winding down/);
    assert.match(text, /Mood check-in · Mood 8 · Energy 6 · Stress 4/);
  });
});

describe("formatTodoCompletedActivity", () => {
  it("prefixes completed to-do", () => {
    assert.equal(
      formatTodoCompletedActivity("Buy milk"),
      "Completed to-do · Buy milk",
    );
  });
});

describe("formatTimeTrackedActivity", () => {
  it("includes duration and label", () => {
    const text = formatTimeTrackedActivity({
      description: "Deep work",
      startedAt: "2026-08-10T10:00:00.000Z",
      endedAt: "2026-08-10T10:32:15.000Z",
    });
    assert.match(text, /^Tracked 32:15 · Deep work$/);
  });
});
