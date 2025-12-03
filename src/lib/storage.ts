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


