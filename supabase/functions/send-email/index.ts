// Supabase Edge Function to send emails via Resend
// This function runs on the server, avoiding CORS issues

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@^6.5.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { to, subject, html, from } = await req.json();

    console.log("[EDGE FUNCTION] Sending email to:", to);

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const { data, error } = await resend.emails.send({
      from: from || "onboarding@resend.dev",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[EDGE FUNCTION] Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to send email" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("[EDGE FUNCTION] Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[EDGE FUNCTION] Exception:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});

