import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Only allow POST requests
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Create Supabase client with service role key (bypasses RLS)
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Get the authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Não autorizado' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verify the user is authenticated
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            console.error('[admin-update-seller] Auth error:', userError);
            return new Response(JSON.stringify({ error: 'Não autorizado' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check if the user is an admin (via user_metadata.role)
        const userRole = user.user_metadata?.role;
        if (userRole !== 'admin') {
            console.error('[admin-update-seller] Not an admin. User role:', userRole);
            return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem editar vendedores.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse request body
        const { seller_id, full_name, email, phone, seller_id_public, new_password } = await req.json();

        console.log('[admin-update-seller] Request:', { seller_id, full_name, email, phone, seller_id_public, has_password: !!new_password });

        // Validate required fields
        if (!seller_id || !full_name || !email || !phone || !seller_id_public) {
            return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Get the seller's user_id
        const { data: sellerData, error: sellerFetchError } = await supabaseAdmin
            .from('sellers')
            .select('user_id, email, seller_id_public')
            .eq('id', seller_id)
            .single();

        if (sellerFetchError || !sellerData) {
            console.error('[admin-update-seller] Seller not found:', sellerFetchError);
            return new Response(JSON.stringify({ error: 'Vendedor não encontrado' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const sellerUserId = sellerData.user_id;
        const oldEmail = sellerData.email;
        const oldSellerId = sellerData.seller_id_public;

        // Check if seller_id_public is being changed and if it's already in use
        if (seller_id_public !== oldSellerId) {
            const { data: existingSeller, error: checkError } = await supabaseAdmin
                .from('sellers')
                .select('id')
                .eq('seller_id_public', seller_id_public)
                .neq('id', seller_id)
                .maybeSingle();

            if (checkError) {
                console.error('[admin-update-seller] Error checking seller_id uniqueness:', checkError);
                return new Response(JSON.stringify({ error: 'Erro ao verificar unicidade do Seller ID' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (existingSeller) {
                return new Response(JSON.stringify({ error: 'Este Seller ID já está em uso por outro vendedor' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // Update auth.users if email or password is being changed
        const authUpdates: any = {};
        if (email !== oldEmail) {
            authUpdates.email = email;
            authUpdates.email_confirm = true;
            console.log(`[LOG] Solicitando troca de e-mail para: ${email}`);

        }
        if (new_password) {
            authUpdates.password = new_password;
        }

        if (Object.keys(authUpdates).length > 0) {
            console.log(`[LOG] Atualizando Auth para user id: ${sellerUserId}`);

            const { data: updateData, error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
                sellerUserId,
                authUpdates
            );

            if (authUpdateError) {
                console.error('[admin-update-seller] Error updating auth.users:', authUpdateError);

                // Check if it's a duplicate email error
                if (authUpdateError.message?.includes('already registered') || authUpdateError.message?.includes('duplicate')) {
                    return new Response(JSON.stringify({ error: 'Este e-mail já está em uso por outro usuário' }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }


                return new Response(JSON.stringify({ error: 'Erro ao atualizar credenciais do vendedor' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
            console.log('[LOG] Sucesso no auth! resultado:', updateData.user.new_email ? 'Email pendente de confirmação' : 'Email confirmado');
            console.log('[admin-update-seller] Auth updated successfully');
        }

        // If email was changed, send a manual notification via our Edge Function
        const cleanEmail = email.trim().toLowerCase();
        const cleanOldEmail = oldEmail.trim().toLowerCase();

        console.log(`[admin-update-seller] Email comparison: Old=${cleanOldEmail} | New=${cleanEmail}`);

        // Send manual notification if credentials were changed
        if (cleanEmail !== cleanOldEmail || new_password) {
            try {
                const targetEmail = cleanEmail; // Always send to the NEW email address
                console.log(`[admin-update-seller] Dispatching security notification to: ${targetEmail}`);

                let updateDetailsHtml = '';
                let subject = "Security Update: Account Credentials Modified - Migma Inc.";

                if (cleanEmail !== cleanOldEmail && new_password) {
                    subject = "Security Update: Email and Password Changed - Migma Inc.";
                    updateDetailsHtml = `
                        <tr>
                            <td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">New Login Email:</td>
                            <td style="padding: 8px 0; color: #e0e0e0; font-family: monospace;">${cleanEmail}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Password:</td>
                            <td style="padding: 8px 0; color: #e0e0e0;">Successfully Updated</td>
                        </tr>
                    `;
                } else if (cleanEmail !== cleanOldEmail) {
                    subject = "Security Update: Login Email Changed - Migma Inc.";
                    updateDetailsHtml = `
                        <tr>
                            <td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">New Login Email:</td>
                            <td style="padding: 8px 0; color: #e0e0e0; font-family: monospace;">${cleanEmail}</td>
                        </tr>
                    `;
                } else if (new_password) {
                    subject = "Security Update: Password Changed - Migma Inc.";
                    updateDetailsHtml = `
                        <tr>
                            <td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Password:</td>
                            <td style="padding: 8px 0; color: #e0e0e0;">Successfully Updated</td>
                        </tr>
                    `;
                }

                const { data: emailData, error: emailInvokeError } = await supabaseAdmin.functions.invoke('send-email', {
                    body: {
                        to: targetEmail,
                        subject: subject,
                        html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="utf-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                            </head>
                            <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; background-color: #000000; color: #ffffff;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
                                    <tr>
                                        <td align="center" style="padding: 30px 20px;">
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #0a0a0a; border: 1px solid #CE9F48; border-radius: 12px; overflow: hidden;">
                                                <tr>
                                                    <td align="center" style="padding: 30px; background-color: #000000; border-bottom: 1px solid #1a1a1a;">
                                                        <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="150" style="display: block;">
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 40px;">
                                                        <h2 style="margin: 0 0 25px 0; font-size: 22px; color: #F3E196; text-align: center; text-transform: uppercase; letter-spacing: 2px;">
                                                            Account Security Update
                                                        </h2>
                                                        
                                                        <p style="font-size: 16px; line-height: 1.6; color: #cccccc; margin-bottom: 25px;">
                                                            Hello <strong>${full_name}</strong>,
                                                        </p>
                                                        
                                                        <p style="font-size: 15px; line-height: 1.6; color: #cccccc; margin-bottom: 25px;">
                                                            This is a formal notification that your account credentials at <strong>Migma Inc.</strong> have been updated by an administrator.
                                                        </p>

                                                        <div style="background-color: #111111; border-radius: 8px; padding: 25px; border-left: 4px solid #CE9F48; margin-bottom: 30px;">
                                                            <p style="margin: 0 0 12px 0; font-size: 14px; color: #888; text-transform: uppercase;">Modified Information</p>
                                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                                ${updateDetailsHtml}
                                                            </table>
                                                        </div>

                                                        <p style="font-size: 14px; line-height: 1.6; color: #888; margin-bottom: 20px;">
                                                            If you did not authorize this change, please contact our support team immediately. You can now use your updated credentials to access your seller dashboard.
                                                        </p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="center" style="padding: 20px; background-color: #000000; border-top: 1px solid #1a1a1a;">
                                                        <p style="margin: 0; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">
                                                            © 2026 MIGMA GLOBAL • SECURE ADMINISTRATION
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </body>
                            </html>
                        `
                    }
                });

                if (emailInvokeError) {
                    console.error('[admin-update-seller] Failed to invoke security notification:', emailInvokeError);
                } else {
                    console.log('[admin-update-seller] Security notification dispatched successfully');
                }
            } catch (sendEmailError) {
                console.error('[admin-update-seller] Unexpected error in security notification:', sendEmailError);
            }
        } else {
            console.log('[admin-update-seller] No sensitive credentials changed. Skipping notification.');
        }



        // Update sellers table
        const { error: sellersUpdateError } = await supabaseAdmin
            .from('sellers')
            .update({
                full_name,
                email,
                phone,
                seller_id_public,
            })
            .eq('id', seller_id);

        if (sellersUpdateError) {
            console.error('[admin-update-seller] Error updating sellers table:', sellersUpdateError);

            // If sellers update fails after auth update, we should log this critical error
            // In a production system, you might want to implement a rollback mechanism
            return new Response(JSON.stringify({ error: 'Erro ao atualizar dados do vendedor' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('[admin-update-seller] Seller updated successfully');

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Vendedor atualizado com sucesso',
                email_changed: email !== oldEmail,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('[admin-update-seller] Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: 'Erro interno do servidor' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
