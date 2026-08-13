import { generateText, Output } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectDayContext } from "@/lib/blog/collectDayContext";
import { getDayRange, getDigestNow } from "@/lib/blog/dayRange";
import {
  dayContextHasSignal,
  filterDayContext,
  type DigestSelection,
} from "@/lib/blog/digestSelection";
import { parseAiSummary } from "@/lib/blog/parseDayContext";
import { buildStaticSummaries } from "@/lib/blog/staticDigest";
import type { DayContext } from "@/lib/blog/types";
import type { BlogPost } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureLayoutSnapshot } from "@/lib/dashboard/layoutSnapshot";

function dayHasSignal(context: DayContext): boolean {
  return (
    context.notes.length > 0 ||
    context.completed_tasks.length > 0 ||
    context.priorities.length > 0 ||
    context.mood !== null ||
    context.calendar.length > 0 ||
    context.habits.some((h) => h.completed) ||
    (context.water !== null && context.water.glasses > 0) ||
    context.time_tracking.length > 0
  );
}

const summarySchema = z.object({
  private_summary: z
    .string()
    .describe(
      "Markdown day summary for the owner. Warm, specific, 2–5 short paragraphs. Use all private context.",
    ),
  public_summary: z
    .string()
    .describe(
      "Markdown summary safe to publish. Use ONLY public notes and optional weather. No mood, calendar, tasks, or private notes. If little public content, write 1–2 gentle sentences without inventing details.",
    ),
});

const DEFAULT_MODEL = "poolside/laguna-s-2.1-free";

function publicContextSlice(context: DayContext) {
  return {
    post_date: context.post_date,
    weather: context.weather,
    public_notes: context.notes
      .filter((n) => n.visibility === "public")
      .map((n) => ({ content: n.content, created_at: n.created_at })),
  };
}

function privateContextSlice(context: DayContext) {
  return {
    post_date: context.post_date,
    timezone: context.timezone,
    location: context.location,
    notes: context.notes.map((n) => ({
      content: n.content,
      visibility: n.visibility,
      created_at: n.created_at,
    })),
    completed_tasks: context.completed_tasks,
    priorities: context.priorities,
    mood: context.mood,
    weather: context.weather,
    calendar: context.calendar,
    habits: context.habits,
    water: context.water,
    time_tracking: context.time_tracking,
  };
}

function parseSummaryJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const parsed = summarySchema.safeParse(JSON.parse(candidate));
  if (!parsed.success) {
    throw new Error("Model returned invalid summary JSON");
  }
  return parsed.data;
}

async function writeSummaries(context: DayContext) {
  const model = process.env.BLOG_MODEL ?? DEFAULT_MODEL;
  const prompt = [
    "You write a personal end-of-day blog entry from structured life-dashboard data.",
    "Respond with ONLY valid JSON (no markdown fences) matching:",
    '{"private_summary":"...","public_summary":"..."}',
    "private_summary — for the owner only; weave notes, completed todos, priorities, mood, weather, calendar, habits/water, and time tracking sessions (minutes). Do not invent facts. Warm, specific, 2–5 short markdown paragraphs.",
    "public_summary — for strangers; ONLY public notes + weather. Never mention private notes, mood scores, calendar event titles, tasks, or priorities. If little public content, write 1–2 gentle sentences without inventing details.",
    "",
    "FULL (private) CONTEXT JSON:",
    JSON.stringify(privateContextSlice(context)),
    "",
    "PUBLIC-SAFE CONTEXT JSON:",
    JSON.stringify(publicContextSlice(context)),
  ].join("\n");

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: summarySchema }),
      prompt,
    });
    if (output) return { ...output, model };
  } catch {
    // Some free-tier models reject structured output; fall back to plain JSON text.
  }

  const { text } = await generateText({ model, prompt });
  return { ...parseSummaryJson(text), model };
}

export type GenerateDailyBlogResult = {
  created: boolean;
  updated: boolean;
  post: BlogPost | null;
  reason?: string;
};

async function ensureDigestLayoutSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  snapshotDate: string,
) {
  const { data: dashboards } = await supabase
    .from("dashboards")
    .select("id, is_default")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const defaultDashboard =
    dashboards?.find((d) => d.is_default) ?? dashboards?.[0] ?? null;
  if (!defaultDashboard) return;

  const { data: panels } = await supabase
    .from("dashboard_panels")
    .select("panel_type, config, x, y, w, h")
    .eq("dashboard_id", defaultDashboard.id)
    .order("y", { ascending: true })
    .order("x", { ascending: true });

  await ensureLayoutSnapshot(supabase, {
    userId,
    dashboardId: defaultDashboard.id,
    snapshotDate,
    panels: panels ?? [],
  });
}

