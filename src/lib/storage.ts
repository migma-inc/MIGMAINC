import { supabase } from './supabase';

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

        console.log('[STORAGE DEBUG] Uploading file via Edge Function:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
        });

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
            console.error('[STORAGE DEBUG] Upload error:', result);
            return {
                success: false,
                error: result.error || 'Failed to upload file',
            };
        }

        console.log('[STORAGE DEBUG] File uploaded successfully:', result);

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

    try {
        // buckets que sabemos que são privados ou precisam de RLS
        const privateBuckets = [
            'visa-documents',
            'visa-signatures',
            'contracts',
            'identity-photos',
            'partner-signatures',
            'cv-files'
        ];

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
            if (parts.length > 1 && privateBuckets.includes(parts[0])) {
                bucket = parts[0];
                path = parts.slice(1).join('/');
            } else {
                // Fallback guess baseado no conteúdo
                if (url.toLowerCase().includes('resume_') || url.toLowerCase().includes('cv_') || url.endsWith('.pdf')) {
                    bucket = 'cv-files';
                    path = url.includes('/') ? url : `applications/${url}`;
                } else if (url.toLowerCase().includes('sig') || url.toLowerCase().includes('assinatura')) {
                    bucket = 'visa-signatures';
                    path = url;
                } else if (url.toLowerCase().includes('photo') || url.toLowerCase().includes('selfie')) {
                    bucket = 'identity-photos';
                    path = url.includes('/') ? url : `photos/${url}`;
                } else {
                    bucket = 'visa-documents';
                    path = url;
                }
            }
        }

        // Verificação final - Se identificamos que é um bucket privado, forçamos a segurança
        if (bucket && (privateBuckets.includes(bucket) || bucket === 'contracts')) {
            // Tentar download direto (Blob URL) - Só funciona se o usuário estiver logado ou bucket for público por RLS
            try {
                const { data, error } = await supabase.storage.from(bucket).download(path || '');
                if (!error && data) {
                    console.log(`[STORAGE] Direct download successful for ${bucket}/${path}`);
                    return URL.createObjectURL(data);
                }
            } catch (err) {
                console.warn('[STORAGE] Catch during direct download:', err);
            }

            // Se o download direto falhar (usuário deslogado ou sem permissão direta), usamos o Proxy
            console.log(`[STORAGE] Falling back to proxy for ${bucket}/${path}`);
            return `${SUPABASE_URL}/functions/v1/document-proxy?bucket=${bucket}&path=${encodeURIComponent(path || '')}`;
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
