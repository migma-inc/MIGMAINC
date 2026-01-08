import { supabase } from './supabase';

/**
 * Interface for n8n webhook payload
 */
export interface N8nWebhookPayload {
  user_id: string | null;
  image_url: string;
  value: string; // Amount as string (e.g., "150.00")
  currency: string;
  fee_type: string; // product_slug (e.g., 'initial', 'b1-premium')
  timestamp: string; // ISO 8601
  payment_id: string; // UUID
  scholarships_ids?: string[];
  scholarship_application_id?: string;
  promotional_coupon?: string;
  promotional_discount_amount?: number;
  original_amount?: number;
  final_amount?: number;
}

/**
 * Interface for n8n response
 */
export interface N8nResponse {
  response: string; // Main validation message
  status?: string; // 'valid', 'invalid', 'pending'
  confidence?: number; // 0.0 to 1.0
  details?: {
    amount?: string;
    date?: string;
    recipient?: string;
    confirmation_code?: string;
    reason?: string;
    expected?: string;
    found?: string;
    suggestions?: string[];
  };
}

/**
 * Result of processing n8n response
 */
export interface ProcessN8nResponseResult {
  isValid: boolean;
  requiresManualReview: boolean;
  status: 'approved' | 'pending_verification' | 'rejected';
  message: string;
  confidence?: number;
}

/**
 * Decision result based on n8n response
 */
export interface PaymentStatusDecision {
  status: 'approved' | 'pending_verification' | 'rejected';
  shouldApprove: boolean;
  shouldNotifyAdmin: boolean;
  message: string;
  confidence?: number;
}

/**
 * Upload Zelle receipt to Supabase Storage
 * Uploads to zelle_comprovantes bucket
 */
