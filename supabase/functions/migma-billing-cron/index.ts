import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cron schedule sugerido: todo dia as 09:00 UTC.
// Antes de habilitar no remoto, conferir JWT/function config e pedir aprovacao.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function addOneMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() !== originalDay) d.setDate(0);
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("REMOTE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET_KEY") ?? "";
  const isAuthorized = auth.includes(supabaseKey) || (cronSecret && auth.includes(cronSecret));
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: charges, error: chargesError } = await supabase
      .from("recurring_charges")
      .select(`
        id, profile_id, application_id, monthly_usd, installments_total,
        installments_paid, next_billing_date,
        user_profiles!inner(full_name, email, whatsapp)
      `)
      .eq("status", "active")
      .lte("next_billing_date", today);

    if (chargesError) throw chargesError;

    const results: Array<{ id: string; ok: boolean; installment?: number; reason?: string }> = [];

    for (const charge of charges ?? []) {
      const paidCount = Number(charge.installments_paid ?? 0);
      const total = Number(charge.installments_total ?? 0);

      if (paidCount >= total) {
        await supabase
          .from("recurring_charges")
          .update({ status: "completed", end_date: today })
          .eq("id", charge.id);
        results.push({ id: charge.id, ok: true, reason: "already_completed" });
        continue;
      }

      const { data: latestPayment } = await supabase
        .from("recurring_charge_payments")
        .select("installment_number")
        .eq("charge_id", charge.id)
        .order("installment_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const installmentNumber = Number(latestPayment?.installment_number ?? 0) + 1;
      if (installmentNumber > total) {
        results.push({ id: charge.id, ok: false, reason: "all_installments_scheduled" });
        continue;
      }

      const dueDate = charge.next_billing_date ?? today;
      const nextDate = addOneMonth(dueDate);

      const { error: paymentInsertError } = await supabase
        .from("recurring_charge_payments")
        .insert({
          charge_id: charge.id,
          application_id: charge.application_id,
          profile_id: charge.profile_id,
          installment_number: installmentNumber,
          amount_usd: charge.monthly_usd,
          provider: "manual",
          status: "pending",
          due_date: dueDate,
          metadata: {
            source: "migma-billing-cron",
            note: "Gateway agnostico: link/baixa deve ser tratado por fluxo aprovado separado.",
          },
        });

      if (paymentInsertError) {
        results.push({ id: charge.id, ok: false, installment: installmentNumber, reason: paymentInsertError.message });
        continue;
      }

      await supabase
        .from("recurring_charges")
        .update({ next_billing_date: nextDate })
        .eq("id", charge.id);

      await supabase.functions.invoke("migma-notify", {
        body: {
          trigger: "billing_installment_due",
          user_id: charge.profile_id,
          data: {
            installment_number: installmentNumber,
            installments_total: total,
            monthly_usd: charge.monthly_usd,
            next_billing_date: nextDate,
          },
        },
      }).catch(() => {});

      console.log(`[migma-billing-cron] charge=${charge.id} installment=${installmentNumber} pending`);
      results.push({ id: charge.id, ok: true, installment: installmentNumber });
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[migma-billing-cron] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: CORS,
    });
  }
});
