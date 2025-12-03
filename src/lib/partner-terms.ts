import { supabase } from './supabase';
import { sendTermsLinkEmail } from './emails';

/**
 * Gera um token único para aceite de termos
 * @param applicationId - ID da aplicação aprovada
 * @param expiresInDays - Dias até o token expirar (padrão: 30 dias)
 * @returns Token único gerado
 */
export async function generateTermsToken(
    applicationId: string,
    expiresInDays: number = 30
): Promise<{ token: string; expiresAt: Date } | null> {
    try {
        // Gerar token único
        const token = `migma_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        // Inserir token no banco
        const { error } = await supabase
            .from('partner_terms_acceptances')
            .insert({
                application_id: applicationId,
                token: token,
                expires_at: expiresAt.toISOString(),
            });

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
 * @returns Token gerado ou null se houver erro
 */
export async function approveCandidateAndSendTermsLink(
    applicationId: string,
    expiresInDays: number = 30
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

        // Gerar token
        const tokenResult = await generateTermsToken(applicationId, expiresInDays);
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