export async function uploadZelleReceipt(
  file: File,
  userId?: string | null
): Promise<{ imageUrl: string; imagePath: string }> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const fileName = `zelle-payment-${timestamp}.${fileExt}`;
  
  // Build path: zelle-payments/{user_id}/zelle-payment-{timestamp}.{ext}
  const userFolder = userId || 'anonymous';
  const filePath = `zelle-payments/${userFolder}/${fileName}`;

  // Upload to zelle_comprovantes bucket
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('zelle_comprovantes')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload receipt: ${uploadError.message}`);
  }

  if (!uploadData) {
    throw new Error('Failed to upload receipt: No data returned');
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('zelle_comprovantes')
    .getPublicUrl(uploadData.path);

  return {
    imageUrl: publicUrl,
    imagePath: uploadData.path,
  };
}

/**
 * Build n8n webhook payload
 */
export function buildN8nPayload(
  userId: string | null,
  imageUrl: string,
  amount: number,
  productSlug: string,
  paymentId: string,
  options?: {
    scholarshipsIds?: string[];
    scholarshipApplicationId?: string;
    promotionalCoupon?: {
      code: string;
      discountAmount: number;
      originalAmount: number;
      finalAmount: number;
    };
  }
): N8nWebhookPayload {
  const payload: N8nWebhookPayload = {
    user_id: userId,
    image_url: imageUrl,
    value: amount.toString(), // Convert to string without currency symbols
    currency: 'USD',
    fee_type: productSlug, // Use product_slug as fee_type
    timestamp: new Date().toISOString(),
    payment_id: paymentId,
  };

  // Add optional fields
  if (options?.scholarshipsIds && options.scholarshipsIds.length > 0) {
    payload.scholarships_ids = options.scholarshipsIds;
  }

  if (options?.scholarshipApplicationId) {
    payload.scholarship_application_id = options.scholarshipApplicationId;
  }

  if (options?.promotionalCoupon) {
    payload.promotional_coupon = options.promotionalCoupon.code;
    payload.promotional_discount_amount = options.promotionalCoupon.discountAmount;
    payload.original_amount = options.promotionalCoupon.originalAmount;
    payload.final_amount = options.promotionalCoupon.finalAmount;
  }

  return payload;
}

/**
 * Send Zelle payment to n8n for validation
 */
export async function sendZellePaymentToN8n(
  payload: N8nWebhookPayload,
  timeout: number = 30000 // 30 seconds default timeout
): Promise<N8nResponse> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[Zelle n8n] VITE_N8N_WEBHOOK_URL not configured, skipping n8n validation');
    throw new Error('n8n webhook URL not configured');
  }

  // Validate URL format
  try {
    new URL(webhookUrl);
  } catch (error) {
    throw new Error(`Invalid n8n webhook URL: ${webhookUrl}`);
  }

  console.log('[Zelle n8n] Sending payload to n8n:', {
    url: webhookUrl,
    payment_id: payload.payment_id,
    fee_type: payload.fee_type,
    value: payload.value,
  });

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Parse response
    const responseText = await response.text();
    let n8nResponse: N8nResponse;

    try {
      n8nResponse = JSON.parse(responseText);
    } catch (e) {
      // If not JSON, treat as plain text
      n8nResponse = {
        response: responseText,
      };
    }

    console.log('[Zelle n8n] Received response:', {
      response: n8nResponse.response,
      status: n8nResponse.status,
      confidence: n8nResponse.confidence,
    });

    return n8nResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('n8n webhook timeout - request took longer than 30 seconds');
    }
    
    throw error;
  }
}

/**
 * Process n8n response and determine validation result
 */
export function processN8nResponse(n8nResponse: N8nResponse): ProcessN8nResponseResult {
  // Check if response is valid
  if (!n8nResponse || !n8nResponse.response) {
    return {
      isValid: false,
      requiresManualReview: true,
      status: 'pending_verification',
      message: 'Invalid response from n8n',
    };
  }

  // Normalize response for comparison
  const response = n8nResponse.response.toLowerCase().trim();
  const isValidResponse = response === 'the proof of payment is valid.';

  // Get confidence (default to 1.0 if not provided)
  const confidence = n8nResponse.confidence ?? 1.0;
  const hasLowConfidence = confidence < 0.7;

  // Determine status
  if (isValidResponse && !hasLowConfidence) {
    return {
      isValid: true,
      requiresManualReview: false,
      status: 'approved',
      message: 'Payment approved automatically by n8n',
      confidence,
    };
  } else if (isValidResponse && hasLowConfidence) {
    return {
      isValid: true,
      requiresManualReview: true,
      status: 'pending_verification',
      message: `Payment valid but requires manual confirmation (confidence: ${(confidence * 100).toFixed(0)}%)`,
      confidence,
    };
  } else {
    return {
      isValid: false,
      requiresManualReview: true,
      status: 'pending_verification',
      message: n8nResponse.response || 'Requires manual review',
      confidence,
    };
  }
}

/**
 * Determine payment status based on n8n response
 */
export function determinePaymentStatus(n8nResponse: N8nResponse): PaymentStatusDecision {
  // Case 1: Empty or invalid response
  if (!n8nResponse || !n8nResponse.response) {
    return {
      status: 'pending_verification',
      shouldApprove: false,
      shouldNotifyAdmin: true,
      message: 'Invalid response from n8n - requires manual review',
    };
  }

  // Case 2: Positive response
  const response = n8nResponse.response.toLowerCase().trim();
  const isPositiveResponse = response === 'the proof of payment is valid.';

  if (isPositiveResponse) {
    const confidence = n8nResponse.confidence ?? 1.0;

    if (confidence >= 0.7) {
      return {
        status: 'approved',
        shouldApprove: true,
        shouldNotifyAdmin: false,
        message: 'Payment approved automatically',
        confidence,
      };
    } else {
      return {
        status: 'pending_verification',
        shouldApprove: false,
        shouldNotifyAdmin: true,
        message: `Payment valid but with low confidence (${(confidence * 100).toFixed(0)}%) - requires confirmation`,
        confidence,
      };
    }
  }

  // Case 3: Negative or ambiguous response
  return {
    status: 'pending_verification',
    shouldApprove: false,
    shouldNotifyAdmin: true,
    message: n8nResponse.response || 'Requires manual review',
    confidence: n8nResponse.confidence,
  };
}

/**
 * Complete flow: Upload receipt, send to n8n, and process response
 */
export async function processZellePaymentWithN8n(
  file: File,
  amount: number,
  productSlug: string,
  userId?: string | null,
  options?: {
    scholarshipsIds?: string[];
    scholarshipApplicationId?: string;
    promotionalCoupon?: {
      code: string;
      discountAmount: number;
      originalAmount: number;
      finalAmount: number;
    };
  }
): Promise<{
  paymentId: string;
  imageUrl: string;
  imagePath: string;
  n8nResponse: N8nResponse;
  result: ProcessN8nResponseResult;
  decision: PaymentStatusDecision;
}> {
  // 1. Generate unique payment ID
  const paymentId = crypto.randomUUID();

  // 2. Upload receipt to storage
  const { imageUrl, imagePath } = await uploadZelleReceipt(file, userId);

  // 3. Build payload
  const payload = buildN8nPayload(
    userId || null,
    imageUrl,
    amount,
    productSlug,
    paymentId,
    options
  );

  // 4. Send to n8n (with error handling)
  let n8nResponse: N8nResponse;
  try {
    n8nResponse = await sendZellePaymentToN8n(payload);
  } catch (error) {
    console.error('[Zelle n8n] Error sending to n8n:', error);
    // Return a default response for error case
    n8nResponse = {
      response: 'Error validating payment - requires manual review',
      status: 'pending',
    };
  }

  // 5. Process response
  const result = processN8nResponse(n8nResponse);
  const decision = determinePaymentStatus(n8nResponse);

  return {
    paymentId,
    imageUrl,
    imagePath,
    n8nResponse,
    result,
    decision,
  };
}
