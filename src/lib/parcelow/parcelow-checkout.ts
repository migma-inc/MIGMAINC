// Parcelow Checkout Integration

import { ParcelowClient } from './parcelow-client';
import type {
  ParcelowCheckoutResult,
  ParcelowCreateOrderRequest,
  ParcelowClientData,
  ParcelowOrderItemData,
} from './parcelow-types';

export interface VisaOrderData {
  id: string;
  order_number: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_cpf?: string;
  client_birthdate?: string;
  client_cep?: string;
  client_address_street?: string;
  client_address_number?: number;
  client_address_neighborhood?: string;
  client_address_city?: string;
  client_address_state?: string;
  client_address_complement?: string;
  total_price_usd: number;
  product_name: string;
  product_description?: string;
}

/**
 * Create Parcelow order in USD
 */
export async function createParcelowOrderUSD(
  client: ParcelowClient,
  orderData: VisaOrderData,
  redirectUrls?: {
    success: string;
    failed: string;
  }
): Promise<ParcelowCheckoutResult> {
  try {
    // Prepare client data
    const clientData: ParcelowClientData = {
      cpf: orderData.client_cpf || '', // Required
      name: orderData.client_name,
      email: orderData.client_email,
      phone: orderData.client_phone || '',
      birthdate: orderData.client_birthdate, // Format: "YYYY-MM-DD"
      cep: orderData.client_cep,
      address_street: orderData.client_address_street,
      address_number: orderData.client_address_number,
      address_neighborhood: orderData.client_address_neighborhood,
      address_city: orderData.client_address_city,
      address_state: orderData.client_address_state,
      address_complement: orderData.client_address_complement,
    };

    // Prepare order items
    // Convert USD to cents
    const amountInCents = Math.round(orderData.total_price_usd * 100);
    const items: ParcelowOrderItemData[] = [
      {
        reference: orderData.order_number,
        description: orderData.product_name + (orderData.product_description ? ` - ${orderData.product_description}` : ''),
        quantity: 1,
        amount: amountInCents,
      },
    ];

    // Prepare order request
    const orderRequest: ParcelowCreateOrderRequest = {
      reference: orderData.order_number,
      partner_reference: orderData.id, // Use visa_order ID as partner reference
      client: clientData,
      items,
      redirect: redirectUrls,
    };

    // Create order
    const response = await client.createOrderUSD(orderRequest);

    if (!response.success || !response.data) {
      throw new Error('Failed to create Parcelow order');
    }

    return {
      order: await client.getOrder(response.data.order_id.toString()),
      orderId: response.data.order_id,
      checkoutUrl: response.data.url_checkout,
    };
  } catch (error: any) {
    throw new Error(`Failed to create Parcelow checkout: ${error.message}`);
  }
}

/**
 * Create Parcelow order in BRL
 */
export async function createParcelowOrderBRL(
  client: ParcelowClient,
  orderData: VisaOrderData,
  amountBRL: number, // Amount in BRL (reais, not cents)
  redirectUrls?: {
    success: string;
    failed: string;
  }
): Promise<ParcelowCheckoutResult> {
  try {
    // Prepare client data
    const clientData: ParcelowClientData = {
      cpf: orderData.client_cpf || '',
      name: orderData.client_name,
      email: orderData.client_email,
      phone: orderData.client_phone || '',
      birthdate: orderData.client_birthdate,
      cep: orderData.client_cep,
      address_street: orderData.client_address_street,
      address_number: orderData.client_address_number,
      address_neighborhood: orderData.client_address_neighborhood,
      address_city: orderData.client_address_city,
      address_state: orderData.client_address_state,
      address_complement: orderData.client_address_complement,
    };

    // Prepare order items
    // Convert BRL to cents
    const amountInCents = Math.round(amountBRL * 100);
    const items: ParcelowOrderItemData[] = [
      {
        reference: orderData.order_number,
        description: orderData.product_name + (orderData.product_description ? ` - ${orderData.product_description}` : ''),
        quantity: 1,
        amount: amountInCents,
      },
    ];

    // Prepare order request
    const orderRequest: ParcelowCreateOrderRequest = {
      reference: orderData.order_number,
      partner_reference: orderData.id,
      client: clientData,
      items,
      redirect: redirectUrls,
    };

    // Create order
    const response = await client.createOrderBRL(orderRequest);

    if (!response.success || !response.data) {
      throw new Error('Failed to create Parcelow order');
    }

    return {
      order: await client.getOrder(response.data.order_id.toString()),
      orderId: response.data.order_id,
      checkoutUrl: response.data.url_checkout,
    };
  } catch (error: any) {
    throw new Error(`Failed to create Parcelow checkout: ${error.message}`);
  }
}
