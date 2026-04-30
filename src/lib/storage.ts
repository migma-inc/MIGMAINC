import { supabase } from './supabase';
import { matriculaSupabase } from './matriculaSupabase';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface UploadCVResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
}

/**
 * Upload CV file via Edge Function (server-side)
 * This avoids authentication issues since the Edge Function uses service_role
 * @param file - The CV file to upload
 * @returns Result with file path and name, or error message
 */
export async function uploadCV(file: File): Promise<UploadCVResult> {
    try {
        // Validate file type
        if (file.type !== 'application/pdf') {
            return {
                success: false,
                error: 'Only PDF files are allowed',
            };
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return {
                success: false,
                error: 'File size must be less than 5MB',
            };
        }

        // Create FormData to send file to Edge Function
        const formData = new FormData();
        formData.append('file', file);

        // Get clientId from session if available
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
            formData.append('clientId', user.id);
        }

        // Call Edge Function to upload file
        const response = await fetch(`${SUPABASE_URL}/functions/v1/upload-cv`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            return {
                success: false,
                error: result.error || 'Failed to upload file',
            };
        }

        return {
            success: true,
            filePath: result.filePath,
            fileName: result.fileName,
        };
    } catch (error) {
        console.error('Unexpected error uploading file:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
}

/**
 * Resolve uma URL de storage (possivelmente privada) para uma URL acessível.
 * Se o bucket for privado, tenta baixar o arquivo ou usar o Proxy.
 */
export async function getSecureUrl(url: string | null): Promise<string | null> {
    if (!url) return null;
    url = url.trim();

    // If it's already a blob or data URL, return as is
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;

    // If it's already a public URL or has a token/signature, return as is
    if (url.startsWith('http') && (url.includes('token=') || url.includes('token-visa=') || url.includes('signature='))) return url;

    try {
        // buckets que sabemos que são privados ou precisam de RLS
        const privateBuckets = [
            'visa-documents',
            'visa-signatures',
            'contracts',
            'identity-photos',
            'partner-signatures',
            'cv-files',
            'migma-student-documents',
            'acceptance-letters',
            'transfer-forms',
            'institution-forms',
            'document-attachments',
        ];

        const MATRICULAUSA_URL = import.meta.env.VITE_MATRICULAUSA_SUPABASE_URL;

        let bucket: string | null = null;
        let path: string | null = null;

        // Caso 1: URL completa do Supabase Storage (possivelmente pública)
        if (url.includes('/storage/v1/object/')) {
            const match = url.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/);
            if (match) {
                bucket = match[1];
                path = decodeURIComponent(match[2]);
            }
        }
        // Caso 2: Path relativo (ex: "visa-documents/path/to/file.jpg")
        else if (!url.startsWith('http')) {
            const parts = url.split('/');
            const lowerUrl = url.toLowerCase();

            // Se o primeiro segmento for um bucket privado conhecido
            if (parts.length > 1 && privateBuckets.includes(parts[0])) {
                bucket = parts[0];
                path = parts.slice(1).join('/');
            }
            // Caso especial: anonymous/applications/... (comum em global partner)
            else if (lowerUrl.startsWith('anonymous/') || lowerUrl.startsWith('applications/')) {
                bucket = 'cv-files';
                path = url;
            }
            else {
                // Fallback guess baseado no conteúdo - se não houver slash, assumimos applications/
                if (lowerUrl.includes('resume_') || lowerUrl.includes('cv_') || lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?')) {
                    bucket = 'cv-files';
                    path = url.includes('/') ? url : `applications/${url}`;
                } else if (lowerUrl.includes('sig') || lowerUrl.includes('assinatura')) {
                    bucket = 'visa-signatures';
                    path = url;
                } else if (lowerUrl.includes('photo') || lowerUrl.includes('selfie')) {
                    bucket = 'identity-photos';
                    path = url.includes('/') ? url : `photos/${url}`;
                } else if (lowerUrl.includes('contract') || lowerUrl.includes('termo') || lowerUrl.includes('enelx')) {
                    bucket = 'contracts';
                    path = url;
                } else {
                    bucket = 'visa-documents';
                    path = url;
                }
            }
        }
        if (!bucket || !path) return url;

        // Verificação final - Se identificamos que é um bucket privado, forçamos a segurança
        if (bucket && (privateBuckets.includes(bucket) || bucket === 'contracts' || url.includes('fitpynguasqqutuhzifx'))) {
            // 0. Decidir qual cliente usar
            const isMatriculaUsa = url.includes('fitpynguasqqutuhzifx') || (MATRICULAUSA_URL && url.includes(MATRICULAUSA_URL));
            const client = isMatriculaUsa ? matriculaSupabase : supabase;

            // 1. Tentar download direto (Blob URL) - Mais robusto para iFrames e visualização interna
            try {
                const { data, error } = await client.storage.from(bucket).download(path || '');
                if (!error && data) {
                    return URL.createObjectURL(data);
                }
                if (error) console.warn(`[STORAGE] Download error (${isMatriculaUsa ? 'MatriculaUSA' : 'Migma'}):`, error);
            } catch (err) {
                console.warn('[STORAGE] Catch during direct download:', err);
            }

            // 2. Tentar gerar uma Signed URL (Fallback para visualização externa)
            try {
                const { data: signedData, error: signedError } = await client.storage.from(bucket).createSignedUrl(path || '', 3600);

                if (!signedError && signedData?.signedUrl) {
                    return signedData.signedUrl;
                }
                if (signedError) console.warn('[STORAGE] createSignedUrl error:', signedError);
            } catch (err) {
                console.warn('[STORAGE] Catch during createSignedUrl:', err);
            }

            // 3. Fallback final: Proxy (Edge Function)
            // Agora suporta MatriculaUSA via parâmetro project
            // Nota: O proxy está sempre no SUPABASE_URL (Migma), pois é ele que tem a lógica de cross-project
            const proxyUrl = `${SUPABASE_URL}/functions/v1/document-proxy?bucket=${bucket}&path=${encodeURIComponent(path || '')}${isMatriculaUsa ? '&project=matriculausa' : ''}`;
            
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.access_token) {
                    const response = await fetch(proxyUrl, {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    });
                    
                    if (response.ok) {
                        const blob = await response.blob();
                        return URL.createObjectURL(blob);
                    }
                }
            } catch (err) {
                console.error('[STORAGE] Proxy fetch failed:', err);
            }

            return proxyUrl;
        }

        // Buckets públicos (ex: Zelle)
        if (bucket === 'zelle_comprovantes') {
            const { data } = supabase.storage.from(bucket).getPublicUrl(path || '');
            return data.publicUrl;
        }

    } catch (err) {
        console.error('[STORAGE] Erro crítico ao resolver URL segura:', err);
    }

    return url;
}
