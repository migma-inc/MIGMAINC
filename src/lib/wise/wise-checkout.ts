// Wise Checkout Integration

import { WiseClient } from './wise-client';
import { createWiseQuote } from './wise-quotes';
import { getOrCreateMigmaRecipient } from './wise-recipients';
import { createWiseTransfer } from './wise-transfers';
import type {
  WiseCheckoutResult,
  CreateQuoteParams,
  CreateRecipientParams,
} from './wise-types';

export interface VisaOrderData {
  id: string;
  order_number: string;
  client_name: string;
  total_price_usd: number;
}

export interface MigmaBankDetails {
  accountHolderName: string;
  currency: string;
  type: 'iban' | 'sort_code' | 'aba' | 'swift';
  legalType: 'PRIVATE' | 'BUSINESS';
  details: CreateRecipientParams['details'];
}

/**
 * Process Wise checkout - creates quote, recipient, and transfer
 */
export async function processWiseCheckout(
  client: WiseClient,
  profileId: string,
  orderData: VisaOrderData,
  migmaBankDetails: MigmaBankDetails,
  clientCurrency?: string // Currency the client will pay in (defaults to USD)
): Promise<WiseCheckoutResult> {
  try {
    // 1. Create quote (client pays in their currency -> Migma receives in USD)
    const quoteParams: CreateQuoteParams = {
      sourceCurrency: clientCurrency || 'USD',
      targetCurrency: migmaBankDetails.currency || 'USD',
      targetAmount: orderData.total_price_usd, // Amount Migma needs to receive
    };

    const quote = await createWiseQuote(client, profileId, quoteParams);

    // 2. Get or create recipient (Migma's account that receives payment)
    const recipient = await getOrCreateMigmaRecipient(
      client,
      profileId,
      migmaBankDetails
    );

    // 3. Create transfer
    const transfer = await createWiseTransfer(client, profileId, {
      quoteUuid: quote.id,
      recipientId: recipient.id,
      customerTransactionId: orderData.order_number, // Use order_number as unique ID
      reference: `Order ${orderData.order_number} - ${orderData.client_name}`,
    });

    // 4. Get payment URL (client will be redirected to Wise to pay)
    let paymentUrl: string | undefined;
    try {
      paymentUrl = await client.getPaymentUrl(transfer.id);
    } catch (error) {
      console.warn('Could not get payment URL from Wise API, using fallback');
      // Fallback: construct URL manually if API doesn't provide it
      paymentUrl = `https://wise.com/payments/${transfer.id}`;
    }

    return {
      transfer,
      quote,
      recipient,
      paymentUrl,
      transferId: transfer.id,
    };
  } catch (error: any) {
    throw new Error(`Failed to process Wise checkout: ${error.message}`);
  }
}
