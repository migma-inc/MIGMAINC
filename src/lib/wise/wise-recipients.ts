// Wise Recipients Management

import { WiseClient } from './wise-client';
import type { WiseRecipient, CreateRecipientParams } from './wise-types';

/**
 * Create a Wise recipient account
 */
export async function createWiseRecipient(
  client: WiseClient,
  profileId: string,
  params: CreateRecipientParams
): Promise<WiseRecipient> {
  try {
    const recipient = await client.createRecipient(profileId, params);
    return recipient;
  } catch (error: any) {
    throw new Error(`Failed to create Wise recipient: ${error.message}`);
  }
}

/**
 * Get or create recipient for Migma (reuse existing if possible)
 */
export async function getOrCreateMigmaRecipient(
  client: WiseClient,
  profileId: string,
  migmaBankDetails: {
    accountHolderName: string;
    currency: string;
    type: 'iban' | 'sort_code' | 'aba' | 'swift';
    legalType: 'PRIVATE' | 'BUSINESS';
    details: CreateRecipientParams['details'];
  }
): Promise<WiseRecipient> {
  try {
    // Try to find existing recipient first
    // Note: Wise API may have an endpoint to list recipients
    // For now, we'll create a new one each time
    // TODO: Implement recipient caching/reuse if Wise API supports it
    
    return await createWiseRecipient(client, profileId, {
      currency: migmaBankDetails.currency,
      type: migmaBankDetails.type,
      accountHolderName: migmaBankDetails.accountHolderName,
      legalType: migmaBankDetails.legalType,
      details: migmaBankDetails.details,
    });
  } catch (error: any) {
    throw new Error(`Failed to get or create Migma recipient: ${error.message}`);
  }
}
