import { generateText, Output } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectDayContext } from "@/lib/blog/collectDayContext";
import { getDayRange, getDigestNow } from "@/lib/blog/dayRange";
import type { DayContext } from "@/lib/blog/types";
import type { BlogPost } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

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

const DEFAULT_MODEL = "openai/gpt-4.1-mini";

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

async function writeSummaries(context: DayContext) {
  const model = process.env.BLOG_MODEL ?? DEFAULT_MODEL;

  const { output } = await generateText({
    model,
    output: Output.object({ schema: summarySchema }),
    prompt: [
      "You write a personal end-of-day blog entry from structured life-dashboard data.",
      "Return two markdown summaries:",
      "1) private_summary — for the owner only; weave notes, completed todos, priorities, mood, weather, calendar, habits/water, and time tracking sessions (minutes). Do not invent facts.",
      "2) public_summary — for strangers; ONLY public notes + weather. Never mention private notes, mood scores, calendar event titles, tasks, or priorities.",
      "",
      "FULL (private) CONTEXT JSON:",
      JSON.stringify(privateContextSlice(context)),
      "",
      "PUBLIC-SAFE CONTEXT JSON:",
      JSON.stringify(publicContextSlice(context)),
    ].join("\n"),
  });

  if (!output) {
    throw new Error("Model returned no structured summary");
  }

  return { ...output, model };
}

export async function generateDailyBlogPost(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  location: string | null,
  now = new Date(),
): Promise<{ created: boolean; post: BlogPost | null; reason?: string }> {
  const { range, context } = await collectDayContext(
    supabase,
    userId,
    timezone,
    location,
    now,
  );

  const existing = await supabase
    .from("blog_posts")
    .select("id")
    .eq("user_id", userId)
    .eq("post_date", range.postDate)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) {
    return { created: false, post: null, reason: "already_exists" };
  }

  const hasSignal =
    context.notes.length > 0 ||
    context.completed_tasks.length > 0 ||
    context.priorities.length > 0 ||
    context.mood !== null ||
    context.calendar.length > 0 ||
    context.habits.some((h) => h.completed) ||
    (context.water !== null && context.water.glasses > 0) ||
    context.time_tracking.length > 0;

  if (!hasSignal) {
    return { created: false, post: null, reason: "empty_day" };
  }

  const summaries = await writeSummaries(context);

  const insert = await supabase
    .from("blog_posts")
    .insert({
      user_id: userId,
      post_date: range.postDate,
      private_summary: summaries.private_summary,
      public_summary: summaries.public_summary,
      notes_snapshot: context.notes,
      day_context: context,
      is_public: false,
      model: summaries.model,
      generated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insert.error) {
    if (insert.error.code === "23505") {
      return { created: false, post: null, reason: "already_exists" };
    }
    throw insert.error;
  }

  return { created: true, post: insert.data as BlogPost };
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
      const result = await generateDailyBlogPost(
        supabase,
        profile.id,
        timezone,
        profile.location,
        digestNow,
      );
      results.push({
        userId: profile.id,
        postDate: range.postDate,
        created: result.created,
        reason: result.reason,
      });
    } catch (err) {
      console.error("[daily-blog] failed for", profile.id, err);
      results.push({
        userId: profile.id,
        postDate: range.postDate,
        created: false,
        reason: err instanceof Error ? err.message : "error",
      });
    }
  }

  return {
    checked: list.length,
    attempted: results.length,
    created: results.filter((r) => r.created).length,
    results,
  };
}
