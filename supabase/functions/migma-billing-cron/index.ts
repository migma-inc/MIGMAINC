import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cron schedule sugerido: todo dia 1 às 09:00 UTC
// SELECT cron.schedule('migma-billing-cron', '0 9 1 * *',
//   $$SELECT net.http_post(url:='https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/migma-billing-cron',
//     headers:='{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
//     body:='{}'::jsonb) AS request_id$$);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQUARE_BASE_URL = "https://connect.squareup.com";
const SQUARE_SANDBOX_URL = "https://connect.squareupsandbox.com";

function isProduction(): boolean {
  const url = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  return url.includes("ekxftwrjvxtpnqbraszv") && !url.includes("sandbox");
}

async function createSquarePaymentLink(params: {
  amountCents: number;
  profileName: string;
  installmentNumber: number;
  chargeId: string;
}): Promise<string | null> {
  const isProd = isProduction();
  const accessToken = isProd
    ? Deno.env.get("SQUARE_ACCESS_TOKEN_PROD")
    : Deno.env.get("SQUARE_ACCESS_TOKEN_TEST");
  const locationId = isProd
    ? Deno.env.get("SQUARE_LOCATION_ID_PROD")
    : Deno.env.get("SQUARE_LOCATION_ID_TEST");

  if (!accessToken || !locationId) {
    console.warn("[migma-billing-cron] Square credentials missing — skipping payment link");
    return null;
  }

  const baseUrl = isProd ? SQUARE_BASE_URL : SQUARE_SANDBOX_URL;

  const resp = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      idempotency_key: `migma-billing-${params.chargeId}-${params.installmentNumber}`,
      quick_pay: {
        name: `Migma INC — Parcela ${params.installmentNumber}`,
        price_money: { amount: params.amountCents, currency: "USD" },
        location_id: locationId,
      },
    }),
  });

  if (!resp.ok) {
    console.error("[migma-billing-cron] Square error:", await resp.text());
    return null;
  }

  const data = await resp.json();
  return data?.payment_link?.url ?? null;
}

function addOneMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + 1);
  // Overflow: Jan 31 → Mar 2/3 → volta pra Feb 28/29
  if (d.getDate() !== originalDay) d.setDate(0);
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Autorização: service role ou CRON_SECRET_KEY
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET_KEY") ?? "";
  const isAuthorized = auth.includes(supabaseKey) || (cronSecret && auth.includes(cronSecret));
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: charges } = await supabase
      .from("recurring_charges")
      .select(`
        id, profile_id, monthly_usd, installments_total, installments_paid, next_billing_date,
        user_profiles!inner(full_name, email, whatsapp)
      `)
      .eq("status", "active")
      .lte("next_billing_date", today);

    const validCharges = (charges ?? []).filter(
      (c: any) => c.installments_paid < c.installments_total
    );

    console.log(`[migma-billing-cron] ${validCharges.length} charges due on ${today}`);

    const results: { id: string; ok: boolean; link?: string }[] = [];

    for (const charge of validCharges) {
      const installmentNumber = (charge.installments_paid ?? 0) + 1;
      const amountCents = Math.round(charge.monthly_usd * 100);
      const profile = (charge as any).user_profiles;

      const paymentLink = await createSquarePaymentLink({
        amountCents,
        profileName: profile?.full_name ?? "Aluno",
        installmentNumber,
        chargeId: charge.id,
      });

      const nextDate = addOneMonth(charge.next_billing_date);

      // Atualiza next_billing_date (installments_paid sobe ao confirmar pagamento via webhook)
      await supabase
        .from("recurring_charges")
        .update({ next_billing_date: nextDate })
        .eq("id", charge.id);

      // Notifica aluno
      await supabase.functions.invoke("migma-notify", {
        body: {
          trigger: "billing_installment_due",
          user_id: charge.profile_id,
          data: {
            installment_number: installmentNumber,
            amount_usd: charge.monthly_usd,
            payment_link: paymentLink ?? "(link indisponível)",
            next_billing_date: nextDate,
          },
        },
      }).catch(() => {});

      console.log(`[migma-billing-cron] charge=${charge.id} installment=${installmentNumber} link=${paymentLink}`);
      results.push({ id: charge.id, ok: true, link: paymentLink ?? undefined });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[migma-billing-cron] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: CORS,
    });
  }
});
