import {
  getPromptById,
  REFLECTION_PROMPTS,
  type ReflectionPrompt,
} from "@/lib/reflection/prompts";

export const MAX_REFLECTION_SKIPS = 3;

export type ReflectionDayState = {
  promptId: string;
  usedIds: string[];
  skipsUsed: number;
  awaitingCapture: boolean;
};

export function reflectionStorageKey(userId: string, day: string) {
  return `reflection:${userId}:${day}`;
}

export function clampSkipsUsed(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_REFLECTION_SKIPS, Math.floor(value));
}

export function unusedPrompts(
  usedIds: string[],
  excludeId?: string,
): ReflectionPrompt[] {
  const used = new Set(usedIds);
  return REFLECTION_PROMPTS.filter(
    (prompt) => !used.has(prompt.id) && prompt.id !== excludeId,
  );
}

/** Stable first prompt of the day when nothing is stored yet. */
export function defaultPromptForDay(day: string): ReflectionPrompt {
  if (REFLECTION_PROMPTS.length === 0) {
    throw new Error("No reflection prompts configured");
  }
  let hash = 0;
  for (let i = 0; i < day.length; i += 1) {
    hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  }
  return REFLECTION_PROMPTS[hash % REFLECTION_PROMPTS.length]!;
}

export function pickRandomUnused(
  usedIds: string[],
  excludeId?: string,
  random: () => number = Math.random,
): ReflectionPrompt | null {
  const pool = unusedPrompts(usedIds, excludeId);
  if (pool.length === 0) return null;
  const index = Math.floor(random() * pool.length);
  return pool[Math.min(index, pool.length - 1)]!;
}

export function createInitialDayState(day: string): ReflectionDayState {
  const prompt = defaultPromptForDay(day);
  return {
    promptId: prompt.id,
    usedIds: [],
    skipsUsed: 0,
    awaitingCapture: false,
  };
}

export function normalizeDayState(
  raw: unknown,
  day: string,
): ReflectionDayState {
  const fallback = createInitialDayState(day);
  if (!raw || typeof raw !== "object") return fallback;

  const record = raw as Partial<ReflectionDayState>;
  const promptId =
    typeof record.promptId === "string" && getPromptById(record.promptId)
      ? record.promptId
      : fallback.promptId;
  const usedIds = Array.isArray(record.usedIds)
    ? record.usedIds.filter(
        (id): id is string =>
          typeof id === "string" && Boolean(getPromptById(id)),
      )
    : [];
  const skipsUsed = clampSkipsUsed(
    typeof record.skipsUsed === "number" ? record.skipsUsed : 0,
  );
  const awaitingCapture = Boolean(record.awaitingCapture);

  return { promptId, usedIds, skipsUsed, awaitingCapture };
}

export function markPromptUsed(
  state: ReflectionDayState,
  promptId: string,
): ReflectionDayState {
  if (state.usedIds.includes(promptId)) return state;
  return { ...state, usedIds: [...state.usedIds, promptId] };
}

export function advanceAfterCapture(
  state: ReflectionDayState,
  random: () => number = Math.random,
): ReflectionDayState {
  const withUsed = markPromptUsed(state, state.promptId);
  const next =
    pickRandomUnused(withUsed.usedIds, undefined, random) ??
    REFLECTION_PROMPTS[
      Math.floor(random() * REFLECTION_PROMPTS.length)
    ]!;
  return {
    ...withUsed,
    promptId: next.id,
    awaitingCapture: false,
  };
}

export function skipCurrentPrompt(
  state: ReflectionDayState,
  random: () => number = Math.random,
): ReflectionDayState | null {
  if (state.skipsUsed >= MAX_REFLECTION_SKIPS) return null;
  const withUsed = markPromptUsed(state, state.promptId);
  const next = pickRandomUnused(withUsed.usedIds, undefined, random);
  if (!next) {
    return {
      ...withUsed,
      skipsUsed: clampSkipsUsed(state.skipsUsed + 1),
      awaitingCapture: false,
    };
  }
  return {
    ...withUsed,
    promptId: next.id,
    skipsUsed: clampSkipsUsed(state.skipsUsed + 1),
    awaitingCapture: false,
  };
}

export function remainingSkips(skipsUsed: number): number {
  return MAX_REFLECTION_SKIPS - clampSkipsUsed(skipsUsed);
}
