import { NextResponse } from "next/server";
import { runDailyBlogCron } from "@/lib/blog/generatePost";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDailyBlogCron();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Daily blog cron failed";
    console.error("[cron/daily-blog]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
