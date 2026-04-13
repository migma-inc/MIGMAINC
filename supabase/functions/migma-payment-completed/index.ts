import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * migma-payment-completed (V14 - Contract & Order Integration)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const migmaUrl = Deno.env.get("SUPABASE_URL")!;
  const migmaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const migma = createClient(migmaUrl, migmaKey);

  const matriculaUrl = Deno.env.get("MATRICULAUSA_URL");
  const matriculaKey = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");

  try {
    const body = await req.json();
    console.log(`[migma-payment-completed] 📥 BODY RECEBIDO:`, JSON.stringify(body));
    const { user_id, fee_type, amount, payment_method, receipt_url, service_type, service_request_id, finalize_contract_only } = body;

    console.log(`[migma-payment-completed] Processando: ${fee_type} para ${user_id} (Modo: ${finalize_contract_only ? 'Finalizar Contrato' : 'Pagamento Completo'})`);

    let paymentRecordId = null;

    if (!finalize_contract_only) {
      // 1. Registro local no Migma
      const { data: paymentRecord } = await migma
        .from("individual_fee_payments")
        .insert({
          user_id,
          fee_type,
          amount,
          method: payment_method,
          payment_method,
          receipt_url,
          status: (payment_method === "zelle" || payment_method === "manual") ? "pending" : "completed",
          payment_date: new Date().toISOString(),
        })
        .select().single();
      
      paymentRecordId = paymentRecord?.id;

      // 2. Atualizar perfil local
      if (fee_type === "selection_process") {
        console.log(`[migma-payment-completed] 🔄 Atualizando perfil local para user_id: ${user_id}`);
        
        await migma.from("user_profiles").update({
          has_paid_selection_process_fee: true,
          onboarding_current_step: "selection_survey",
          selection_process_fee_payment_method: payment_method,
        }).eq("user_id", user_id);
      }
    }

    // 3. LOGICA DE CONTRATO (MIGMA VISA ORDERS)
    if (fee_type === "selection_process") {
      try {
        console.log(`[migma-payment-completed] Iniciando automação de contrato para ${user_id}...`);
        
        // Buscar dados do perfil
        const { data: profile } = await migma.from("user_profiles")
          .select("full_name, email, phone, country, num_dependents, signature_url, student_process_type")
          .eq("user_id", user_id)
          .single();

        if (profile) {
          const type = service_type || profile.student_process_type || "transfer"; 
          const productSlug = `${type}-selection-process`;
          const orderNumber = `MIGMA-${type.toUpperCase()}-${Date.now().toString().slice(-6)}`;

          // BLINDAGEM: Buscar preços do produto para evitar erros de constraint
          const { data: product } = await migma.from("visa_products")
            .select("base_price_usd, price_per_dependent_usd")
            .eq("slug", productSlug)
            .maybeSingle();

          // 3a. GARANTIR CLIENTE (Vínculo para CRM/ServiceRequests)
          let clientId = null;
          console.log(`[migma-payment-completed] Verificando cliente por email: ${profile.email}`);
          
          const { data: existingClient, error: clientFetchErr } = await migma.from("clients")
            .select("id")
            .eq("email", profile.email)
            .maybeSingle();
          
          if (clientFetchErr) {
            console.error("[migma-payment-completed] Erro ao buscar cliente:", clientFetchErr);
          }

          if (existingClient) {
            clientId = existingClient.id;
            console.log(`[migma-payment-completed] Cliente encontrado: ${clientId}`);
          } else {
            console.log("[migma-payment-completed] Cliente não encontrado. Criando novo...");
            const { data: newClient, error: clientInsertErr } = await migma.from("clients").insert({
               full_name: profile.full_name,
               email: profile.email,
               phone: profile.phone,
               country: profile.country
            }).select("id").single();
            
            if (clientInsertErr) {
              console.error("[migma-payment-completed] Erro crítico ao criar cliente:", clientInsertErr);
            } else if (newClient) {
              clientId = newClient.id;
              console.log(`[migma-payment-completed] Novo cliente criado: ${clientId}`);
            }
          }

          // 3b. GARANTIR SERVICE_REQUEST (SOLUÇÃO ERRO 23503)
          if (service_request_id) {
            console.log(`[migma-payment-completed] Garantindo existência da service_request: ${service_request_id}`);
            
            const srUpsertData = {
              id: service_request_id,
              client_id: clientId,
              service_id: productSlug,
              service_type: type,
              owner_user_id: user_id,
              dependents_count: profile.num_dependents || 0,
              status: (payment_method === "zelle" || payment_method === "manual") ? "pending_payment" : "paid",
              workflow_stage: "case_created",
              payment_method: payment_method
            };

            const { error: srErr } = await migma.from("service_requests").upsert(srUpsertData, { onConflict: 'id' });

            if (srErr) {
              console.error("[migma-payment-completed] FALHA CRÍTICA no upsert service_request:", srErr);
              // Se falhar o upsert, a inserção da visa_orders abaixo certamente falhará pelo FK.
              // Logamos os dados para depuração manual se necessário.
              console.error("[migma-payment-completed] Dados que falharam no upsert:", JSON.stringify(srUpsertData));
            } else {
              console.log("[migma-payment-completed] ✅ service_request garantida.");
            }
          }

          // 3c. EVITAR DUPLICIDADE (SOLUÇÃO DE DUPLICADO)
          const { data: existingOrder } = await migma.from("visa_orders")
            .select("id")
            .eq("service_request_id", service_request_id)
            .maybeSingle();

          if (existingOrder) {
            console.log(`[migma-payment-completed] Ordem já existe para SR ${service_request_id}: ${existingOrder.id}. Ignorando criação duplicada.`);
            return new Response(JSON.stringify({ success: true, order_id: existingOrder.id }), { headers: { ...CORS, "Content-Type": "application/json" } });
          }

          // 3d. BUSCAR DOCUMENTOS (SOLUÇÃO "NO PHOTOS FOUND")
          console.log(`[migma-payment-completed] Buscando fotos para o contrato do usuário ${user_id}...`);
          const { data: docs } = await migma.from("student_documents")
            .select("type, file_url")
            .eq("user_id", user_id);

          const passportDoc = docs?.find(d => d.type === 'passport')?.file_url;
          const selfieDoc = docs?.find(d => d.type === 'selfie_with_doc')?.file_url;

          // 4. Criar auditoria na visa_orders (BRIDGE)
          console.log("[migma-payment-completed] Criando entrada na visa_orders...");
          const { data: visaOrder, error: orderErr } = await migma.from("visa_orders").insert({
            order_number: orderNumber,
            product_slug: productSlug,
            client_name: profile.full_name,
            client_email: profile.email,
            client_whatsapp: profile.phone,
            client_country: profile.country,
            payment_method: payment_method,
            payment_status: (payment_method === "zelle" || payment_method === "manual") ? "manual_pending" : "completed",
            
            // Valores obrigatórios capturados do produto ou fallback seguro
            base_price_usd: product?.base_price_usd || 400.00,
            price_per_dependent_usd: product?.price_per_dependent_usd || 150.00,
            total_price_usd: amount,
            number_of_dependents: profile.num_dependents || 0,
            
            signature_image_url: profile.signature_url,
            contract_document_url: passportDoc, // Adicionado para "Identification"
            contract_selfie_url: selfieDoc,    // Adicionado para "Identification"
            
            contract_accepted: true,
            contract_signed_at: new Date().toISOString(),
            service_request_id: service_request_id,
            contract_approval_status: "pending",
            annex_approval_status: "pending"
          }).select().single();

          if (visaOrder) {
             console.log(`[migma-payment-completed] ✅ visa_orders criada: ${visaOrder.id}. Disparando 3 PDFs...`);
             
             // Disparar geradores de PDF (não aguarda para não travar o timeout do cliente)
             const pdfRequests = [
               fetch(`${migmaUrl}/functions/v1/generate-visa-contract-pdf`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${migmaKey}` },
                 body: JSON.stringify({ order_id: visaOrder.id })
               }),
               fetch(`${migmaUrl}/functions/v1/generate-annex-pdf`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${migmaKey}` },
                 body: JSON.stringify({ order_id: visaOrder.id })
               }),
               fetch(`${migmaUrl}/functions/v1/generate-invoice-pdf`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${migmaKey}` },
                 body: JSON.stringify({ order_id: visaOrder.id })
               })
             ];
             
             Promise.allSettled(pdfRequests).then((results) => {
               const failed = results.filter(r => r.status === 'rejected');
               console.log(`[migma-payment-completed] PDF generation triggers finished. Failed: ${failed.length}`);
             });
          } else {
            console.error("[migma-payment-completed] Erro fatal ao criar visa_orders:", orderErr);
          }
        }
      } catch (contractErr) {
        console.error("[migma-payment-completed] Falha na automação de contrato:", contractErr);
      }

      // 4. Sync para Matricula USA (PATCH DIRETO)
      if (matriculaUrl && matriculaKey) {
        const { data: p } = await migma.from("user_profiles").select("matricula_user_id").eq("user_id", user_id).maybeSingle();
        const remoteId = p?.matricula_user_id;

        if (remoteId) {
           console.log(`[migma-payment-completed] 🌐 Sincronizando com Matricula USA. ID Remoto: ${remoteId}`);
           const response = await fetch(`${matriculaUrl}/rest/v1/user_profiles?user_id=eq.${remoteId}`, {
            method: "PATCH",
            headers: {
              "apikey": matriculaKey,
              "Authorization": `Bearer ${matriculaKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
              has_paid_selection_process_fee: true,
              selection_process_paid_at: new Date().toISOString()
            }),
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[migma-payment-completed] ❌ Falha no PATCH Matricula USA (${response.status}):`, errorText);
          } else {
            console.log(`[migma-payment-completed] ✅ Sincronização Matricula USA concluída com sucesso!`);
          }
        } else {
          console.warn(`[migma-payment-completed] ⚠️ Sincronização ignorada: matricula_user_id não encontrado para user ${user_id}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, payment_id: paymentRecordId }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[migma-payment-completed] Erro:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
