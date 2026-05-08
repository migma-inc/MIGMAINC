import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return jsonResponse({ error: "unauthorized" }, 401);

    const admin = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.id) return jsonResponse({ error: "profile_not_found" }, 404);

    const { data: mentor, error: mentorError } = await admin
      .from("referral_mentors")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();

    if (mentorError) throw mentorError;
    if (!mentor) return jsonResponse({ error: "mentor_not_active" }, 403);

    const { data: refreshToken, error: refreshTokenError } = await admin
      .rpc("service_get_mentor_google_refresh_token", { p_mentor: profile.id });
    if (refreshTokenError) throw refreshTokenError;

    if (refreshToken) {
      const revokeRes = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: String(refreshToken) }),
      });

      if (!revokeRes.ok) {
        console.warn("[mentor-google-disconnect] revoke failed:", await revokeRes.text());
      }
    }

    const { error: deleteError } = await admin
      .rpc("service_delete_mentor_google_connection", { p_mentor: profile.id });
    if (deleteError) throw deleteError;

    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mentor-google-disconnect] error:", message);
    return jsonResponse({ error: "disconnect_failed", message }, 500);
  }
});
