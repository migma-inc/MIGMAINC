/**
 * Stripe Environment Variable Mapper
 * Maps environment-specific Stripe variables based on detected environment
 */

import { EnvironmentInfo } from './environment-detector.ts';

export interface StripeEnvironmentVariables {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
}

/**
 * Gets the appropriate Stripe environment variables based on detected environment
 * @param envInfo - Environment information from detector
 * @returns Object containing the correct Stripe keys for the environment
 */
export function getStripeEnvironmentVariables(
  envInfo: EnvironmentInfo
): StripeEnvironmentVariables {
  let suffix: string;

  if (envInfo.isProduction) {
    suffix = 'PROD';
  } else {
    suffix = 'TEST';
  }

  const envVars: StripeEnvironmentVariables = {
    secretKey: Deno.env.get(`STRIPE_SECRET_KEY_${suffix}`) || '',
    webhookSecret: Deno.env.get(`STRIPE_WEBHOOK_SECRET_${suffix}`) || '',
    publishableKey: Deno.env.get(`STRIPE_PUBLISHABLE_KEY_${suffix}`) || '',
  };

  console.log(`🔑 Stripe Config (${envInfo.environment}):`, {
    secretKey: envVars.secretKey ? `${envVars.secretKey.substring(0, 20)}...` : '❌ Missing',
    webhookSecret: envVars.webhookSecret ? `${envVars.webhookSecret.substring(0, 20)}...` : '❌ Missing',
    publishableKey: envVars.publishableKey ? `${envVars.publishableKey.substring(0, 20)}...` : '❌ Missing',
  });

  return envVars;
}

/**
 * Validates that all required Stripe environment variables are present
 * @param envVars - Environment variables to validate
 * @param envInfo - Environment information for context
 * @returns Array of validation error messages (empty if all valid)
 */
export function validateStripeEnvironmentVariables(
  envVars: StripeEnvironmentVariables,
  envInfo: EnvironmentInfo
): string[] {
  const errors: string[] = [];
  const suffix = envInfo.isProduction ? 'PROD' : 'TEST';

  if (!envVars.secretKey) {
    errors.push(`Missing STRIPE_SECRET_KEY_${suffix}`);
  }

  if (!envVars.webhookSecret) {
    errors.push(`Missing STRIPE_WEBHOOK_SECRET_${suffix}`);
  }

  if (!envVars.publishableKey) {
    errors.push(`Missing STRIPE_PUBLISHABLE_KEY_${suffix}`);
  }

  if (errors.length > 0) {
    console.error('❌ Stripe configuration validation failed:', errors);
  } else {
    console.log(`✅ Stripe config loaded for ${envInfo.environment} environment`);
  }

  return errors;
}




























