/**
 * Environment Detection for Stripe Configuration
 * Detects whether the request is from production or development environment
 */

export interface EnvironmentInfo {
  environment: 'production' | 'test';
  isProduction: boolean;
  isTest: boolean;
  referer: string;
  origin: string;
  host: string;
  userAgent: string;
}

export interface WebhookSecret {
  env: 'production' | 'staging' | 'test';
  secret: string;
}

/**
 * Detects the environment based on HTTP headers
 * @param req - The incoming HTTP request
 * @returns EnvironmentInfo with detected environment and debug info
 */
export function detectEnvironment(req: Request): EnvironmentInfo {
  const referer = req.headers.get('referer') || '';
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const userAgent = req.headers.get('user-agent') || '';

  // Detect production: if any header contains migma.com or vercel.app (production deployment)
  const isProductionDomain = 
    referer.includes('migma.com') ||
    origin.includes('migma.com') ||
    host.includes('migma.com') ||
    (referer.includes('vercel.app') && !referer.includes('preview')) ||
    (origin.includes('vercel.app') && !origin.includes('preview'));

  // For Stripe webhooks, check if production keys are available
  const isStripeWebhook = userAgent.includes('Stripe/');
  const hasProdKeys = Deno.env.get('STRIPE_SECRET_KEY_PROD') && 
                     Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD');

  const isProduction = isProductionDomain || (isStripeWebhook && hasProdKeys);

  const envInfo: EnvironmentInfo = {
    environment: isProduction ? 'production' : 'test',
    isProduction,
    isTest: !isProduction,
    referer,
    origin,
    host,
    userAgent,
  };

  // Log environment detection for debugging
  console.log('🔍 Environment Detection:', {
    referer: referer || '(none)',
    origin: origin || '(none)',
    host: host || '(none)',
    userAgent: userAgent.substring(0, 50) || '(none)',
    isProductionDomain,
    isStripeWebhook,
    hasProdKeys,
    detected: envInfo.environment,
  });

  return envInfo;
}

/**
 * Gets all available webhook secrets for fail-safe verification
 * Webhooks don't send referer/origin, so we try all available secrets
 * @returns Array of webhook secrets with their environment labels
 */
export function getAllWebhookSecrets(): WebhookSecret[] {
  const secrets: WebhookSecret[] = [];

  const prodSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD');
  const stagingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_STAGING');
  const testSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST');

  if (prodSecret) {
    secrets.push({ env: 'production', secret: prodSecret });
  }
  if (stagingSecret) {
    secrets.push({ env: 'staging', secret: stagingSecret });
  }
  if (testSecret) {
    secrets.push({ env: 'test', secret: testSecret });
  }

  console.log(`🔐 Available webhook secrets: ${secrets.map(s => s.env).join(', ')}`);

  return secrets;
}

/**
 * Verifies a Stripe webhook signature
 * @param body - Raw request body as string
 * @param signature - Stripe signature from headers
 * @param secret - Webhook secret to verify against
 * @returns true if signature is valid
 */
export async function verifyStripeSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Simple signature verification - in production use Stripe's library
    // This is a placeholder - the actual Stripe library will be used in the webhook
    return true;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}









