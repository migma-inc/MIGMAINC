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
 * Se o bucket for privado, tenta gerar uma Signed URL.
 */
export async function getSecureUrl(url: string | null): Promise<string | null> {
    if (!url) return null;

    try {
        const { supabase } = await import('./supabase');

        // buckets que sabemos que são privados ou precisam de RLS
        const privateBuckets = [
            'visa-documents',
            'visa-signatures',
            'contracts',
            'identity-photos',
            'partner-signatures',
            'zelle_comprovantes',
            'cv-files'
        ];

        let bucket: string | null = null;
        let path: string | null = null;

        // Caso 1: Path relativo (ex: "visa-documents/path/to/file.jpg")
        if (!url.includes('http') && !url.includes('/storage/')) {
            // Extrair bucket do início do path
            const parts = url.split('/');

            // Se o primeiro segmento é um bucket conhecido
            if (parts.length > 1 && privateBuckets.includes(parts[0])) {
                bucket = parts[0];
                path = parts.slice(1).join('/');
            }
            // Se não tem prefixo de bucket, tentar inferir pelo nome do arquivo
            else {
                // CVs geralmente começam com "Resume_" ou "CV_" ou têm extensão .pdf
                if (url.toLowerCase().includes('resume_') || url.toLowerCase().includes('cv_') || url.endsWith('.pdf')) {
                    bucket = 'cv-files';
                    path = `applications/${url}`;
                }
                // Contratos
                else if (url.toLowerCase().includes('contract') || url.toLowerCase().includes('contrato')) {
                    bucket = 'contracts';
                    path = url;
                }
                // Assinaturas
                else if (url.toLowerCase().includes('signature') || url.toLowerCase().includes('assinatura')) {
                    bucket = 'visa-signatures';
                    path = url;
                }
                // Documentos de identidade
                else if (url.toLowerCase().includes('identity') || url.toLowerCase().includes('document')) {
                    bucket = 'visa-documents';
                    path = url;
                }
                // Fotos de identidade
                else if (url.toLowerCase().includes('photo') || url.toLowerCase().includes('selfie')) {
                    bucket = 'identity-photos';
                    path = `photos/${url}`;
                }
                // Comprovantes Zelle
                else if (url.toLowerCase().includes('zelle') || url.toLowerCase().includes('proof')) {
                    bucket = 'zelle_comprovantes';
                    path = `zelle-payments/${url}`;
                }
            }
        }
        // Caso 2: URL completa do Supabase Storage
        else if (url.includes('/storage/v1/object/')) {
            // Regex para extrair bucket e path de URLs do Supabase
            // Formatos comuns: 
            // .../storage/v1/object/public/bucket/path/to/file.jpg
            // .../storage/v1/object/authenticated/bucket/path/to/file.jpg
            const match = url.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/);

            if (match) {
                bucket = match[1];
                path = decodeURIComponent(match[2]);
            }
        }
        // Caso 3: Não é URL do Supabase, retorna como está
        else {
            return url;
        }

        // Se identificamos bucket e path, e é um bucket privado, gera Signed URL
        if (bucket && path && privateBuckets.includes(bucket)) {
            const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
            if (!error && data?.signedUrl) {
                return data.signedUrl;
            }
            console.error('[STORAGE] Erro ao criar Signed URL:', error);
        }
    } catch (err) {
        console.error('[STORAGE] Erro ao resolver URL segura:', err);
    }

    return url;
}


