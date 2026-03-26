import { supabase } from './supabase';

/**
 * Regenerates all visa-related documents for a specific order.
 * This invokes 3 Edge Functions: Contract, Annex, and Invoice.
 */
export async function regenerateVisaDocuments(orderId: string) {
  try {
    console.log(`[visa-utils] 🔄 Starting document regeneration for order: ${orderId}`);
    
    // We invoke them in parallel for speed, but wait for all to finish
    const results = await Promise.allSettled([
      supabase.functions.invoke('generate-visa-contract-pdf', { body: { order_id: orderId } }),
      supabase.functions.invoke('generate-annex-pdf', { body: { order_id: orderId } }),
      supabase.functions.invoke('generate-invoice-pdf', { body: { order_id: orderId } })
    ]);

    const failures = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
    
    if (failures.length > 0) {
      console.error(`[visa-utils] ❌ Some documents failed to regenerate:`, failures);
      return { 
        success: failures.length < 3, // Success if at least one succeeded? Or full success? Usually partial is better than nothing.
        error: 'One or more documents failed to generate. Please check Supabase logs.'
      };
    }

    console.log(`[visa-utils] ✅ All documents regenerated successfully for order: ${orderId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[visa-utils] ❌ Critical error during regeneration:`, error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}
