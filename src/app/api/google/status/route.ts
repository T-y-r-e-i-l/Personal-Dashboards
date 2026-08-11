import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleConnection } from "@/lib/google/connection";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = await getGoogleConnection(supabase, user.id);
    return NextResponse.json({
      connected: Boolean(connection),
      email: connection?.email ?? null,
      configured: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
      ),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load status",
        connected: false,
        configured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        ),
      },
      { status: 500 },
    );
  }
}
