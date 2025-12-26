import { supabase } from './supabase';
import { sendTermsLinkEmail } from './emails';

/**
 * Gera um token único para aceite de termos
 * @param applicationId - ID da aplicação aprovada
 * @param expiresInDays - Dias até o token expirar (padrão: 30 dias)
 * @param contractTemplateId - ID do template de contrato (opcional)
 * @returns Token único gerado
 */
export async function generateTermsToken(
    applicationId: string,
    expiresInDays: number = 30,
    contractTemplateId?: string | null
): Promise<{ token: string; expiresAt: Date } | null> {
    try {
        // Gerar token único
        const token = `migma_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        // Preparar dados para inserção
        const insertData: Record<string, any> = {
            application_id: applicationId,
            token: token,
            expires_at: expiresAt.toISOString(),
        };

        // Adicionar contract_template_id se fornecido
        if (contractTemplateId) {
            insertData.contract_template_id = contractTemplateId;
        }

        // Inserir token no banco
        const { error } = await supabase
            .from('partner_terms_acceptances')
            .insert(insertData);

        if (error) {
            console.error('Error generating token:', error);
            return null;
        }

        return { token, expiresAt };
    } catch (error) {
        console.error('Unexpected error generating token:', error);
        return null;
    }
}

/**
 * Valida se um token é válido e não expirou
 * @param token - Token a ser validado
 * @returns Dados do token se válido, null caso contrário
 */
export async function validateTermsToken(token: string) {
    try {
        const { data, error } = await supabase
            .from('partner_terms_acceptances')
            .select('*, application_id')
            .eq('token', token)
            .single();

        if (error || !data) {
            return null;
        }

        // Verificar se expirou
        const now = new Date();
        const expiresAt = new Date(data.expires_at);
        if (now > expiresAt) {
            return null;
        }

        // Verificar se já foi aceito
        if (data.accepted_at) {
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error validating token:', error);
        return null;
    }
}

/**
 * Aprova um candidato e envia email com link para aceitar termos
 * Esta função deve ser chamada após aprovação manual no painel admin
 * 
 * @param applicationId - ID da aplicação aprovada
 * @param expiresInDays - Dias até o token expirar (padrão: 30 dias)
 * @param contractTemplateId - ID do template de contrato (opcional)
 * @returns Token gerado ou null se houver erro
 */
export async function approveCandidateAndSendTermsLink(
    applicationId: string,
    expiresInDays: number = 30,
    contractTemplateId?: string | null
): Promise<string | null> {
    try {
        // Buscar dados da aplicação
        const { data: application, error: appError } = await supabase
            .from('global_partner_applications')
            .select('email, full_name')
            .eq('id', applicationId)
            .single();

        if (appError || !application) {
            console.error('Error fetching application:', appError);
            return null;
        }

        // Gerar token com template se fornecido
        const tokenResult = await generateTermsToken(applicationId, expiresInDays, contractTemplateId);
        if (!tokenResult) {
            console.error('Failed to generate token');
            return null;
        }

        // Enviar email com link
        // Get base URL from environment or current origin
        const getBaseUrl = (): string => {
            // Try environment variable first (for production builds)
            const envUrl = import.meta.env.VITE_APP_URL;
            if (envUrl) return envUrl;
            
            // If in browser, use current origin
            if (typeof window !== 'undefined' && window.location.origin) {
                return window.location.origin;
            }
            
            // Fallback (should be set via VITE_APP_URL in production)
            return 'https://migma.com';
        };
        
        const baseUrl = getBaseUrl();
        
        // Log the URL being used for debugging
        console.log('[PARTNER TERMS] Sending terms link email:', {
            email: application.email,
            baseUrl: baseUrl,
            isLocalhost: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
            source: import.meta.env.VITE_APP_URL ? 'env' : (typeof window !== 'undefined' ? 'browser' : 'fallback')
        });
        
        const emailSent = await sendTermsLinkEmail(
            application.email,
            application.full_name,
            tokenResult.token,
            baseUrl
        );

        if (!emailSent) {
            console.warn('Token generated but email failed to send');
            // Token ainda é válido mesmo se email falhar
        }

        return tokenResult.token;
    } catch (error) {
        console.error('Error approving candidate:', error);
        return null;
    }
}

/**
 * Reenvia o email com link do contrato para uma aplicação já aprovada
 * Usa o token existente se válido, ou gera um novo se necessário
 * Força o uso da URL de produção (não localhost)
 * 
 * @param applicationId - ID da aplicação
 * @param forceProductionUrl - Se true, força uso de URL de produção (padrão: true)
 * @returns Token usado ou null se houver erro
 */
export async function resendContractTermsEmail(
    applicationId: string,
    forceProductionUrl: boolean = true
): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
        // Buscar dados da aplicação
        const { data: application, error: appError } = await supabase
            .from('global_partner_applications')
            .select('email, full_name, status')
            .eq('id', applicationId)
            .single();

        if (appError || !application) {
            console.error('[RESEND EMAIL] Error fetching application:', appError);
            return { success: false, error: 'Application not found' };
        }

        if (application.status !== 'approved_for_contract') {
            return { 
                success: false, 
                error: `Application must be in 'approved_for_contract' status. Current status: ${application.status}` 
            };
        }

        // Buscar token existente e válido
        const { data: existingToken, error: tokenError } = await supabase
            .from('partner_terms_acceptances')
            .select('token, expires_at, contract_template_id, accepted_at')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let tokenToUse: string;

        // Verificar se o token existente é válido (não expirado e não aceito)
        if (existingToken && !tokenError) {
            const now = new Date();
            const expiresAt = new Date(existingToken.expires_at);
            const isExpired = now > expiresAt;
            const isAccepted = !!existingToken.accepted_at;

            if (!isExpired && !isAccepted) {
                // Usar token existente
                tokenToUse = existingToken.token;
                console.log('[RESEND EMAIL] Using existing valid token:', tokenToUse);
            } else {
                // Token expirado ou já aceito, gerar novo
                console.log('[RESEND EMAIL] Existing token is expired or accepted, generating new token');
                const tokenResult = await generateTermsToken(
                    applicationId, 
                    30, 
                    existingToken.contract_template_id
                );
                if (!tokenResult) {
                    return { success: false, error: 'Failed to generate new token' };
                }
                tokenToUse = tokenResult.token;
            }
        } else {
            // Não há token existente, gerar novo
            console.log('[RESEND EMAIL] No existing token found, generating new token');
            const tokenResult = await generateTermsToken(applicationId, 30);
            if (!tokenResult) {
                return { success: false, error: 'Failed to generate token' };
            }
            tokenToUse = tokenResult.token;
        }

        // Get base URL - forçar produção se solicitado
        const getBaseUrl = (): string => {
            // Se forceProductionUrl, sempre usar produção
            if (forceProductionUrl) {
                const envUrl = import.meta.env.VITE_APP_URL;
                if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
                    return envUrl;
                }
                // Fallback para produção
                return 'https://migma.com';
            }
            
            // Caso contrário, usar lógica normal
            const envUrl = import.meta.env.VITE_APP_URL;
            if (envUrl) return envUrl;
            
            if (typeof window !== 'undefined' && window.location.origin) {
                return window.location.origin;
            }
            
            return 'https://migma.com';
        };
        
        const baseUrl = getBaseUrl();
        
        // Log the URL being used for debugging
        console.log('[RESEND EMAIL] Resending contract terms link email:', {
            email: application.email,
            baseUrl: baseUrl,
            isLocalhost: baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'),
            forceProductionUrl: forceProductionUrl,
            token: tokenToUse
        });
        
        const emailSent = await sendTermsLinkEmail(
            application.email,
            application.full_name,
            tokenToUse,
            baseUrl
        );

        if (!emailSent) {
            return { 
                success: false, 
                error: 'Failed to send email. Token was generated/retrieved but email sending failed.' 
            };
        }

        return { success: true, token: tokenToUse };
    } catch (error) {
        console.error('[RESEND EMAIL] Error resending contract terms email:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
        };
    }
}

