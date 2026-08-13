import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDayRange,
  getDayRangeForDate,
  isValidPostDate,
} from "@/lib/blog/dayRange";
import { ensureStaticDayPost } from "@/lib/blog/generatePost";
import type { NoteSnapshot } from "@/lib/blog/types";
import { DayDashboard } from "@/components/blog/DayDashboard";
import type { DashboardPanel } from "@/lib/database.types";
import {
  fetchLayoutSnapshot,
  hydratePanelsFromSnapshot,
} from "@/lib/dashboard/layoutSnapshot";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidPostDate(date)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: dashboards }] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone, location")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("dashboards")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const timeZone = profile?.timezone || "UTC";
  const location = profile?.location ?? null;
  const todayDate = getDayRange(timeZone).postDate;
  const range = getDayRangeForDate(timeZone, date);

  // Auto-create/refresh factual day post whenever the day has activity.
  try {
    await ensureStaticDayPost(supabase, user.id, timeZone, location, {
      postDate: date,
    });
  } catch (err) {
    console.error("[blog/date] ensureStaticDayPost", user.id, date, err);
  }

  const { data: post } = await supabase
    .from("blog_posts")
    .select("id, private_summary, is_public, generated_at, model, day_context")
    .eq("user_id", user.id)
    .eq("post_date", date)
    .maybeSingle();

  const defaultDashboard =
    dashboards?.find((d) => d.is_default) ?? dashboards?.[0] ?? null;

  const [{ data: livePanels }, { data: captures }] = await Promise.all([
    defaultDashboard
      ? supabase
          .from("dashboard_panels")
          .select("*")
          .eq("dashboard_id", defaultDashboard.id)
          .order("y", { ascending: true })
          .order("x", { ascending: true })
      : Promise.resolve({ data: [] as DashboardPanel[] }),
    supabase
      .from("captures")
      .select("id, content, visibility, created_at")
      .eq("user_id", user.id)
      .gte("created_at", range.startUtc)
      .lt("created_at", range.endUtc)
      .order("created_at", { ascending: true }),
  ]);

  let panels: DashboardPanel[] = livePanels ?? [];
  if (date !== todayDate && defaultDashboard) {
    const snapshot = await fetchLayoutSnapshot(supabase, user.id, date);
    if (snapshot) {
      panels = hydratePanelsFromSnapshot(snapshot);
    }
  }

  const notes: NoteSnapshot[] = (captures ?? []).map((row) => ({
    id: row.id,
    content: row.content,
    visibility: row.visibility === "public" ? "public" : "private",
    created_at: row.created_at,
  }));

  return (
    <DayDashboard
      userId={user.id}
      date={date}
      todayDate={todayDate}
      timeZone={timeZone}
      location={location}
      post={post}
      panels={panels}
      notes={notes}
    />
  );
}