/** Upsert a factual static day post (no LLM). Preserves existing AI summary. */
export async function ensureStaticDayPost(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  location: string | null,
  options: { now?: Date; postDate?: string } = {},
): Promise<GenerateDailyBlogResult> {
  const { range, context } = await collectDayContext(
    supabase,
    userId,
    timezone,
    location,
    { now: options.now, postDate: options.postDate },
  );

  if (!dayHasSignal(context)) {
    return {
      created: false,
      updated: false,
      post: null,
      reason: "empty_day",
    };
  }

  await ensureDigestLayoutSnapshot(supabase, userId, range.postDate);

  const existing = await supabase
    .from("blog_posts")
    .select("id, is_public, day_context, model")
    .eq("user_id", userId)
    .eq("post_date", range.postDate)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const ai = parseAiSummary(existing.data?.day_context);
  const staticSummaries = buildStaticSummaries(context);
  const dayContextPayload: Record<string, unknown> = ai
    ? { ...context, ai_summary: ai }
    : { ...context };
  const generatedAt = new Date().toISOString();
  const payload = {
    private_summary: staticSummaries.private_summary,
    public_summary: staticSummaries.public_summary,
    notes_snapshot: context.notes,
    day_context: dayContextPayload,
    model: ai?.model ?? null,
    generated_at: generatedAt,
  };

  if (existing.data) {
    const update = await supabase
      .from("blog_posts")
      .update(payload)
      .eq("id", existing.data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (update.error) throw update.error;
    return {
      created: false,
      updated: true,
      post: update.data as BlogPost,
    };
  }

  const insert = await supabase
    .from("blog_posts")
    .insert({
      user_id: userId,
      post_date: range.postDate,
      is_public: false,
      ...payload,
    })
    .select("*")
    .single();

  if (insert.error) {
    if (insert.error.code === "23505") {
      return {
        created: false,
        updated: false,
        post: null,
        reason: "already_exists",
      };
    }
    throw insert.error;
  }

  return { created: true, updated: false, post: insert.data as BlogPost };
}

/** Write/replace AI reflection only; refreshes static post first. */
export async function writeDayAiSummary(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  location: string | null,
  options: {
    postDate: string;
    selection: DigestSelection;
  },
): Promise<GenerateDailyBlogResult> {
  const ensured = await ensureStaticDayPost(
    supabase,
    userId,
    timezone,
    location,
    { postDate: options.postDate },
  );

  if (!ensured.post && ensured.reason === "empty_day") {
    return ensured;
  }

  const { context: fullContext } = await collectDayContext(
    supabase,
    userId,
    timezone,
    location,
    { postDate: options.postDate },
  );
  const filtered = filterDayContext(fullContext, options.selection);

  if (!dayContextHasSignal(filtered)) {
    return {
      created: false,
      updated: false,
      post: ensured.post,
      reason: "empty_day",
    };
  }

  const ai = await writeSummaries(filtered);
  const existing = await supabase
    .from("blog_posts")
    .select("id, day_context")
    .eq("user_id", userId)
    .eq("post_date", options.postDate)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (!existing.data) {
    return {
      created: false,
      updated: false,
      post: null,
      reason: "empty_day",
    };
  }

  const dayContextPayload = {
    ...fullContext,
    ai_summary: {
      private_summary: ai.private_summary,
      public_summary: ai.public_summary,
      model: ai.model,
    },
  };

  const update = await supabase
    .from("blog_posts")
    .update({
      day_context: dayContextPayload,
      model: ai.model,
      generated_at: new Date().toISOString(),
    })
    .eq("id", existing.data.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (update.error) throw update.error;
  return {
    created: false,
    updated: true,
    post: update.data as BlogPost,
  };
}

export async function runDailyBlogCron(now = new Date()) {
  const supabase = createAdminClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, timezone, location");

  if (error) throw error;

  type ProfileRow = {
    id: string;
    timezone: string | null;
    location: string | null;
  };

  const list = (profiles ?? []) as ProfileRow[];

  const results: {
    userId: string;
    postDate: string;
    created: boolean;
    updated: boolean;
    reason?: string;
  }[] = [];

  for (const profile of list) {
    const timezone = profile.timezone || "America/Los_Angeles";
    const digestNow = getDigestNow(timezone, now);
    if (!digestNow) {
      continue;
    }

    const range = getDayRange(timezone, digestNow);

    try {
      const result = await ensureStaticDayPost(
        supabase,
        profile.id,
        timezone,
        profile.location,
        { now: digestNow },
      );
      results.push({
        userId: profile.id,
        postDate: range.postDate,
        created: result.created,
        updated: result.updated,
        reason: result.reason,
      });
    } catch (err) {
      console.error("[daily-blog] failed for", profile.id, err);
      results.push({
        userId: profile.id,
        postDate: range.postDate,
        created: false,
        updated: false,
        reason: err instanceof Error ? err.message : "error",
      });
    }
  }

  return {
    checked: list.length,
    attempted: results.length,
    created: results.filter((r) => r.created).length,
    updated: results.filter((r) => r.updated).length,
    results,
  };
}
