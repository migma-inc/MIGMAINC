import { supabase } from './supabase';

/**
 * Validates if a visa contract view token is valid
 * @param token - Token to validate
 * @returns Token data if valid, null otherwise
 */
export async function validateVisaContractViewToken(token: string) {
    try {
        const { data: tokenData, error } = await supabase
            .from('visa_contract_view_tokens')
            .select('*')
            .eq('token', token)
            .single();

        if (error || !tokenData) {
            console.error('[VISA_CONTRACT_VIEW] Token not found or error:', error);
            return null;
        }

        // Check expiration if set (though tokens are generally infinite per requirements)
        if (tokenData.expires_at) {
            const expiresAt = new Date(tokenData.expires_at);
            if (new Date() > expiresAt) {
                console.warn('[VISA_CONTRACT_VIEW] Token expired');
                return null;
            }
        }

        return tokenData;
    } catch (error) {
        console.error('[VISA_CONTRACT_VIEW] Unexpected error validating token:', error);
        return null;
    }
}

/**
 * Fetches all necessary data to view a visa order contract
 * @param orderId - ID of the visa order
 * @returns Complete contract data object or null
 */
export async function getVisaContractViewData(orderId: string) {
    try {
        // Fetch order with related data
        const { data: order, error: orderError } = await supabase
            .from('visa_orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.error('[VISA_CONTRACT_VIEW] Error fetching order:', orderError);
            return null;
        }

        // Parallel fetch: Product, Template, and Identity Files (if service_request_id exists)
        // IMPORTANT: .then is not needed since the supabase query builder (like .single()) returns a Promise-like object (PostgrestBuilder).
        // However, Promise.all expects Promises, so we just pass the query builders directly, which act as promises.
        // If TypeScript complains, we can cast them or await them individually. Let's await individually to be safer/clearer.

        const productPromise = supabase.from('visa_products').select('*').eq('slug', order.product_slug).single();

        const templatePromise = supabase
            .from('contract_templates')
            .select('content')
            .eq('template_type', 'visa_service')
            .eq('product_slug', order.product_slug)
            .eq('is_active', true)
            .single();

        const annexTemplatePromise = supabase
            .from('contract_templates')
            .select('content')
            .eq('template_type', 'chargeback_annex')
            .eq('is_active', true)
            .maybeSingle();

        // Conditional promise for files
        let filesPromise;
        if (order.service_request_id) {
            filesPromise = supabase.from('identity_files').select('*').eq('service_request_id', order.service_request_id);
        } else {
            filesPromise = Promise.resolve({ data: [] });
        }

        const [productResult, templateResult, annexResult, filesResult] = await Promise.all([
            productPromise,
            templatePromise,
            annexTemplatePromise,
            filesPromise
        ]);

        const product = productResult.data;
        const template = templateResult.data;
        const annexTemplate = annexResult?.data;
        const identityFiles = filesResult?.data || [];

        // Construct image URLs object
        const imageUrls: Record<string, string | null> = {
            signature: null,
            documentFront: null,
            documentBack: null,
            selfieDoc: null
        };

        // Helper to get public URL
        const getPublicUrl = (path: string | null, bucket: string = 'visa-documents') => {
            if (!path) return null;
            if (path.startsWith('http')) return path;
            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
            return data.publicUrl;
        };

        // Signature
        imageUrls.signature = getPublicUrl(order.signature_image_url);

        // Documents from identity_files table
        if (identityFiles.length > 0) {
            identityFiles.forEach((file: any) => {
                const url = getPublicUrl(file.file_path);
                if (file.file_type === 'document_front') imageUrls.documentFront = url;
                if (file.file_type === 'document_back') imageUrls.documentBack = url;
                if (file.file_type === 'selfie_doc') imageUrls.selfieDoc = url;
            });
        }

        // Fallback to order columns if identity_files missing (legacy support)
        if (!imageUrls.documentFront && order.contract_document_url) {
            imageUrls.documentFront = getPublicUrl(order.contract_document_url);
        }
        if (!imageUrls.selfieDoc && order.contract_selfie_url) {
            imageUrls.selfieDoc = getPublicUrl(order.contract_selfie_url);
        }

        // Determine contract content
        let contractContent = '';
        if (template?.content) {
            contractContent = template.content;
        } else {
            // Fallback default terms
            contractContent = `
        <h2>Terms and Conditions</h2>
        <p>By signing this contract, the client agrees to the following terms:</p>
        <ol>
          <li>The client confirms that all information provided is accurate and truthful.</li>
          <li>The client understands that providing false information may result in cancellation of services.</li>
          <li>The client agrees to pay the total amount specified in this contract.</li>
          <li>MIGMA will provide visa consultation services as described in the service package.</li>
        </ol>
      `;
        }

        return {
            order,
            product,
            contractContent,
            annexContent: annexTemplate?.content || null,
            imageUrls
        };

    } catch (error) {
        console.error('[VISA_CONTRACT_VIEW] Error fetching contract data:', error);
        return null;
    }
}
