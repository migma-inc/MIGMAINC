// Wise Quotes Management

import { WiseClient } from './wise-client';
import type { WiseQuote, CreateQuoteParams } from './wise-types';

/**
 * Create a Wise quote for currency conversion
 */
export async function createWiseQuote(
  client: WiseClient,
  profileId: string,
  params: CreateQuoteParams
): Promise<WiseQuote> {
  try {
    const quote = await client.createQuote(profileId, params);
    return quote;
  } catch (error: any) {
    throw new Error(`Failed to create Wise quote: ${error.message}`);
  }
}
