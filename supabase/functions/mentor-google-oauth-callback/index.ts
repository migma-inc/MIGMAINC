import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type GoogleCalendarResponse = {
  id?: string;
  summary?: string;
  timeZone?: string;
};

const RETURN_PATH = "/mentor/login";
const LOCAL_RETURN_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function allowedReturnOrigins() {
  const appReturnUrl = new URL(requireEnv("APP_RETURN_URL"));
  return new Set([
    appReturnUrl.origin,
    "https://migmainc.com",
    "https://www.migmainc.com",
    ...LOCAL_RETURN_ORIGINS,
  ]);
}

function resolveReturnUrl(returnUrl?: string) {
  const fallback = new URL(RETURN_PATH, new URL(requireEnv("APP_RETURN_URL")).origin);
  if (!returnUrl) return fallback;

  const url = new URL(returnUrl);
  if (!allowedReturnOrigins().has(url.origin)) return fallback;
  url.pathname = RETURN_PATH;
  url.search = "";
  url.hash = "";
  return url;
}

function redirectWith(params: Record<string, string>, returnUrl?: string) {
  const url = resolveReturnUrl(returnUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function base64UrlDecode(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

async function verifyState(state: string) {
  const [payloadB64, signatureB64] = state.split(".");
  if (!payloadB64 || !signatureB64) throw new Error("invalid_state");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requireEnv("OAUTH_STATE_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(payloadB64),
  );

  if (!ok) throw new Error("invalid_state_signature");

  const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
    mentor_id?: string;
    return_url?: string;
    nonce?: string;
    iat?: number;
  };

  if (!payload.mentor_id || !payload.iat) throw new Error("invalid_state_payload");
  if (Date.now() - payload.iat > 10 * 60 * 1000) throw new Error("state_expired");

  return payload as { mentor_id: string; return_url?: string; nonce?: string; iat: number };
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const payload = state ? await verifyState(state) : null;

    if (error) return redirectWith({ google: "error", reason: error }, payload?.return_url);
    if (!code || !state) return new Response("missing code/state", { status: 400 });
    if (!payload) return new Response("missing state", { status: 400 });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("[mentor-google-oauth-callback] token exchange failed:", await tokenRes.text());
      return redirectWith({ google: "error", reason: "token_exchange" }, payload.return_url);
    }

    const tokens = await tokenRes.json() as GoogleTokenResponse;
    if (!tokens.access_token || !tokens.refresh_token) {
      console.error("[mentor-google-oauth-callback] missing token fields:", Object.keys(tokens));
      return redirectWith({ google: "error", reason: "missing_refresh_token" }, payload.return_url);
    }

    const calendarRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );

    if (!calendarRes.ok) {
      console.error("[mentor-google-oauth-callback] calendar lookup failed:", await calendarRes.text());
      return redirectWith({ google: "error", reason: "calendar_lookup" }, payload.return_url);
    }

    const calendar = await calendarRes.json() as GoogleCalendarResponse;
    if (!calendar.id) return redirectWith({ google: "error", reason: "calendar_missing" }, payload.return_url);

    const admin = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const expiresAt = typeof tokens.expires_in === "number"
      ? new Date(Date.now() + Math.max(tokens.expires_in - 60, 0) * 1000).toISOString()
      : null;

    const { error: connectionError } = await admin.rpc("service_upsert_mentor_google_connection", {
      p_mentor: payload.mentor_id,
      p_refresh_token: tokens.refresh_token,
      p_access_token: tokens.access_token,
      p_access_token_expires_at: expiresAt,
      p_scope: tokens.scope ?? null,
      p_calendar_id: calendar.id,
      p_google_account_email: calendar.id,
      p_timezone: calendar.timeZone || "America/Sao_Paulo",
    });
    if (connectionError) throw connectionError;

    return redirectWith({ google: "connected" }, payload.return_url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mentor-google-oauth-callback] error:", message);
    return redirectWith({ google: "error", reason: "callback_failed" });
  }
});
