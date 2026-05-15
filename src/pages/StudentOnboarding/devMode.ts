import type { OnboardingStep } from './types';

export const PRE_ONBOARDING_DEV_BYPASS_KEY = 'migma_pre_onboarding_dev_bypass';
export const PRE_ONBOARDING_DEV_SERVICE_KEY = 'migma_pre_onboarding_dev_service';

export const isLocalDevHost = () => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
};

export const isPreOnboardingDevBypassEnabled = () => {
  if (!isLocalDevHost()) return false;
  return window.localStorage.getItem(PRE_ONBOARDING_DEV_BYPASS_KEY) === '1';
};

export const enablePreOnboardingDevBypass = (service?: string | null) => {
  if (!isLocalDevHost()) return;
  window.localStorage.setItem(PRE_ONBOARDING_DEV_BYPASS_KEY, '1');
  if (service) {
    window.localStorage.setItem(PRE_ONBOARDING_DEV_SERVICE_KEY, service);
  }
};

export const disablePreOnboardingDevBypass = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PRE_ONBOARDING_DEV_BYPASS_KEY);
  window.localStorage.removeItem(PRE_ONBOARDING_DEV_SERVICE_KEY);
};

export const getPreOnboardingDevService = () => {
  if (!isLocalDevHost()) return null;
  return window.localStorage.getItem(PRE_ONBOARDING_DEV_SERVICE_KEY) || 'transfer';
};

export const buildPreOnboardingDevOnboardingUrl = (step: OnboardingStep = 'selection_survey') => {
  const params = new URLSearchParams();
  params.set('dev_pre_onboarding', '1');
  params.set('step', step);
  return `/student/onboarding?${params.toString()}`;
};
