import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const apiUrl = Deno.env.get("MATRICULAUSA_API_URL");
  const apiKey = Deno.env.get("MATRICULAUSA_API_KEY");

  if (!apiUrl || !apiKey) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const email = searchParams.get("email");

    if (!userId && !email) {
      return new Response(JSON.stringify({ error: "user_id or email is required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const param = userId
      ? `user_id=${userId}`
      : `email=${encodeURIComponent(email!)}`;

    const response = await fetch(`${apiUrl}/migma-get-student-status?${param}`, {
      method: "GET",
      headers: {
        "x-migma-api-key": apiKey,
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[migma-student-status]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
