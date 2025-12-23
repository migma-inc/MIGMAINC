import { supabase } from './supabase';

/**
 * Gera um token único para visualização de contrato assinado
 * @param acceptanceId - ID do aceite de termos (contrato assinado)
 * @param expiresInDays - Dias até o token expirar (padrão: 90 dias)
 * @returns Token único gerado ou null se houver erro
 */
export async function generateContractViewToken(
  acceptanceId: string,
  expiresInDays: number = 90
): Promise<{ token: string; expiresAt: Date } | null> {
  try {
    // Verificar se já existe token para este contrato
    const { data: existingToken } = await supabase
      .from('partner_contract_view_tokens')
      .select('id, expires_at')
      .eq('acceptance_id', acceptanceId)
      .single();

    // Se existe token válido, retornar o existente
    if (existingToken) {
      const expiresAt = new Date(existingToken.expires_at);
      const now = new Date();
      if (now < expiresAt) {
        // Token ainda válido, buscar o token completo
        const { data: tokenData } = await supabase
          .from('partner_contract_view_tokens')
          .select('token, expires_at')
          .eq('id', existingToken.id)
          .single();
        
        if (tokenData) {
          return {
            token: tokenData.token,
            expiresAt: new Date(tokenData.expires_at),
          };
        }
      } else {
        // Token expirado, deletar e criar novo
        await supabase
          .from('partner_contract_view_tokens')
          .delete()
          .eq('id', existingToken.id);
      }
    }

    // Gerar token único
    const token = `view_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Inserir token no banco
    const { error } = await supabase
      .from('partner_contract_view_tokens')
      .insert({
        acceptance_id: acceptanceId,
        token: token,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      console.error('[CONTRACT_VIEW] Error generating token:', error);
      return null;
    }

    return { token, expiresAt };
  } catch (error) {
    console.error('[CONTRACT_VIEW] Unexpected error generating token:', error);
    return null;
  }
}

/**
 * Valida se um token de visualização é válido e não expirou
 * @param token - Token a ser validado
 * @returns Dados do token e contrato se válido, null caso contrário
 */
export async function validateContractViewToken(token: string) {
  try {
    // First, get the token
    const { data: tokenData, error: tokenError } = await supabase
      .from('partner_contract_view_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.log('[CONTRACT_VIEW] Token not found:', tokenError);
      return null;
    }

    // Verificar se expirou
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    if (now > expiresAt) {
      console.log('[CONTRACT_VIEW] Token expired');
      return null;
    }

    // Fetch the acceptance
    const { data: acceptance, error: acceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .select('*')
      .eq('id', tokenData.acceptance_id)
      .single();

    if (acceptanceError || !acceptance) {
      console.log('[CONTRACT_VIEW] Acceptance not found:', acceptanceError);
      return null;
    }

    // Permitir visualização mesmo se ainda não foi aprovado (pending)
    // O usuário pode ver seu contrato assinado antes da aprovação do admin
    // if (acceptance.verification_status !== 'approved') {
    //   console.log('[CONTRACT_VIEW] Contract not approved');
    //   return null;
    // }

    return {
      tokenData: tokenData,
      acceptance: acceptance,
    };
  } catch (error) {
    console.error('[CONTRACT_VIEW] Error validating token:', error);
    return null;
  }
}

/**
 * Busca todos os dados necessários para visualização do contrato
 * @param acceptanceId - ID do aceite de termos
 * @returns Dados completos do contrato ou null se não encontrado
 */
export async function getContractViewData(acceptanceId: string) {
  try {
    // Buscar aceite com dados da aplicação
    const { data: acceptance, error: acceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .select(`
        *,
        global_partner_applications (
          id,
          full_name,
          email,
          phone,
          country
        ),
        contract_templates (
          id,
          name,
          content
        )
      `)
      .eq('id', acceptanceId)
      .single();

    if (acceptanceError || !acceptance) {
      console.error('[CONTRACT_VIEW] Error fetching acceptance:', acceptanceError);
      return null;
    }

    // Permitir visualização mesmo se ainda não foi aprovado (pending)
    // O usuário pode ver seu contrato assinado antes da aprovação do admin
    // if (acceptance.verification_status !== 'approved') {
    //   console.log('[CONTRACT_VIEW] Contract not approved');
    //   return null;
    // }

    // Buscar conteúdo do contrato (template ou termos padrão)
    let contractContent = '';
    if (acceptance.contract_template_id && acceptance.contract_templates) {
      contractContent = acceptance.contract_templates.content || '';
    } else {
      // Buscar termos padrão
      const { data: defaultTerms } = await supabase
        .from('application_terms')
        .select('content')
        .eq('term_type', 'partner_contract')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (defaultTerms) {
        contractContent = defaultTerms.content || '';
      }
    }

    return {
      acceptance,
      application: acceptance.global_partner_applications,
      contractContent,
      template: acceptance.contract_templates,
    };
  } catch (error) {
    console.error('[CONTRACT_VIEW] Error fetching contract data:', error);
    return null;
  }
}

