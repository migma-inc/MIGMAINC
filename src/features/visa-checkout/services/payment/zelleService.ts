import { supabase } from '@/lib/supabase';
import { processZellePaymentWithN8n } from '@/lib/zelle-n8n-integration';
import type { ZellePaymentRequest, ZellePaymentResponse } from '../../types/zelle.types';

/**
 * Zelle Payment Service
 * Handles Zelle payment processing via N8N integration
 */
export class ZelleService {
    /**
     * Upload Zelle receipt to storage
     */
    static async uploadReceipt(
        file: File,
        serviceRequestId: string
    ): Promise<string> {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${serviceRequestId}/zelle-receipt.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('visa-documents')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            throw new Error(`Failed to upload Zelle receipt: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
            .from('visa-documents')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
    }

    /**
     * Process Zelle payment via N8N
     */
    static async processPayment(
        request: ZellePaymentRequest,
        receiptFile: File,
        baseTotal: number
    ): Promise<ZellePaymentResponse> {
        try {
            // Get user ID from service request
            const { data: serviceRequest } = await supabase
                .from('service_requests')
                .select('client_id')
                .eq('id', request.service_request_id)
                .single();

            const userId = serviceRequest?.client_id || null;

            // Process with n8n (upload + validation)
            const n8nResult = await processZellePaymentWithN8n(
                receiptFile,
                baseTotal,
                request.product_slug,
                userId
            );

            return {
                success: true,
                order_id: request.service_request_id,
                message: n8nResult.decision.message,
                status: n8nResult.decision.status,
            };
        } catch (error) {
            console.error('[ZelleService] Error processing payment:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to process Zelle payment');
        }
    }
}
