import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampPomodoroMinutes,
  completeToastMessage,
  isPomodoroComplete,
  modeLabel,
  plannedSecondsForMode,
  remainingMs,
  resolvePomodoroConfig,
} from "@/lib/time/pomodoro";

describe("clampPomodoroMinutes", () => {
  it("floors positive values and falls back for invalid", () => {
    assert.equal(clampPomodoroMinutes(25.9, 25), 25);
    assert.equal(clampPomodoroMinutes(0, 25), 25);
    assert.equal(clampPomodoroMinutes(-1, 5), 5);
    assert.equal(clampPomodoroMinutes("x", 15), 15);
    assert.equal(clampPomodoroMinutes(undefined, 25), 25);
  });
});

describe("resolvePomodoroConfig", () => {
  it("applies defaults and clamps", () => {
    assert.deepEqual(resolvePomodoroConfig(undefined), {
      focusMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
    });
    assert.deepEqual(
      resolvePomodoroConfig({
        pomodoroFocusMin: 30,
        pomodoroShortBreakMin: 0,
        pomodoroLongBreakMin: 20,
      }),
      { focusMin: 30, shortBreakMin: 5, longBreakMin: 20 },
    );
  });
});

describe("plannedSecondsForMode", () => {
  it("converts minutes to seconds", () => {
    const mins = resolvePomodoroConfig({ pomodoroFocusMin: 25 });
    assert.equal(plannedSecondsForMode("focus", mins), 25 * 60);
    assert.equal(plannedSecondsForMode("short_break", mins), 5 * 60);
    assert.equal(plannedSecondsForMode("long_break", mins), 15 * 60);
  });
});

describe("remainingMs / isPomodoroComplete", () => {
  it("counts down and completes at/after planned end", () => {
    const start = "2026-08-11T12:00:00.000Z";
    const planned = 25 * 60;
    const t0 = Date.parse(start);
    assert.equal(remainingMs(start, planned, t0), 25 * 60_000);
    assert.equal(remainingMs(start, planned, t0 + 60_000), 24 * 60_000);
    assert.equal(remainingMs(start, planned, t0 + 25 * 60_000), 0);
    assert.equal(isPomodoroComplete(start, planned, t0 + 25 * 60_000 - 1), false);
    assert.equal(isPomodoroComplete(start, planned, t0 + 25 * 60_000), true);
  });
});

describe("labels", () => {
  it("returns UI and toast copy", () => {
    assert.equal(modeLabel("focus"), "Focus");
    assert.equal(modeLabel("short_break"), "Short break");
    assert.equal(modeLabel("long_break"), "Long break");
    assert.equal(modeLabel("stopwatch"), "Timer");
    assert.equal(completeToastMessage("focus"), "Focus complete");
    assert.equal(completeToastMessage("short_break"), "Break complete");
    assert.equal(completeToastMessage("long_break"), "Break complete");
  });
});
