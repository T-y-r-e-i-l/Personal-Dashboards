const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export type GoogleTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  source: "google";
  html_link?: string;
};

export class GoogleApiError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.reason = reason;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

export function getGoogleRedirectUri() {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${appUrl}/api/google/callback`;
}

export function buildGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: getGoogleRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }

  return (await res.json()) as GoogleTokens;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GoogleApiError(
      `Google token refresh failed. Disconnect and reconnect Google Calendar. (${text})`,
      res.status,
      "invalid_grant",
    );
  }

  return (await res.json()) as GoogleTokens;
}

export async function fetchGoogleUserEmail(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

function humanizeGoogleCalendarError(
  status: number,
  body: {
    error?: {
      message?: string;
      status?: string;
      errors?: Array<{ reason?: string; message?: string }>;
    };
  },
  raw: string,
) {
  const reason = body.error?.errors?.[0]?.reason ?? body.error?.status;
  const message = body.error?.message ?? raw;

  if (reason === "accessNotConfigured" || message.includes("has not been used")) {
    return "Google Calendar API is not enabled on your Google Cloud project. Enable it in APIs & Services → Library, then retry.";
  }
  if (
    reason === "insufficientPermissions" ||
    reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" ||
    status === 403
  ) {
    return "Missing Calendar permission. Disconnect Google Calendar in Settings, then connect again and allow calendar access.";
  }
  if (status === 401) {
    return "Google session expired. Disconnect and reconnect Google Calendar in Settings.";
  }

  return message || `Google Calendar request failed (${status})`;
}

export async function listGoogleEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/primary/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    let parsed: {
      error?: {
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
    } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      // keep raw text
    }
    const reason = parsed.error?.errors?.[0]?.reason ?? parsed.error?.status;
    throw new GoogleApiError(
      humanizeGoogleCalendarError(res.status, parsed, text),
      res.status,
      reason,
    );
  }

  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      htmlLink?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  };

  return (data.items ?? []).map((item) => {
    const allDay = Boolean(item.start?.date && !item.start?.dateTime);
    const starts_at = item.start?.dateTime ?? item.start?.date ?? timeMin;
    const ends_at = item.end?.dateTime ?? item.end?.date ?? null;
    return {
      id: `google:${item.id}`,
      title: item.summary?.trim() || "(No title)",
      starts_at,
      ends_at,
      all_day: allDay,
      source: "google" as const,
      html_link: item.htmlLink,
    };
  });
}

export function expiresAtFromTokens(tokens: GoogleTokens) {
  if (!tokens.expires_in) return null;
  return new Date(Date.now() + tokens.expires_in * 1000).toISOString();
}
