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
            // Set email_confirm_status to false to require confirmation
            authUpdates.email_confirm_status = false;
        }
        if (new_password) {
            authUpdates.password = new_password;
        }

        if (Object.keys(authUpdates).length > 0) {
            const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
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

            console.log('[admin-update-seller] Auth updated successfully');
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
