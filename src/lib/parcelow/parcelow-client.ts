// Parcelow API Client - OAuth Authentication

import type {
  ParcelowClientConfig,
  ParcelowTokenResponse,
  ParcelowOrder,
  ParcelowSimulateResponse,
  ParcelowCreateOrderRequest,
  ParcelowCreateOrderResponse,
  ParcelowPaymentQuestions,
  ParcelowPaymentRequest,
  ParcelowPaymentResponse,
} from './parcelow-types';

export class ParcelowClient {
  private clientId: number | string; // Support both numeric and string IDs
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: ParcelowClientConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl =
      config.environment === 'staging'
        ? 'https://staging.parcelow.com'
        : 'https://app.parcelow.com'; // URL de produção (assumindo baseado na documentação)
  }

  /**
   * Get or refresh access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
      return this.accessToken;
    }

    // Request new token
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage =
          errorJson.message ||
          errorJson.error?.message ||
          `Parcelow API error: ${response.status} ${response.statusText}`;
      } catch {
        errorMessage = `Parcelow API error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const tokenData: ParcelowTokenResponse = await response.json();
    this.accessToken = tokenData.access_token;
    // Set expiration time (with buffer)
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;

    return this.accessToken;
  }

  /**
   * Generic request method with authentication
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
        const token = await this.getAccessToken();

        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
          // If 401, token might be expired, try refreshing
          if (response.status === 401 && attempt < retries) {
            this.accessToken = null;
            this.tokenExpiresAt = 0;
            continue;
          }

          const errorText = await response.text();
          let errorMessage: string;

          try {
            const errorJson = JSON.parse(errorText);
            errorMessage =
              errorJson.message ||
              errorJson.error?.message ||
              `Parcelow API error: ${response.status} ${response.statusText}`;
          } catch {
            errorMessage = `Parcelow API error: ${response.status} ${response.statusText}`;
          }

          // Retry on 429 (rate limit) or 5xx errors
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < retries
          ) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.warn(
              `Parcelow API request failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`
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
            `Parcelow API request failed after ${retries} attempts: ${error.message}`
          );
        }
      }
    }

    throw new Error('Parcelow API request failed: Max retries exceeded');
  }

  /**
   * Simulate payment options for a USD amount
   */
  async simulate(amount: number): Promise<ParcelowSimulateResponse> {
    // Amount should be in cents
    return await this.request<ParcelowSimulateResponse>(
      'GET',
      `/api/simulate?amount=${amount}`
    );
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<ParcelowOrder> {
    const response = await this.request<{ success: boolean; data: ParcelowOrder[] }>(
      'GET',
      `/api/order/${orderId}`
    );
    
    // API returns array, get first item
    if (response.success && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    }
    
    throw new Error('Order not found');
  }

  /**
   * Get orders by reference
   */
  async getOrdersByReference(reference: string): Promise<ParcelowOrder[]> {
    const response = await this.request<{ success: boolean; data: ParcelowOrder[] }>(
      'GET',
      `/api/orders/reference/${reference}`
    );
    
    if (response.success && Array.isArray(response.data)) {
      return response.data;
    }
    
    return [];
  }

  /**
   * Get payment options for an order
   */
  async getOrderOptions(orderId: string): Promise<ParcelowSimulateResponse> {
    return await this.request<ParcelowSimulateResponse>(
      'GET',
      `/api/order/${orderId}/options`
    );
  }

  /**
   * Create order in USD
   */
  async createOrderUSD(
    orderData: ParcelowCreateOrderRequest
  ): Promise<ParcelowCreateOrderResponse> {
    return await this.request<ParcelowCreateOrderResponse>(
      'POST',
      '/api/orders',
      orderData
    );
  }

  /**
   * Create order in BRL
   */
  async createOrderBRL(
    orderData: ParcelowCreateOrderRequest
  ): Promise<ParcelowCreateOrderResponse> {
    return await this.request<ParcelowCreateOrderResponse>(
      'POST',
      '/api/orders/brl',
      orderData
    );
  }

  /**
   * Get identity verification questions
   */
  async getQuestions(orderId: string): Promise<ParcelowPaymentQuestions> {
    return await this.request<ParcelowPaymentQuestions>(
      'GET',
      `/api/order/${orderId}/questions`
    );
  }

  /**
   * Submit identity verification answers
   */
  async submitAnswers(
    orderId: string,
    answers: Array<{ id: number; answer: number }>
  ): Promise<{ success: boolean; message: string }> {
    return await this.request<{ success: boolean; message: string }>(
      'POST',
      `/api/order/${orderId}/questions/answers`,
      { questions: answers }
    );
  }

  /**
   * Process credit card payment
   */
  async processCreditCardPayment(
    orderId: string,
    paymentData: ParcelowPaymentRequest
  ): Promise<ParcelowPaymentResponse> {
    return await this.request<ParcelowPaymentResponse>(
      'POST',
      `/api/order/${orderId}/payment`,
      paymentData
    );
  }

  /**
   * Process PIX payment
   */
  async processPixPayment(
    orderId: string
  ): Promise<ParcelowPaymentResponse> {
    return await this.request<ParcelowPaymentResponse>(
      'POST',
      `/api/order/${orderId}/payment`,
      { method: 'pix' }
    );
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    return await this.request<{ success: boolean; message: string }>(
      'POST',
      `/api/order/${orderId}/cancel`
    );
  }

  /**
   * Get coupon by code
   */
  async getCoupon(code: string): Promise<{ data: Array<{ code: string; value: string }> }> {
    return await this.request<{ data: Array<{ code: string; value: string }> }>(
      'GET',
      `/api/coupons?code=${code}`
    );
  }
}
