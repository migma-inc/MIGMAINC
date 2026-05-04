import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getMigmaEnv() {
  const url =
    Deno.env.get("MIGMA_REMOTE_URL") ||
    Deno.env.get("REMOTE_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
    Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Supabase URL/service role não configurados para a função.");
  }

  return { url, key };
}

/**
 * migma-payment-completed (V15)
 *
 * Modos:
 *  - Pagamento Completo  : chamado pelo webhook Parcelow/Stripe/Zelle quando pagamento é confirmado
 *  - finalize_contract_only: chamado pelo frontend após step 2 (upload de documentos)
 *
 * Responsabilidades:
 *  1. Registrar pagamento em individual_fee_payments          (só pagamento completo)
 *  2. Atualizar user_profiles (paid=true, preço, service_type)  (só pagamento completo)
 *  3. Garantir client + service_request no CRM
 *  4. Criar ou atualizar visa_order com documentos e status
 *  5. Popular identity_files a partir de student_documents     (sempre que SR ID disponível)
 *  6. Disparar geração dos 3 PDFs
 *  7. Sincronizar com Matricula USA                           (só pagamento completo)
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function triggerPdfs(migmaUrl: string, migmaKey: string, orderId: string) {
  const endpoints = [
    "generate-visa-contract-pdf",
    "generate-annex-pdf",
    "generate-invoice-pdf",
  ];
  Promise.allSettled(
    endpoints.map((fn) =>
      fetch(`${migmaUrl}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${migmaKey}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      })
    )
  ).then((results) => {
    const failed = results.filter((r) => r.status === "rejected").length;
    console.log(
      `[PDF] Triggers enviados para ordem ${orderId}. Falhas: ${failed}/3`
    );
  });
}

async function upsertIdentityFiles(
  migma: ReturnType<typeof createClient>,
  serviceRequestId: string,
  docs: Array<{ type: string; file_url: string; original_filename?: string; file_size_bytes?: number }>
) {
  const typeMap: Record<string, string> = {
    passport: "document_front",
    passport_back: "document_back",
    selfie_with_doc: "selfie_doc",
  };

  const rows = docs
    .filter((d) => typeMap[d.type])
    .map((d) => ({
      service_request_id: serviceRequestId,
      file_type: typeMap[d.type],
      file_path: d.file_url,
      file_name: d.original_filename || d.type,
      file_size: d.file_size_bytes || 0,
    }));

  if (rows.length === 0) return;

  const { error } = await migma
    .from("identity_files")
    .upsert(rows, { onConflict: "service_request_id,file_type" });

  if (error) {
    console.error(`[identity_files] upsert falhou: ${error.message}`);
  } else {
    console.log(`[identity_files] ✅ ${rows.length} doc(s) sincronizados para SR ${serviceRequestId}`);
  }
}

async function resolveProfile(
  migma: ReturnType<typeof createClient>,
  userOrProfileId: string,
) {
  const { data: profile, error } = await migma
    .from("user_profiles")
    .select("id, user_id")
    .or(`user_id.eq.${userOrProfileId},id.eq.${userOrProfileId}`)
    .maybeSingle();

  if (error || !profile?.id) {
    console.warn(`[migma-payment-completed] profile not found for id ${userOrProfileId}`);
    return null;
  }

  return profile as { id: string; user_id: string | null };
}

async function notifyByProfile(
  migma: ReturnType<typeof createClient>,
  migmaUrl: string,
  migmaKey: string,
  trigger: "selection_fee_paid" | "placement_fee_paid",
  profileId: string,
  data: Record<string, unknown> = {},
) {
  try {
    const notifyRes = await fetch(`${migmaUrl}/functions/v1/migma-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${migmaKey}`,
        "apikey": migmaKey,
      },
      body: JSON.stringify({
        trigger,
        user_id: profileId,
        data,
      }),
    });

    if (!notifyRes.ok) {
      console.warn(`[migma-payment-completed] notify ${trigger} failed: ${notifyRes.status} ${await notifyRes.text()}`);
    } else {
      console.log(`[migma-payment-completed] ✅ notify ${trigger} dispatched for profile ${profileId}`);
    }
  } catch (err: any) {
    console.warn(`[migma-payment-completed] notify ${trigger} failed: ${err.message}`);
  }
}

// ─── Handler principal ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const { url: migmaUrl, key: migmaKey } = getMigmaEnv();
  const migma = createClient(migmaUrl, migmaKey);

  const matriculaUrl = Deno.env.get("MATRICULAUSA_URL");
  const matriculaKey = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");

  try {
    const body = await req.json();

    const {
      user_id,
      fee_type,
      amount,
      net_amount,   // valor líquido do serviço (ex: $850) — sem a taxa do cartão
      fee_amount,   // taxa do cartão repassada ao aluno (ex: $33.45)
      payment_method,
      receipt_url,
      service_type,
      service_request_id,
      num_dependents,
      finalize_contract_only,
    } = body;

    // Guardar ID do pagamento para resposta final
    const amountNum = Number(amount) || 0;
    const netAmountNum = Number(net_amount) || null;
    const feeAmountNum = Number(fee_amount) || null;

    // Construir payment_metadata com decomposição correta de valores
    // Isso evita que o dashboard use o fallback legacy de 3.5% sobre o gross
    const paymentMetadata: Record<string, unknown> = {
      payment_method,
      completed_at: new Date().toISOString(),
    };
    if (feeAmountNum !== null && feeAmountNum > 0) paymentMetadata.fee_amount = feeAmountNum;
    if (netAmountNum !== null && netAmountNum > 0) paymentMetadata.net_amount_usd = netAmountNum;
    if (amountNum > 0) paymentMetadata.gross_amount_usd = amountNum;

    console.log(
      `[V15] 📥 user=${user_id} | fee=${fee_type} | gross=${amountNum} | net=${netAmountNum} | fee_val=${feeAmountNum} | method=${payment_method} | sr=${service_request_id ?? "—"} | finalize_only=${!!finalize_contract_only}`
    );

    let paymentRecordId: string | null = null;

    // ── BLOCO 1: Registro de pagamento e atualização de perfil ───────────────
    if (!finalize_contract_only) {
      const { data: paymentRecord, error: payErr } = await migma
        .from("individual_fee_payments")
        .insert({
          user_id,
          fee_type,
          amount: amountNum,
          method: payment_method,
          payment_method,
          receipt_url,
          status:
            payment_method === "zelle" || payment_method === "manual"
              ? "pending"
              : "completed",
          payment_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (payErr) {
        console.error(`[individual_fee_payments] insert falhou: ${payErr.message}`);
      } else {
        paymentRecordId = paymentRecord?.id ?? null;
        console.log(`[individual_fee_payments] ✅ Registro criado: ${paymentRecordId}`);
      }

      const resolvedProfile = await resolveProfile(migma, user_id);

      if (fee_type === "selection_process") {
        const profileUpdate: Record<string, unknown> = {
          has_paid_selection_process_fee: true,
          onboarding_current_step: "selection_survey",
          selection_process_fee_payment_method: payment_method,
        };
        // Só atualiza preço se veio um valor real (protege contra sobrescrever com 0)
        if (amountNum > 0) profileUpdate.total_price_usd = amountNum;
        if (service_type) profileUpdate.service_type = service_type;
        if (num_dependents !== undefined && num_dependents !== null) {
          profileUpdate.num_dependents = Number(num_dependents);
        }

        const updateQuery = migma
          .from("user_profiles")
          .update(profileUpdate);
        const { error: profErr } = resolvedProfile?.id
          ? await updateQuery.eq("id", resolvedProfile.id)
          : await updateQuery.eq("user_id", user_id);

        if (profErr) {
          console.error(`[user_profiles] update falhou: ${profErr.message}`);
        } else {
          console.log(
            `[user_profiles] ✅ selection_process: paid=true | price=${amountNum > 0 ? amountNum : "preservado"}`
          );
          if (resolvedProfile?.id) {
            await notifyByProfile(migma, migmaUrl, migmaKey, "selection_fee_paid", resolvedProfile.id);
          }
        }
      }

      // 🎯 NOVO: Tratar Placement Fee (V11)
      if (fee_type === "placement_fee" || fee_type === "placement-fee") {
        console.log(`[V11] 🎓 Processando baixa de Placement Fee para user ${user_id}...`);

        if (!resolvedProfile?.id) {
          console.error(`[user_profiles] update placement_fee falhou: profile not found for ${user_id}`);
        } else {
          const { error: profErr } = await migma
            .from("user_profiles")
            .update({
              is_placement_fee_paid: true,
            })
            .eq("id", resolvedProfile.id);

          if (profErr) console.error(`[user_profiles] update placement_fee falhou: ${profErr.message}`);
          else await notifyByProfile(migma, migmaUrl, migmaKey, "placement_fee_paid", resolvedProfile.id);
        }

        // 2. Atualizar institution_applications se ID disponível
        if (body.application_id) {
          const { error: appErr } = await migma
            .from("institution_applications")
            .update({
              status: "payment_confirmed",
              placement_fee_paid_at: new Date().toISOString()
            })
            .eq("id", body.application_id);

          if (appErr) {
            console.error(`[institution_applications] status paid falhou: ${appErr.message}`);
          } else {
            console.log(`[institution_applications] ✅ status=payment_confirmed para app ${body.application_id}`);
          }
        }
      }
    } else if (
      // finalize_only=true: webhook fired before visa_order existed, so paid flag may be false.
      // If payment_method is an automatic gateway (not manual/zelle), ensure flag is set.
      fee_type === "selection_process" &&
      payment_method !== "zelle" &&
      payment_method !== "manual"
    ) {
      const { data: currentProfile } = await migma
        .from("user_profiles")
        .select("has_paid_selection_process_fee")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!currentProfile?.has_paid_selection_process_fee) {
        const { error: profErr } = await migma
          .from("user_profiles")
          .update({
            has_paid_selection_process_fee: true,
            onboarding_current_step: "selection_survey",
            selection_process_fee_payment_method: payment_method,
          })
          .eq("user_id", user_id);

        if (profErr) {
          console.error(`[user_profiles] finalize_only: update paid flag falhou: ${profErr.message}`);
        } else {
          console.log(`[user_profiles] ✅ has_paid_selection_process_fee=true (finalize_only path) para ${user_id}`);
        }
      } else {
        console.log(`[user_profiles] ℹ️ has_paid_selection_process_fee já era true (finalize_only)`);
      }
    }

    // ── BLOCO 2: Lógica de contrato (visa_orders + PDFs) ─────────────────────
    if (fee_type === "selection_process") {
      try {
        const { data: profile, error: profileErr } = await migma
          .from("user_profiles")
          .select("full_name, email, phone, country, num_dependents, signature_url, student_process_type, migma_seller_id")
          .eq("user_id", user_id)
          .single();

        if (profileErr || !profile) {
          console.error(`[user_profiles] perfil não encontrado para ${user_id}`);
          throw new Error("Perfil não encontrado");
        }

        const type = service_type || profile.student_process_type || "transfer";
        const productSlug = `${type}-selection-process`;
        const orderNumber = `MIGMA-${type.toUpperCase()}-${Date.now().toString().slice(-6)}`;

        // Preço do produto (fallback seguro)
        const { data: product } = await migma
          .from("visa_products")
          .select("base_price_usd, price_per_dependent_usd")
          .eq("slug", productSlug)
          .maybeSingle();

        // 2a. Garantir cliente no CRM
        let clientId: string | null = null;
        const { data: existingClient } = await migma
          .from("clients")
          .select("id")
          .eq("email", profile.email)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
          console.log(`[clients] encontrado: ${clientId}`);
        } else {
          const { data: newClient, error: cliErr } = await migma
            .from("clients")
            .insert({
              full_name: profile.full_name,
              email: profile.email,
              phone: profile.phone,
              country: profile.country,
            })
            .select("id")
            .single();

          if (cliErr) {
            console.error(`[clients] insert falhou: ${cliErr.message}`);
          } else {
            clientId = newClient?.id ?? null;
            console.log(`[clients] ✅ criado: ${clientId}`);
          }
        }

        // 2b. Garantir service_request no CRM (necessário antes do FK em identity_files)
        if (service_request_id) {
          const { error: srErr } = await migma
            .from("service_requests")
            .upsert(
              {
                id: service_request_id,
                client_id: clientId,
                service_id: productSlug,
                service_type: type,
                owner_user_id: user_id,
                dependents_count: profile.num_dependents || 0,
                status:
                  payment_method === "zelle" || payment_method === "manual"
                    ? "pending_payment"
                    : "paid",
                workflow_stage: "case_created",
                payment_method: payment_method,
              },
              { onConflict: "id" }
            );

          if (srErr) {
            console.error(`[service_requests] upsert falhou: ${srErr.message}`);
          } else {
            console.log(`[service_requests] ✅ garantida: ${service_request_id}`);
          }
        }

        // 2c. Buscar documentos do aluno
        const { data: docs } = await migma
          .from("student_documents")
          .select("type, file_url, original_filename, file_size_bytes")
          .eq("user_id", user_id);

        const passportDoc = docs?.find((d) => d.type === "passport")?.file_url ?? null;
        const passportBackDoc = docs?.find((d) => d.type === "passport_back")?.file_url ?? null;
        const selfieDoc = docs?.find((d) => d.type === "selfie_with_doc")?.file_url ?? null;

        console.log(
          `[student_documents] passport=${!!passportDoc} | back=${!!passportBackDoc} | selfie=${!!selfieDoc}`
        );

        // 2d. Popular identity_files (FK só funciona após service_request garantida)
        if (service_request_id && docs && docs.length > 0) {
          await upsertIdentityFiles(migma, service_request_id, docs);
        }

        // 2e. Verificar se já existe visa_order — prioridade: SR ID > email
        let existingOrder: { id: string } | null = null;

        if (service_request_id) {
          const { data } = await migma
            .from("visa_orders")
            .select("id")
            .eq("service_request_id", service_request_id)
            .maybeSingle();
          existingOrder = data;
          if (existingOrder) console.log(`[visa_orders] encontrada por SR ID: ${existingOrder.id}`);
        }

        if (!existingOrder && profile.email) {
          const { data } = await migma
            .from("visa_orders")
            .select("id")
            .eq("client_email", profile.email)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingOrder = data;
          if (existingOrder) console.log(`[visa_orders] encontrada por email: ${existingOrder.id}`);
        }

        if (existingOrder) {
          // ── Atualizar ordem existente ────────────────────────────────────
          const orderUpdate: Record<string, unknown> = {
            contract_document_url: passportDoc,
            contract_document_back_url: passportBackDoc,
            contract_selfie_url: selfieDoc,
          };

          if (service_request_id) orderUpdate.service_request_id = service_request_id;
          if (profile.migma_seller_id) orderUpdate.seller_id = profile.migma_seller_id;

          // Atualiza status e preço apenas em pagamento real (não no finalize_only)
          if (!finalize_contract_only) {
            orderUpdate.payment_status =
              payment_method === "zelle" || payment_method === "manual"
                ? "manual_pending"
                : "completed";
            orderUpdate.paid_at =
              payment_method === "parcelow" ||
              payment_method === "parcelow_card" ||
              payment_method === "parcelow_pix" ||
              payment_method === "stripe"
                ? new Date().toISOString()
                : null;
            if (amountNum > 0) orderUpdate.total_price_usd = amountNum;
            // Salvar decomposição gross/net/fee no payment_metadata para o dashboard exibir corretamente
            if (Object.keys(paymentMetadata).length > 2) orderUpdate.payment_metadata = paymentMetadata;
          }

          const { error: updateErr } = await migma
            .from("visa_orders")
            .update(orderUpdate)
            .eq("id", existingOrder.id);

          if (updateErr) {
            console.error(`[visa_orders] update falhou: ${updateErr.message}`);
          } else {
            console.log(
              `[visa_orders] ✅ atualizada: ${existingOrder.id} | docs=${!!passportDoc}/${!!passportBackDoc}/${!!selfieDoc} | finalize_only=${!!finalize_contract_only}`
            );
          }

          triggerPdfs(migmaUrl, migmaKey, existingOrder.id);

          return new Response(
            JSON.stringify({ success: true, order_id: existingOrder.id, updated: true }),
            { headers: { ...CORS, "Content-Type": "application/json" } }
          );
        }

        // ── Criar nova visa_order ────────────────────────────────────────────
        console.log(`[visa_orders] Nenhuma ordem encontrada. Criando nova...`);

        const { data: visaOrder, error: orderErr } = await migma
          .from("visa_orders")
          .insert({
            order_number: orderNumber,
            product_slug: productSlug,
            client_name: profile.full_name,
            client_email: profile.email,
            client_whatsapp: profile.phone,
            client_country: profile.country,
            payment_method: payment_method,
            payment_status:
              payment_method === "zelle" || payment_method === "manual"
                ? "manual_pending"
                : "completed",
            base_price_usd: product?.base_price_usd || 400.0,
            price_per_dependent_usd: product?.price_per_dependent_usd || 150.0,
            total_price_usd: amountNum,
            number_of_dependents: profile.num_dependents || 0,
            signature_image_url: profile.signature_url,
            contract_document_url: passportDoc,
            contract_document_back_url: passportBackDoc,
            contract_selfie_url: selfieDoc,
            contract_accepted: true,
            contract_signed_at: new Date().toISOString(),
            service_request_id: service_request_id ?? null,
            seller_id: profile.migma_seller_id || null,
            contract_approval_status: "pending",
            annex_approval_status: "pending",
            // Salvar decomposição gross/net/fee para o dashboard calcular corretamente
            payment_metadata: Object.keys(paymentMetadata).length > 2 ? paymentMetadata : undefined,
          })
          .select()
          .single();

        if (orderErr || !visaOrder) {
          console.error(`[visa_orders] insert falhou: ${orderErr?.message}`);
        } else {
          console.log(
            `[visa_orders] ✅ criada: ${visaOrder.id} | docs=${!!passportDoc}/${!!passportBackDoc}/${!!selfieDoc} | price=${amountNum}`
          );
          triggerPdfs(migmaUrl, migmaKey, visaOrder.id);
        }
      } catch (contractErr: any) {
        console.error(`[contrato] Falha geral: ${contractErr.message}`);
      }

    }

    return new Response(
      JSON.stringify({ success: true, payment_id: paymentRecordId }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[V15] ❌ Erro crítico: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
