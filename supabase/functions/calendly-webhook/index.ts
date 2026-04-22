import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, calendly-webhook-signature",
};

// Calendly sends webhooks for these events:
// invitee.created → new booking
// invitee.canceled → cancellation

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();

    const event = body?.event as string | undefined;
    const payload = body?.payload ?? {};

    console.log(`[calendly-webhook] event=${event}`);

    // Only process new bookings
    if (event !== "invitee.created") {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: `event=${event}` }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Extract tracking params from Calendly payload
    // Calendly sends utm params under payload.tracking
    const tracking = payload.tracking ?? {};
    const uniqueCode: string | null =
      tracking.utm_content ??   // preferred: ref code in utm_content
      tracking.utm_source ??    // fallback
      payload.utm_content ??
      null;

    const calendlyEventId: string | null = payload.event ?? payload.uri ?? null;
    const inviteeName: string | null = payload.name ?? null;
    const inviteeEmail: string | null = payload.email ?? null;
    const eventType: string | null = payload.event_type?.name ?? null;
    const scheduledAt: string | null = payload.scheduled_event?.start_time ?? null;

    console.log(`[calendly-webhook] unique_code=${uniqueCode} invitee=${inviteeEmail}`);

    // Find referral_link by unique_code
    let ownerProfileId: string | null = null;
    let resolvedCode: string | null = uniqueCode;

    if (uniqueCode) {
      const { data: refLink } = await supabase
        .from("referral_links")
        .select("id, profile_id, closures_count")
        .eq("unique_code", uniqueCode)
        .maybeSingle();

      if (refLink) {
        ownerProfileId = refLink.profile_id;

        // Increment closures_count
        const newCount = (refLink.closures_count ?? 0) + 1;
        await supabase
          .from("referral_links")
          .update({ closures_count: newCount })
          .eq("id", refLink.id);

        console.log(`[calendly-webhook] closures_count updated to ${newCount} for profile ${ownerProfileId}`);

        // TODO (Fase 9): if newCount >= 10 → call Square subscription cancellation
        // await supabase.functions.invoke("cancel-square-subscription", {
        //   body: { profile_id: ownerProfileId }
        // });

        // Notify client via migma-notify (when env secrets configured)
        if (newCount >= 10) {
          await supabase.functions.invoke("migma-notify", {
            body: {
              trigger: "referral_goal_reached",
              user_id: ownerProfileId,
              data: { closures_count: newCount },
            },
          }).catch(() => {}); // stub — migma-notify may be inactive
        } else {
          await supabase.functions.invoke("migma-notify", {
            body: {
              trigger: "new_referral_closed",
              user_id: ownerProfileId,
              data: {
                referral_name: inviteeName ?? "Indicação",
                closures_count: newCount,
              },
            },
          }).catch(() => {}); // stub
        }
      } else {
        console.warn(`[calendly-webhook] No referral_link found for code=${uniqueCode}`);
        resolvedCode = null;
      }
    }

    // Log the event regardless
    await supabase
      .from("calendly_events")
      .upsert({
        unique_code:       resolvedCode,
        owner_profile_id:  ownerProfileId,
        calendly_event_id: calendlyEventId,
        invitee_name:      inviteeName,
        invitee_email:     inviteeEmail,
        event_type:        eventType,
        scheduled_at:      scheduledAt,
        raw_payload:       body,
      }, { onConflict: "calendly_event_id", ignoreDuplicates: true });

    return new Response(
      JSON.stringify({
        ok: true,
        unique_code: resolvedCode,
        owner_profile_id: ownerProfileId,
        invitee_email: inviteeEmail,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[calendly-webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: CORS }
    );
  }
});
