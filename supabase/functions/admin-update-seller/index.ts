import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildEmailHtml(fullName: string, updateDetailsHtml: string): string {
    return '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">' +
        '</head>' +
        '<body style="margin: 0; padding: 0; font-family: Plus Jakarta Sans, sans-serif; background-color: #000000; color: #ffffff;">' +
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">' +
        '<tr><td align="center" style="padding: 30px 20px;">' +
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #0a0a0a; border: 1px solid #CE9F48; border-radius: 12px; overflow: hidden;">' +
        '<tr><td align="center" style="padding: 30px; background-color: #000000; border-bottom: 1px solid #1a1a1a;">' +
        '<img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="150" style="display: block;">' +
        '</td></tr>' +
        '<tr><td style="padding: 40px;">' +
        '<h2 style="margin: 0 0 25px 0; font-size: 22px; color: #F3E196; text-align: center; text-transform: uppercase; letter-spacing: 2px;">Account Security Update</h2>' +
        '<p style="font-size: 16px; line-height: 1.6; color: #cccccc; margin-bottom: 25px;">Hello <strong>' + fullName + '</strong>,</p>' +
        '<p style="font-size: 15px; line-height: 1.6; color: #cccccc; margin-bottom: 25px;">This is a formal notification that your account credentials at <strong>Migma Inc.</strong> have been updated by an administrator.</p>' +
        '<div style="background-color: #111111; border-radius: 8px; padding: 25px; border-left: 4px solid #CE9F48; margin-bottom: 30px;">' +
        '<p style="margin: 0 0 12px 0; font-size: 14px; color: #888; text-transform: uppercase;">Modified Information</p>' +
        '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">' + updateDetailsHtml + '</table>' +
        '</div>' +
        '<p style="font-size: 14px; line-height: 1.6; color: #888; margin-bottom: 20px;">If you did not authorize this change, please contact our support team immediately.</p>' +
        '</td></tr>' +
        '<tr><td align="center" style="padding: 20px; background-color: #000000; border-top: 1px solid #1a1a1a;">' +
        '<p style="margin: 0; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">&copy; 2026 MIGMA GLOBAL &bull; SECURE ADMINISTRATION</p>' +
        '</td></tr>' +
        '</table>' +
        '</td></tr></table>' +
        '</body></html>';
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Não autorizado' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            console.error('[admin-update-seller] Auth error:', userError);
            return new Response(JSON.stringify({ error: 'Não autorizado' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const userRole = user.user_metadata?.role;
        if (userRole !== 'admin') {
            console.error('[admin-update-seller] Not an admin. User role:', userRole);
            return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem editar vendedores.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const payload = await req.json();
        const { seller_id, full_name, email, phone, seller_id_public, new_password, role, head_of_sales_id, head_of_sales_started_at } = payload;

        console.log('[admin-update-seller] Request:', { seller_id, full_name, email, phone, seller_id_public, role, head_of_sales_id, head_of_sales_started_at, has_password: !!new_password });

        if (!seller_id || !full_name || !email || !phone || !seller_id_public) {
            return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

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

        const authUpdates: Record<string, unknown> = {};
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
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanOldEmail = oldEmail.trim().toLowerCase();

        if (cleanEmail !== cleanOldEmail || new_password) {
            try {
                const targetEmail = cleanEmail;
                let updateDetailsHtml = '';
                let subject = 'Security Update: Account Credentials Modified - Migma Inc.';

                if (cleanEmail !== cleanOldEmail && new_password) {
                    subject = 'Security Update: Email and Password Changed - Migma Inc.';
                    updateDetailsHtml =
                        '<tr><td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">New Login Email:</td>' +
                        '<td style="padding: 8px 0; color: #e0e0e0; font-family: monospace;">' + cleanEmail + '</td></tr>' +
                        '<tr><td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Password:</td>' +
                        '<td style="padding: 8px 0; color: #e0e0e0;">Successfully Updated</td></tr>';
                } else if (cleanEmail !== cleanOldEmail) {
                    subject = 'Security Update: Login Email Changed - Migma Inc.';
                    updateDetailsHtml =
                        '<tr><td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">New Login Email:</td>' +
                        '<td style="padding: 8px 0; color: #e0e0e0; font-family: monospace;">' + cleanEmail + '</td></tr>';
                } else if (new_password) {
                    subject = 'Security Update: Password Changed - Migma Inc.';
                    updateDetailsHtml =
                        '<tr><td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Password:</td>' +
                        '<td style="padding: 8px 0; color: #e0e0e0;">Successfully Updated</td></tr>';
                }

                const { error: emailInvokeError } = await supabaseAdmin.functions.invoke('send-email', {
                    body: {
                        to: targetEmail,
                        subject: subject,
                        html: buildEmailHtml(full_name, updateDetailsHtml),
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
        const sellerUpdatePayload: Record<string, unknown> = {
            full_name,
            email,
            phone,
            seller_id_public,
            role: role || 'seller',
            head_of_sales_id: head_of_sales_id === '' ? null : head_of_sales_id,
        };

        if ('head_of_sales_started_at' in payload) {
            sellerUpdatePayload.head_of_sales_started_at = head_of_sales_started_at || null;
        }

        const { error: sellersUpdateError } = await supabaseAdmin
            .from('sellers')
            .update(sellerUpdatePayload)
            .eq('id', seller_id);

        if (sellersUpdateError) {
            console.error('[admin-update-seller] Error updating sellers table:', sellersUpdateError);
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
