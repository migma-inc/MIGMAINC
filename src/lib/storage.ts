import { supabase } from './supabase';

const BUCKET_NAME = 'cv-files';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export interface UploadCVResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    error?: string;
}

/**
 * Upload CV file to Supabase Storage
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

        // Generate unique file name
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileName = `${timestamp}-${randomString}-${file.name}`;
        const filePath = `applications/${fileName}`;

        // Upload file to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) {
            console.error('Error uploading file:', error);
            return {
                success: false,
                error: error.message || 'Failed to upload file',
            };
        }

        return {
            success: true,
            filePath: data.path,
            fileName: file.name,
        };
    } catch (error) {
        console.error('Unexpected error uploading file:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
}

