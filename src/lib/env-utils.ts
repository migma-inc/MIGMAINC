/**
 * Utilitários de ambiente para controle de features (Feature Flags)
 */

/**
 * Retorna true se o ambiente atual for de desenvolvimento ou staging (não produção).
 * Em Vite, import.meta.env.PROD é verdadeiro apenas no build final de produção.
 */
export const isDevelopmentEnvironment = (): boolean => {
    // Se estivermos rodando localmente (dev), sempre retorna true
    if (import.meta.env.DEV) return true;

    // Caso contrário, verifica se não estamos no modo de produção
    return import.meta.env.MODE !== 'production';
};

/**
 * Flag para controlar a visibilidade de cupons e split payments
 */
export const SHOW_BETA_FEATURES = isDevelopmentEnvironment();
