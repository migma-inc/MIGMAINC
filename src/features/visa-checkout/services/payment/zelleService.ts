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

            // 2. Fetch Product Details for required price fields
            const { data: product, error: productError } = await supabase
                .from('visa_products')
                .select('base_price_usd, price_per_dependent_usd, extra_unit_price')
                .eq('slug', request.product_slug)
                .single();

            if (productError || !product) {
                console.error('[ZelleService] Product not found:', request.product_slug);
                throw new Error('Product not found');
            }

            // 3. Process with n8n (upload + validation)
            const n8nResult = await processZellePaymentWithN8n(
                receiptFile,
                baseTotal,
                request.product_slug,
                userId
            );

            // 4. Create Visa Order record
            const orderNumber = `ORD-ZEL-${Date.now()}`;
            const { data: order, error: orderError } = await supabase
                .from('visa_orders')
                .insert({
                    order_number: orderNumber,
                    service_request_id: request.service_request_id,
                    product_slug: request.product_slug,
                    seller_id: request.seller_id,
                    client_name: request.client_name,
                    client_email: request.client_email,
                    client_whatsapp: request.client_whatsapp,
                    client_country: request.client_country,
                    client_nationality: request.client_nationality,
                    client_observations: request.client_observations,
                    dependent_names: request.dependent_names,
                    payment_method: 'zelle',
                    payment_status: 'pending', // Always pending for Zelle until admin approves
                    base_price_usd: product.base_price_usd || 0,
                    price_per_dependent_usd: product.price_per_dependent_usd || product.extra_unit_price || 0,
                    total_price_usd: baseTotal,
                    zelle_proof_url: n8nResult.imageUrl,
                    signature_image_url: request.signature_image_url,
                    contract_accepted: request.contract_accepted,
                    contract_signed_at: request.contract_signed_at,
                    contract_template_id: request.contract_template_id,
                    payment_metadata: {
                        n8n_validation: {
                            status: n8nResult.decision.status,
                            message: n8nResult.decision.message,
                            confidence: n8nResult.decision.confidence
                        }
                    }
                })
                .select()
                .single();

            if (orderError) {
                console.error('[ZelleService] CRITICAL Error creating visa_order:', orderError);
                throw new Error(`Failed to create order: ${orderError.message}`);
            }

            // 5. Create Zelle Payment record for the approval dashboard
            const { error: paymentRecordError } = await supabase
                .from('zelle_payments')
                .insert({
                    payment_id: n8nResult.paymentId,
                    order_id: order.id,
                    service_request_id: request.service_request_id,
                    user_id: userId,
                    amount: baseTotal,
                    currency: 'USD',
                    fee_type: request.product_slug,
                    screenshot_url: n8nResult.imageUrl,
                    image_path: n8nResult.imagePath,
                    n8n_response: n8nResult.n8nResponse,
                    n8n_confidence: n8nResult.decision.confidence,
                    n8n_validated_at: new Date().toISOString(),
                    status: 'pending_verification'
                });

            if (paymentRecordError) {
                console.error('[ZelleService] Error creating zelle_payment:', paymentRecordError);
            }

            return {
                success: true,
                order_id: order.id,
                message: n8nResult.decision.message,
                status: n8nResult.decision.status,
            };
        } catch (error) {
            console.error('[ZelleService] Error processing payment:', error);
            throw new Error(error instanceof Error ? error.message : 'Failed to process Zelle payment');
        }
    }
}
