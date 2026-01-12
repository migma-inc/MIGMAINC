// Wise API Client - Personal Token Authentication

import type {
  WiseClientConfig,
  WiseQuote,
  WiseRecipient,
  WiseTransfer,
  CreateQuoteParams,
  CreateRecipientParams,
  CreateTransferParams,
} from './wise-types';

export class WiseClient {
  private personalToken: string;
  private baseUrl: string;
  private profileId?: string;

  constructor(config: WiseClientConfig) {
    this.personalToken = config.personalToken;
    this.profileId = config.profileId;
    this.baseUrl =
      config.environment === 'sandbox'
        ? 'https://api.wise-sandbox.com'
        : 'https://api.wise.com';
  }

  /**
   * Generic request method with retry logic
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    retries = 3
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.personalToken}`,
            'Content-Type': 'application/json',
          },
          body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage: string;

          try {
            const errorJson = JSON.parse(errorText);
            errorMessage =
              errorJson.message ||
              errorJson.error?.message ||
              `Wise API error: ${response.status} ${response.statusText}`;
          } catch {
            errorMessage = `Wise API error: ${response.status} ${response.statusText}`;
          }

          // Retry on 429 (rate limit) or 5xx errors
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < retries
          ) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.warn(
              `Wise API request failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          throw new Error(errorMessage);
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (
          contentType &&
          contentType.includes('application/json') &&
          response.status !== 204
        ) {
          return await response.json();
        }

        return {} as T;
      } catch (error: any) {
        if (attempt === retries) {
          throw new Error(
            `Wise API request failed after ${retries} attempts: ${error.message}`
          );
        }
      }
    }

    throw new Error('Wise API request failed: Max retries exceeded');
  }

  /**
   * Get profile ID (if not set in constructor)
   */
  async getProfileId(): Promise<string> {
    if (this.profileId) {
      return this.profileId;
    }

    try {
      const profiles = await this.request<Array<{ id: number }>>(
        'GET',
        '/v1/profiles'
      );
      if (profiles && profiles.length > 0) {
        this.profileId = profiles[0].id.toString();
        return this.profileId;
      }
      throw new Error('No profile found in Wise account');
    } catch (error: any) {
      throw new Error(`Failed to get Wise profile ID: ${error.message}`);
    }
  }

  /**
   * Create a quote for currency conversion
   */
  async createQuote(
    profileId: string,
    params: CreateQuoteParams
  ): Promise<WiseQuote> {
    const { sourceCurrency, targetCurrency, sourceAmount, targetAmount } =
      params;

    if (!sourceAmount && !targetAmount) {
      throw new Error('Either sourceAmount or targetAmount must be provided');
    }

    const quoteData: any = {
      sourceCurrency,
      targetCurrency,
    };

    if (sourceAmount) {
      quoteData.sourceAmount = sourceAmount;
    } else if (targetAmount) {
      quoteData.targetAmount = targetAmount;
    }

    return await this.request<WiseQuote>(
      'POST',
      `/v3/profiles/${profileId}/quotes`,
      quoteData
    );
  }

  /**
   * Create a recipient account
   */
  async createRecipient(
    profileId: string,
    params: CreateRecipientParams
  ): Promise<WiseRecipient> {
    return await this.request<WiseRecipient>(
      'POST',
      `/v1/accounts`,
      {
        profile: profileId,
        ...params,
      }
    );
  }

  /**
   * Create a transfer
   */
  async createTransfer(
    _profileId: string,
    params: CreateTransferParams
  ): Promise<WiseTransfer> {
    const { quoteUuid, recipientId, customerTransactionId, reference } = params;

    return await this.request<WiseTransfer>(
      'POST',
      `/v1/transfers`,
      {
        targetAccount: recipientId,
        quoteUuid,
        customerTransactionId,
        reference: reference || `Transfer ${customerTransactionId}`,
      }
    );
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(transferId: string): Promise<WiseTransfer> {
    return await this.request<WiseTransfer>(
      'GET',
      `/v1/transfers/${transferId}`
    );
  }

  /**
   * Get payment URL for customer to complete payment
   * Note: This may vary depending on Wise API version
   */
  async getPaymentUrl(transferId: string): Promise<string> {
    // This endpoint may need to be adjusted based on Wise API documentation
    // For now, we'll construct a URL that redirects to Wise payment page
    // Note: This method is not currently used - payment URL is generated in Edge Function
    return `https://wise.com/payments/${transferId}`;
  }
}
