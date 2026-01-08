/**
 * Centralized Stripe Configuration
 * Orchestrates environment detection and variable mapping
 */

import { detectEnvironment, EnvironmentInfo } from './environment-detector.ts';
import {
  getStripeEnvironmentVariables,
  validateStripeEnvironmentVariables,
  StripeEnvironmentVariables,
} from './stripe-env-mapper.ts';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
  environment: EnvironmentInfo;
  apiVersion: string;
  appInfo: {
    name: string;
    version: string;
  };
}

/**
 * Gets complete Stripe configuration for the current request
 * Automatically detects environment and loads appropriate keys
 * @param req - The incoming HTTP request
 * @returns Complete Stripe configuration object
 * @throws Error if configuration is invalid or keys are missing
 */
export function getStripeConfig(req: Request): StripeConfig {
  // Step 1: Detect environment automatically
  const envInfo = detectEnvironment(req);

  // Step 2: Get the correct environment variables
  const envVars = getStripeEnvironmentVariables(envInfo);

  // Step 3: Validate that all variables are configured
  const validationErrors = validateStripeEnvironmentVariables(envVars, envInfo);
  if (validationErrors.length > 0) {
    throw new Error(`Stripe configuration errors: ${validationErrors.join(', ')}`);
  }

  // Step 4: Return complete configuration
  const config: StripeConfig = {
    secretKey: envVars.secretKey,
    webhookSecret: envVars.webhookSecret,
    publishableKey: envVars.publishableKey,
    environment: envInfo,
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'MIGMA Visa Services',
      version: '1.0.0',
    },
  };

  console.log(`🔧 Using Stripe in ${envInfo.environment} mode`);

  return config;
}

/**
 * Gets Stripe configuration specifically for webhooks
 * Uses a different approach since webhooks don't have referer/origin headers
 * @param req - The incoming HTTP request
 * @param verifiedEnvironment - Optional pre-verified environment from signature check
 * @returns Complete Stripe configuration object
 */
export function getStripeConfigForWebhook(
  req: Request,
  verifiedEnvironment?: 'production' | 'staging' | 'test'
): StripeConfig {
  if (verifiedEnvironment) {
    // Use the environment that was verified by signature check
    console.log(`🔐 Using verified environment: ${verifiedEnvironment}`);
    
    const suffix = verifiedEnvironment === 'production' ? 'PROD' : 'TEST';
    const envVars = {
      secretKey: Deno.env.get(`STRIPE_SECRET_KEY_${suffix}`) || '',
      webhookSecret: Deno.env.get(`STRIPE_WEBHOOK_SECRET_${suffix}`) || '',
      publishableKey: Deno.env.get(`STRIPE_PUBLISHABLE_KEY_${suffix}`) || '',
    };

    return {
      secretKey: envVars.secretKey,
      webhookSecret: envVars.webhookSecret,
      publishableKey: envVars.publishableKey,
      environment: {
        environment: verifiedEnvironment === 'production' ? 'production' : 'test',
        isProduction: verifiedEnvironment === 'production',
        isTest: verifiedEnvironment !== 'production',
        referer: '',
        origin: '',
        host: '',
        userAgent: req.headers.get('user-agent') || '',
      },
      apiVersion: '2024-12-18.acacia',
      appInfo: {
        name: 'MIGMA Visa Services',
        version: '1.0.0',
      },
    };
  }

  // Fallback to normal detection
  return getStripeConfig(req);
}































