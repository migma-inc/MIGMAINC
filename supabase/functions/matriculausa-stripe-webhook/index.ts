import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^17.3.1";

/**
 * matriculausa-stripe-webhook
 * Recebe eventos de pagamento do Stripe do projeto MatriculaUSA.
 * Usa MATRICULAUSA_STRIPE_WEBHOOK_SECRET_TEST e _PROD para verificar assinatura.
 *
 * Endpoint a registrar no Stripe Dashboard MatriculaUSA:
 * https://<SUPABASE_PROJECT>.supabase.co/functions/v1/matriculausa-stripe-webhook
 *
 * Evento tratado: checkout.session.completed (fee_type = "application_fee")
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function syncApplicationFeeToMatriculaUSA(
  matriculausaClient: any,
  matriculaUserId: string | null,
  email: string,
  paymentMethod: string
) {
  let matriculaProfileId: string | null = null;

  if (matriculaUserId) {
    const { data: mp } = await matriculausaClient
      .from("user_profiles")
      .select("id")
      .eq("user_id", matriculaUserId)
      .maybeSingle();
    matriculaProfileId = mp?.id || null;
  }

  if (!matriculaProfileId && email) {
    const { data: mp } = await matriculausaClient
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    matriculaProfileId = mp?.id || null;
  }

  if (!matriculaProfileId) {
    console.warn("[Sync MatriculaUSA] Perfil não encontrado no MatriculaUSA");
    return;
  }

  const { error: syncErr } = await matriculausaClient
    .from("scholarship_applications")
    .update({
      is_application_fee_paid: true,
      application_fee_payment_method: paymentMethod,
      application_fee_paid_at: new Date().toISOString(),
    })
    .eq("student_id", matriculaProfileId)
    .eq("source", "migma");

  if (syncErr) {
    console.warn("[Sync MatriculaUSA] Erro ao atualizar scholarship_applications:", syncErr.message);
  } else {
    console.log("[Sync MatriculaUSA] ✅ is_application_fee_paid = true no MatriculaUSA para student:", matriculaProfileId);
  }
}

function getAllWebhookSecrets(): Array<{ env: "prod" | "test"; secret: string }> {
  const secrets: Array<{ env: "prod" | "test"; secret: string }> = [];
  const prod = Deno.env.get("MATRICULAUSA_STRIPE_WEBHOOK_SECRET_PROD");
  const test = Deno.env.get("MATRICULAUSA_STRIPE_WEBHOOK_SECRET_TEST");
  if (prod) secrets.push({ env: "prod", secret: prod });
  if (test) secrets.push({ env: "test", secret: test });
  return secrets;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const webhookSecrets = getAllWebhookSecrets();

    if (webhookSecrets.length === 0) {
      throw new Error("No MATRICULAUSA_STRIPE_WEBHOOK_SECRET_TEST or _PROD configured");
    }

    // Tentar verificar com cada secret até um funcionar
    let event: Stripe.Event | null = null;
    let verifiedEnv: "prod" | "test" | null = null;

    for (const { env, secret } of webhookSecrets) {
      try {
        const stripeKey = env === "prod"
          ? (Deno.env.get("MATRICULAUSA_STRIPE_SECRET_KEY_PROD") || "")
          : (Deno.env.get("MATRICULAUSA_STRIPE_SECRET_KEY_TEST") || "");
        const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as any });
        event = stripe.webhooks.constructEvent(rawBody, sig, secret);
        verifiedEnv = env;
        break;
      } catch (_) {
        // Tentar próximo secret
      }
    }

    if (!event || !verifiedEnv) {
      console.warn("[matriculausa-stripe-webhook] Assinatura inválida com todos os secrets configurados");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    console.log(`[matriculausa-stripe-webhook] Evento verificado: ${event.type} (env=${verifiedEnv})`);

    if (event.type !== "checkout.session.completed") {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Verificar que é application_fee pelo metadata
    if (session.metadata?.fee_type !== "application_fee") {
      console.log(`[matriculausa-stripe-webhook] fee_type="${session.metadata?.fee_type}" — ignorado`);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const scholarshipApplicationId = session.metadata?.scholarship_application_id;
    if (!scholarshipApplicationId) {
      console.error("[matriculausa-stripe-webhook] scholarship_application_id ausente no metadata");
      return new Response(JSON.stringify({ error: "Missing scholarship_application_id in metadata" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    console.log(`[matriculausa-stripe-webhook] Confirmando pagamento para application=${scholarshipApplicationId}`);

    // Buscar profile_id via application_fee_stripe_sessions
    const { data: sessionRecord } = await supabase
      .from("application_fee_stripe_sessions")
      .select("profile_id, scholarship_application_id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    const profileId = sessionRecord?.profile_id;

    // 1. Atualizar scholarship_applications
    const { error: appErr } = await supabase
      .from("scholarship_applications")
      .update({ is_application_fee_paid: true })
      .eq("id", scholarshipApplicationId);

    if (appErr) {
      console.error("[matriculausa-stripe-webhook] Erro ao atualizar scholarship_applications:", appErr.message);
    } else {
      console.log("[matriculausa-stripe-webhook] ✅ scholarship_applications.is_application_fee_paid = true");
    }

    // 2. Atualizar user_profiles via profile_id
    if (profileId) {
      const { error: profErr } = await supabase
        .from("user_profiles")
        .update({ is_application_fee_paid: true })
        .eq("id", profileId);

      if (profErr) {
        console.error("[matriculausa-stripe-webhook] Erro ao atualizar user_profiles:", profErr.message);
      } else {
        console.log("[matriculausa-stripe-webhook] ✅ user_profiles.is_application_fee_paid = true");
      }
    } else {
      // Fallback: buscar via user_id no metadata
      const userId = session.metadata?.user_id;
      if (userId) {
        const { error: profErr } = await supabase
          .from("user_profiles")
          .update({ is_application_fee_paid: true })
          .eq("user_id", userId);

        if (profErr) {
          console.error("[matriculausa-stripe-webhook] Erro ao atualizar user_profiles (fallback):", profErr.message);
        } else {
          console.log("[matriculausa-stripe-webhook] ✅ user_profiles.is_application_fee_paid = true (via user_id fallback)");
        }
      }
    }

    // 3. Sync to MatriculaUSA DB
    try {
      const matriculausaUrl = Deno.env.get("MATRICULAUSA_URL");
      const matriculausaKey = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");
      if (matriculausaUrl && matriculausaKey) {
        const matriculausaClient = createClient(matriculausaUrl, matriculausaKey);
        let migmaProfile: { matricula_user_id: string | null; email: string } | null = null;
        if (profileId) {
          const { data } = await supabase
            .from("user_profiles")
            .select("matricula_user_id, email")
            .eq("id", profileId)
            .maybeSingle();
          migmaProfile = data;
        } else if (session.metadata?.user_id) {
          const { data } = await supabase
            .from("user_profiles")
            .select("matricula_user_id, email")
            .eq("user_id", session.metadata.user_id)
            .maybeSingle();
          migmaProfile = data;
        }
        if (migmaProfile) {
          await syncApplicationFeeToMatriculaUSA(
            matriculausaClient,
            migmaProfile.matricula_user_id,
            migmaProfile.email,
            "stripe"
          );
        } else {
          console.warn("[matriculausa-stripe-webhook] Perfil Migma não encontrado para sync MatriculaUSA");
        }
      }
    } catch (syncErr: any) {
      console.warn("[matriculausa-stripe-webhook] Sync MatriculaUSA falhou (não crítico):", syncErr.message);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[matriculausa-stripe-webhook] Erro:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
