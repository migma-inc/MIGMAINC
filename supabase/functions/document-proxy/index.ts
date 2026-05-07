import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const bucket = url.searchParams.get("bucket");
        const path = url.searchParams.get("path");
        const viewToken = url.searchParams.get("token");

        if (!bucket || !path) {
            return new Response(
                JSON.stringify({ error: "Missing bucket or path" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const authHeader = req.headers.get("Authorization");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        const matriculaUrl = Deno.env.get("MATRICULAUSA_URL");
        const matriculaKey = Deno.env.get("MATRICULAUSA_SERVICE_ROLE");
        const matriculaAdmin = (matriculaUrl && matriculaKey) ? createClient(matriculaUrl, matriculaKey) : null;

        const project = url.searchParams.get("project") || "migma";
        const targetClient = (project === "matriculausa" && matriculaAdmin) ? matriculaAdmin : adminClient;

        let hasAccess = false;
        let userIdForLog = "anonymous";

        // --- 1. VALIDAÇÃO VIA TOKEN (Público via link de email) ---
        if (viewToken) {
            console.log(`[PROXY] Validating view token for ${bucket}/${path}`);

            // Check Visa Contract View Tokens
            const { data: vToken } = await adminClient
                .from('visa_contract_view_tokens')
                .select('id, expires_at')
                .eq('token', viewToken)
                .maybeSingle();

            if (vToken && (!vToken.expires_at || new Date(vToken.expires_at) > new Date())) {
                console.log(`[PROXY] Access granted via Visa token`);
                hasAccess = true;
                userIdForLog = `token-visa-${vToken.id}`;
            } else {
                // Check Global Partner View Tokens
                const { data: pApp } = await adminClient
                    .from('partner_terms_acceptances')
                    .select('id')
                    .eq('view_token', viewToken)
                    .maybeSingle();

                if (pApp) {
                    console.log(`[PROXY] Access granted via Partner token`);
                    hasAccess = true;
                    userIdForLog = `token-partner-${pApp.id}`;
                }
            }
        }

        // --- 2. VALIDAÇÃO VIA AUTENTICAÇÃO (Sessão Logada) ---
        if (!hasAccess && authHeader) {
            const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
                global: { headers: { Authorization: authHeader } },
            });

            const { data: { user }, error: authError } = await userClient.auth.getUser();

            if (!authError && user) {
                userIdForLog = user.id;

                // Admin sempre tem acesso
                const isAdmin = user.user_metadata?.role === 'admin' || user.app_metadata?.role === 'admin';
                if (isAdmin) {
                    hasAccess = true;
                } else {
                    // Verificação de Seller
                    const { data: seller } = await adminClient
                        .from('sellers')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('status', 'active')
                        .maybeSingle();

                    if (seller) {
                        const potentialId = path.split('/')[0];
                        if (potentialId && potentialId.length > 20) {
                            const { data: order } = await adminClient
                                .from('visa_orders')
                                .select('id')
                                .eq('seller_id', seller.id)
                                .or(`service_request_id.eq.${potentialId},client_id.eq.${potentialId}`)
                                .maybeSingle();

                            if (order) hasAccess = true;
                        }
                    }

                    // Verificação de Aluno (Migma Institution Applications)
                    if (!hasAccess) {
                        const { data: profile } = await adminClient
                            .from('user_profiles')
                            .select('id, role')
                            .eq('user_id', user.id)
                            .single();

                        if (profile) {
                            // Check if document belongs to student (path starts with userId)
                            if (path.startsWith(`${user.id}/`) || path.includes(`/${user.id}/`)) {
                                hasAccess = true;
                                console.log(`[PROXY] Access granted to owner via path: ${user.id}`);
                            } else {
                                // Check institution applications for this profile
                                const { data: apps } = await adminClient
                                    .from('institution_applications')
                                    .select('acceptance_letter_url, transfer_form_url, transfer_form_filled_url')
                                    .eq('profile_id', profile.id);

                                if (apps) {
                                    for (const app of apps) {
                                        if (
                                            (app.acceptance_letter_url && app.acceptance_letter_url.includes(path)) ||
                                            (app.transfer_form_url && app.transfer_form_url.includes(path)) ||
                                            (app.transfer_form_filled_url && app.transfer_form_filled_url.includes(path))
                                        ) {
                                            hasAccess = true;
                                            console.log(`[PROXY] Access granted to owner via application`);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (!hasAccess) {
                        console.log(`[PROXY] Access DENIED for user ${user.id} to bucket=${bucket}, path=${path}`);
                    }
                }
            }
        }

        if (!hasAccess) {
            console.warn(`[PROXY] Blocked access to ${bucket}/${path} (Project: ${project}). Token provided: ${!!viewToken}, Auth provided: ${!!authHeader}`);
            return new Response(
                JSON.stringify({ error: "Forbidden - You do not have access to this document" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // --- DOWNLOAD E STREAM ---
        console.log(`[PROXY] Downloading ${bucket}/${path} from project ${project}...`);
        const { data, error: downloadError } = await targetClient.storage
            .from(bucket)
            .download(path);

        if (downloadError) {
            console.error(`[PROXY] Download error for ${bucket}/${path} in project ${project}:`, downloadError);
            return new Response(
                JSON.stringify({ error: "File not found", detail: downloadError }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const contentType = data.type || "application/octet-stream";

        return new Response(data, {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type": contentType,
                "Cache-Control": "private, max-age=3600",
                "Content-Disposition": `inline; filename="${path.split('/').pop()}"`,
            },
        });

    } catch (error) {
        console.error("[PROXY] Unexpected error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
