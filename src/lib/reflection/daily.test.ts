import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  advanceAfterCapture,
  clampSkipsUsed,
  createInitialDayState,
  defaultPromptForDay,
  MAX_REFLECTION_SKIPS,
  normalizeDayState,
  pickRandomUnused,
  remainingSkips,
  reflectionStorageKey,
  skipCurrentPrompt,
  unusedPrompts,
} from "@/lib/reflection/daily";
import { REFLECTION_PROMPTS } from "@/lib/reflection/prompts";

describe("reflectionStorageKey", () => {
  it("scopes by user and day", () => {
    assert.equal(
      reflectionStorageKey("user-1", "2026-08-12"),
      "reflection:user-1:2026-08-12",
    );
  });
});

describe("clampSkipsUsed / remainingSkips", () => {
  it("clamps to 0..MAX", () => {
    assert.equal(clampSkipsUsed(-1), 0);
    assert.equal(clampSkipsUsed(99), MAX_REFLECTION_SKIPS);
    assert.equal(clampSkipsUsed(1.9), 1);
    assert.equal(remainingSkips(1), MAX_REFLECTION_SKIPS - 1);
  });
});

describe("defaultPromptForDay", () => {
  it("is stable for the same day", () => {
    assert.equal(
      defaultPromptForDay("2026-08-12").id,
      defaultPromptForDay("2026-08-12").id,
    );
  });
});

describe("pickRandomUnused", () => {
  it("never returns used ids", () => {
    const used = REFLECTION_PROMPTS.slice(0, 5).map((p) => p.id);
    for (let i = 0; i < 20; i += 1) {
      const pick = pickRandomUnused(used, undefined, () => 0.42);
      assert.ok(pick);
      assert.equal(used.includes(pick.id), false);
    }
  });

  it("returns null when all used", () => {
    const used = REFLECTION_PROMPTS.map((p) => p.id);
    assert.equal(pickRandomUnused(used), null);
  });
});

describe("unusedPrompts", () => {
  it("excludes current id", () => {
    const current = REFLECTION_PROMPTS[0]!.id;
    const pool = unusedPrompts([], current);
    assert.equal(
      pool.some((p) => p.id === current),
      false,
    );
  });
});

describe("normalizeDayState", () => {
  it("falls back for junk and keeps valid fields", () => {
    const day = "2026-08-12";
    const junk = normalizeDayState(null, day);
    assert.equal(junk.promptId, defaultPromptForDay(day).id);
    assert.deepEqual(junk.usedIds, []);

    const validId = REFLECTION_PROMPTS[2]!.id;
    const ok = normalizeDayState(
      {
        promptId: validId,
        usedIds: [validId, "nope"],
        skipsUsed: 2,
        awaitingCapture: true,
      },
      day,
    );
    assert.equal(ok.promptId, validId);
    assert.deepEqual(ok.usedIds, [validId]);
    assert.equal(ok.skipsUsed, 2);
    assert.equal(ok.awaitingCapture, true);
  });
});

describe("advanceAfterCapture", () => {
  it("marks current used and picks another", () => {
    const state = createInitialDayState("2026-08-12");
    const next = advanceAfterCapture(state, () => 0);
    assert.ok(next.usedIds.includes(state.promptId));
    assert.notEqual(next.promptId, state.promptId);
    assert.equal(next.awaitingCapture, false);
  });
});

describe("skipCurrentPrompt", () => {
  it("increments skips and rotates", () => {
    const state = createInitialDayState("2026-08-12");
    const next = skipCurrentPrompt(state, () => 0);
    assert.ok(next);
    assert.equal(next.skipsUsed, 1);
    assert.ok(next.usedIds.includes(state.promptId));
    assert.notEqual(next.promptId, state.promptId);
  });

  it("returns null when skip budget exhausted", () => {
    const state = {
      ...createInitialDayState("2026-08-12"),
      skipsUsed: MAX_REFLECTION_SKIPS,
    };
    assert.equal(skipCurrentPrompt(state), null);
  });
});
