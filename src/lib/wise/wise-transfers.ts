// Wise Transfers Management

import { WiseClient } from './wise-client';
import type { WiseTransfer, CreateTransferParams } from './wise-types';

/**
 * Create a Wise transfer
 */
export async function createWiseTransfer(
  client: WiseClient,
  profileId: string,
  params: CreateTransferParams
): Promise<WiseTransfer> {
  try {
    const transfer = await client.createTransfer(profileId, params);
    return transfer;
  } catch (error: any) {
    throw new Error(`Failed to create Wise transfer: ${error.message}`);
  }
}

/**
 * Get transfer status
 */
export async function getWiseTransferStatus(
  client: WiseClient,
  transferId: string
): Promise<WiseTransfer> {
  try {
    const transfer = await client.getTransferStatus(transferId);
    return transfer;
  } catch (error: any) {
    throw new Error(`Failed to get Wise transfer status: ${error.message}`);
  }
}
