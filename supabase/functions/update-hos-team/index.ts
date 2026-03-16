import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
            return new Response(JSON.stringify({ error: 'Não autorizado' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const userRole = user.user_metadata?.role;
        if (userRole !== 'head_of_sales' && userRole !== 'admin') {
            return new Response(JSON.stringify({ error: 'Acesso negado. Apenas gestores podem gerenciar equipes.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { hos_id, team_name, selected_seller_ids } = await req.json();

        if (!hos_id) {
            return new Response(JSON.stringify({ error: 'ID do HoS faltando' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Se o usuário não for admin, ele só pode gerenciar a própria equipe
        if (userRole !== 'admin') {
            // Buscar o seller_id desse usuário
            const { data: seller, error: sellerError } = await supabaseAdmin
                .from('sellers')
                .select('id')
                .eq('user_id', user.id)
                .single();

            if (sellerError || seller.id !== hos_id) {
                return new Response(JSON.stringify({ error: 'Você só pode gerenciar sua própria equipe.' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // 1. Atualizar o nome do time
        const { error: hosUpdateError } = await supabaseAdmin
            .from('sellers')
            .update({ team_name: team_name?.trim() || null })
            .eq('id', hos_id);

        if (hosUpdateError) {
            throw hosUpdateError;
        }

        // 2. Obter membros atuais
        const { data: currentMembers, error: membersError } = await supabaseAdmin
            .from('sellers')
            .select('id')
            .eq('head_of_sales_id', hos_id);

        if (membersError) throw membersError;

        const currentIds = currentMembers.map((m: any) => m.id);
        const toAdd = selected_seller_ids.filter((id: string) => !currentIds.includes(id));
        const toRemove = currentIds.filter((id: string) => !selected_seller_ids.includes(id));

        // 3. Adicionar novos
        if (toAdd.length > 0) {
            const { error: addError } = await supabaseAdmin
                .from('sellers')
                .update({ head_of_sales_id: hos_id })
                .in('id', toAdd);
            if (addError) throw addError;
        }

        // 4. Remover antigos
        if (toRemove.length > 0) {
            const { error: removeError } = await supabaseAdmin
                .from('sellers')
                .update({ head_of_sales_id: null })
                .in('id', toRemove)
                .eq('head_of_sales_id', hos_id);
            if (removeError) throw removeError;
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Equipe atualizada com sucesso' }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error: any) {
        console.error('[update-hos-team] Unexpected error:', error);
        return new Response(
            JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
