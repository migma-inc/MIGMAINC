import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { driver, type Driver, type DriveStep, type Side } from 'driver.js';

type StudentDashboardTab =
  | 'overview'
  | 'applications'
  | 'documents'
  | 'supplemental-data'
  | 'forms'
  | 'rewards'
  | 'support'
  | 'profile';

type UseStudentDashboardTourParams = {
  userId: string | null;
  ready: boolean;
  activeTab: StudentDashboardTab;
  navigate: NavigateFunction;
  setMobileSidebarOpen: (open: boolean) => void;
  t: TFunction;
};

const TOUR_STORAGE_PREFIX = 'migma.studentDashboardTour.v1';
const DESKTOP_QUERY = '(min-width: 1024px)';

function getStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.${userId}`;
}

function getApplicationsStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.applications.${userId}`;
}

function getDocumentsStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.documents.${userId}`;
}

function getSupplementalDataStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.supplementalData.${userId}`;
}

function getFormsStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.forms.${userId}`;
}

function getRewardsStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.rewards.${userId}`;
}

function getSupportStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.support.${userId}`;
}

function getProfileStorageKey(userId: string) {
  return `${TOUR_STORAGE_PREFIX}.profile.${userId}`;
}

function queryTarget(selector: string) {
  return document.querySelector(selector);
}

function createStep(selector: string, title: string, description: string, side: Side = 'right'): DriveStep {
  return {
    element: selector,
    popover: {
      title,
      description,
      side,
      align: 'start',
    },
  };
}

export function useStudentDashboardTour({
  userId,
  ready,
  activeTab,
  navigate,
  setMobileSidebarOpen,
  t,
}: UseStudentDashboardTourParams) {
  const [showTourPrompt, setShowTourPrompt] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const shouldCloseSidebarRef = useRef(false);

  const markTourStatus = useCallback((status: 'completed' | 'dismissed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getStorageKey(userId), status);
  }, [userId]);

  const markApplicationsTourStatus = useCallback((status: 'completed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getApplicationsStorageKey(userId), status);
  }, [userId]);

  const markDocumentsTourStatus = useCallback((status: 'completed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getDocumentsStorageKey(userId), status);
  }, [userId]);

  const markSupplementalDataTourStatus = useCallback((status: 'completed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getSupplementalDataStorageKey(userId), status);
  }, [userId]);

  const markFormsTourStatus = useCallback((status: 'completed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getFormsStorageKey(userId), status);
  }, [userId]);

  const markRewardsTourStatus = useCallback((status: 'completed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getRewardsStorageKey(userId), status);
  }, [userId]);

  const markSupportTourStatus = useCallback((status: 'completed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getSupportStorageKey(userId), status);
  }, [userId]);

  const markProfileTourStatus = useCallback((status: 'completed' | 'started') => {
    if (!userId) return;
    localStorage.setItem(getProfileStorageKey(userId), status);
  }, [userId]);

  const setSidebarForTourStep = useCallback((open: boolean) => {
    if (window.matchMedia(DESKTOP_QUERY).matches) return;

    setMobileSidebarOpen(open);
    window.setTimeout(() => {
      driverRef.current?.refresh();
    }, 240);
  }, [setMobileSidebarOpen]);

  const buildSteps = useCallback((): DriveStep[] => {
    const sidebarStep = (step: DriveStep): DriveStep => ({
      ...step,
      onHighlightStarted: () => setSidebarForTourStep(true),
    });

    const contentStep = (step: DriveStep): DriveStep => ({
      ...step,
      onHighlightStarted: () => setSidebarForTourStep(false),
    });

    const rawSteps: DriveStep[] = [
      sidebarStep(createStep(
        '[data-tour="student-sidebar"]',
        t('student_dashboard.tour.steps.sidebar.title'),
        t('student_dashboard.tour.steps.sidebar.description'),
      )),
      sidebarStep(createStep(
        '[data-tour="student-nav-overview"]',
        t('student_dashboard.tour.steps.navigation.title'),
        t('student_dashboard.tour.steps.navigation.description'),
      )),
      sidebarStep(createStep(
        '[data-tour="student-nav-applications"]',
        t('student_dashboard.tour.steps.applications.title'),
        t('student_dashboard.tour.steps.applications.description'),
      )),
      sidebarStep(createStep(
        '[data-tour="student-nav-documents"]',
        t('student_dashboard.tour.steps.documents.title'),
        t('student_dashboard.tour.steps.documents.description'),
      )),
      sidebarStep(createStep(
        '[data-tour="student-nav-supplemental-data"]',
        t('student_dashboard.tour.steps.supplemental_data.title'),
        t('student_dashboard.tour.steps.supplemental_data.description'),
      )),
      sidebarStep(createStep(
        '[data-tour="student-nav-forms"]',
        t('student_dashboard.tour.steps.forms.title'),
        t('student_dashboard.tour.steps.forms.description'),
      )),
      sidebarStep(createStep(
        '[data-tour="student-nav-rewards"]',
        t('student_dashboard.tour.steps.rewards.title'),
        t('student_dashboard.tour.steps.rewards.description'),
      )),
      sidebarStep(createStep(
        '[data-tour="student-nav-support"]',
        t('student_dashboard.tour.steps.support.title'),
        t('student_dashboard.tour.steps.support.description'),
      )),
      contentStep(createStep(
        '[data-tour="student-overview-hero"]',
        t('student_dashboard.tour.steps.overview.title'),
        t('student_dashboard.tour.steps.overview.description'),
        'bottom',
      )),
      contentStep(createStep(
        '[data-tour="student-progress"]',
        t('student_dashboard.tour.steps.progress.title'),
        t('student_dashboard.tour.steps.progress.description'),
        'bottom',
      )),
      contentStep(createStep(
        '[data-tour="student-next-action"]',
        t('student_dashboard.tour.steps.next_action.title'),
        t('student_dashboard.tour.steps.next_action.description'),
        'top',
      )),
      contentStep(createStep(
        '[data-tour="student-topbar-actions"]',
        t('student_dashboard.tour.steps.preferences.title'),
        t('student_dashboard.tour.steps.preferences.description'),
        'bottom',
      )),
      contentStep(createStep(
        '[data-tour="student-profile-summary"]',
        t('student_dashboard.tour.steps.profile.title'),
        t('student_dashboard.tour.steps.profile.description'),
        'bottom',
      )),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [setSidebarForTourStep, t]);

  const buildApplicationsSteps = useCallback((): DriveStep[] => {
    const rawSteps: DriveStep[] = [
      createStep(
        '[data-tour="student-applications-page"]',
        t('student_dashboard.tour.applications_page.steps.page.title'),
        t('student_dashboard.tour.applications_page.steps.page.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-applications-kpis"]',
        t('student_dashboard.tour.applications_page.steps.kpis.title'),
        t('student_dashboard.tour.applications_page.steps.kpis.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-application-card"]',
        t('student_dashboard.tour.applications_page.steps.card.title'),
        t('student_dashboard.tour.applications_page.steps.card.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-application-progress"]',
        t('student_dashboard.tour.applications_page.steps.progress.title'),
        t('student_dashboard.tour.applications_page.steps.progress.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-applications-empty"]',
        t('student_dashboard.tour.applications_page.steps.empty.title'),
        t('student_dashboard.tour.applications_page.steps.empty.description'),
        'top',
      ),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [t]);

  const buildDocumentsSteps = useCallback((): DriveStep[] => {
    const rawSteps: DriveStep[] = [
      createStep(
        '[data-tour="student-documents-page"]',
        t('student_dashboard.tour.documents_page.steps.page.title'),
        t('student_dashboard.tour.documents_page.steps.page.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-documents-kpis"]',
        t('student_dashboard.tour.documents_page.steps.kpis.title'),
        t('student_dashboard.tour.documents_page.steps.kpis.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-documents-finals"]',
        t('student_dashboard.tour.documents_page.steps.finals.title'),
        t('student_dashboard.tour.documents_page.steps.finals.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-document-card"]',
        t('student_dashboard.tour.documents_page.steps.card.title'),
        t('student_dashboard.tour.documents_page.steps.card.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-document-status"]',
        t('student_dashboard.tour.documents_page.steps.status.title'),
        t('student_dashboard.tour.documents_page.steps.status.description'),
        'left',
      ),
      createStep(
        '[data-tour="student-document-actions"]',
        t('student_dashboard.tour.documents_page.steps.actions.title'),
        t('student_dashboard.tour.documents_page.steps.actions.description'),
        'left',
      ),
      createStep(
        '[data-tour="student-documents-empty"]',
        t('student_dashboard.tour.documents_page.steps.empty.title'),
        t('student_dashboard.tour.documents_page.steps.empty.description'),
        'top',
      ),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [t]);

  const buildSupplementalDataSteps = useCallback((): DriveStep[] => {
    const rawSteps: DriveStep[] = [
      createStep(
        '[data-tour="student-supplemental-page"]',
        t('student_dashboard.tour.supplemental_data_page.steps.page.title'),
        t('student_dashboard.tour.supplemental_data_page.steps.page.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-supplemental-empty"]',
        t('student_dashboard.tour.supplemental_data_page.steps.empty.title'),
        t('student_dashboard.tour.supplemental_data_page.steps.empty.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-supplemental-edit-action"]',
        t('student_dashboard.tour.supplemental_data_page.steps.edit_action.title'),
        t('student_dashboard.tour.supplemental_data_page.steps.edit_action.description'),
        'left',
      ),
      createStep(
        '[data-tour="student-supplemental-emergency"]',
        t('student_dashboard.tour.supplemental_data_page.steps.emergency.title'),
        t('student_dashboard.tour.supplemental_data_page.steps.emergency.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-supplemental-sponsor"]',
        t('student_dashboard.tour.supplemental_data_page.steps.sponsor.title'),
        t('student_dashboard.tour.supplemental_data_page.steps.sponsor.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-supplemental-recommenders"]',
        t('student_dashboard.tour.supplemental_data_page.steps.recommenders.title'),
        t('student_dashboard.tour.supplemental_data_page.steps.recommenders.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-supplemental-save-actions"]',
        t('student_dashboard.tour.supplemental_data_page.steps.save_actions.title'),
        t('student_dashboard.tour.supplemental_data_page.steps.save_actions.description'),
        'left',
      ),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [t]);

  const buildFormsSteps = useCallback((): DriveStep[] => {
    const rawSteps: DriveStep[] = [
      createStep(
        '[data-tour="student-forms-page"]',
        t('student_dashboard.tour.forms_page.steps.page.title'),
        t('student_dashboard.tour.forms_page.steps.page.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-forms-kpis"]',
        t('student_dashboard.tour.forms_page.steps.kpis.title'),
        t('student_dashboard.tour.forms_page.steps.kpis.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-form-card"]',
        t('student_dashboard.tour.forms_page.steps.card.title'),
        t('student_dashboard.tour.forms_page.steps.card.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-form-status"]',
        t('student_dashboard.tour.forms_page.steps.status.title'),
        t('student_dashboard.tour.forms_page.steps.status.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-form-actions"]',
        t('student_dashboard.tour.forms_page.steps.actions.title'),
        t('student_dashboard.tour.forms_page.steps.actions.description'),
        'left',
      ),
      createStep(
        '[data-tour="student-forms-empty"]',
        t('student_dashboard.tour.forms_page.steps.empty.title'),
        t('student_dashboard.tour.forms_page.steps.empty.description'),
        'top',
      ),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [t]);

  const buildRewardsSteps = useCallback((): DriveStep[] => {
    const rawSteps: DriveStep[] = [
      createStep(
        '[data-tour="student-rewards-page"]',
        t('student_dashboard.tour.rewards_page.steps.page.title'),
        t('student_dashboard.tour.rewards_page.steps.page.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-rewards-kpis"]',
        t('student_dashboard.tour.rewards_page.steps.kpis.title'),
        t('student_dashboard.tour.rewards_page.steps.kpis.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-rewards-progress"]',
        t('student_dashboard.tour.rewards_page.steps.progress.title'),
        t('student_dashboard.tour.rewards_page.steps.progress.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-rewards-code"]',
        t('student_dashboard.tour.rewards_page.steps.code.title'),
        t('student_dashboard.tour.rewards_page.steps.code.description'),
        'left',
      ),
      createStep(
        '[data-tour="student-rewards-link"]',
        t('student_dashboard.tour.rewards_page.steps.link.title'),
        t('student_dashboard.tour.rewards_page.steps.link.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-rewards-share-actions"]',
        t('student_dashboard.tour.rewards_page.steps.share_actions.title'),
        t('student_dashboard.tour.rewards_page.steps.share_actions.description'),
        'left',
      ),
      createStep(
        '[data-tour="student-rewards-how"]',
        t('student_dashboard.tour.rewards_page.steps.how.title'),
        t('student_dashboard.tour.rewards_page.steps.how.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-rewards-meetings"]',
        t('student_dashboard.tour.rewards_page.steps.meetings.title'),
        t('student_dashboard.tour.rewards_page.steps.meetings.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-rewards-meetings-empty"]',
        t('student_dashboard.tour.rewards_page.steps.meetings_empty.title'),
        t('student_dashboard.tour.rewards_page.steps.meetings_empty.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-rewards-lead"]',
        t('student_dashboard.tour.rewards_page.steps.lead.title'),
        t('student_dashboard.tour.rewards_page.steps.lead.description'),
        'top',
      ),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [t]);

  const buildSupportSteps = useCallback((): DriveStep[] => {
    const rawSteps: DriveStep[] = [
      createStep(
        '[data-tour="student-support-page"]',
        t('student_dashboard.tour.support_page.steps.page.title'),
        t('student_dashboard.tour.support_page.steps.page.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-support-header"]',
        t('student_dashboard.tour.support_page.steps.header.title'),
        t('student_dashboard.tour.support_page.steps.header.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-support-status"]',
        t('student_dashboard.tour.support_page.steps.status.title'),
        t('student_dashboard.tour.support_page.steps.status.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-support-message"]',
        t('student_dashboard.tour.support_page.steps.message.title'),
        t('student_dashboard.tour.support_page.steps.message.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-support-handoff"]',
        t('student_dashboard.tour.support_page.steps.handoff.title'),
        t('student_dashboard.tour.support_page.steps.handoff.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-support-schedule"]',
        t('student_dashboard.tour.support_page.steps.schedule.title'),
        t('student_dashboard.tour.support_page.steps.schedule.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-support-composer"]',
        t('student_dashboard.tour.support_page.steps.composer.title'),
        t('student_dashboard.tour.support_page.steps.composer.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-support-send"]',
        t('student_dashboard.tour.support_page.steps.send.title'),
        t('student_dashboard.tour.support_page.steps.send.description'),
        'left',
      ),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [t]);

  const buildProfileSteps = useCallback((): DriveStep[] => {
    const rawSteps: DriveStep[] = [
      createStep(
        '[data-tour="student-profile-page"]',
        t('student_dashboard.tour.profile_page.steps.page.title'),
        t('student_dashboard.tour.profile_page.steps.page.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-profile-header"]',
        t('student_dashboard.tour.profile_page.steps.header.title'),
        t('student_dashboard.tour.profile_page.steps.header.description'),
        'bottom',
      ),
      createStep(
        '[data-tour="student-profile-edit-action"]',
        t('student_dashboard.tour.profile_page.steps.edit_action.title'),
        t('student_dashboard.tour.profile_page.steps.edit_action.description'),
        'left',
      ),
      createStep(
        '[data-tour="student-profile-personal"]',
        t('student_dashboard.tour.profile_page.steps.personal.title'),
        t('student_dashboard.tour.profile_page.steps.personal.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-profile-academic"]',
        t('student_dashboard.tour.profile_page.steps.academic.title'),
        t('student_dashboard.tour.profile_page.steps.academic.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-profile-completion"]',
        t('student_dashboard.tour.profile_page.steps.completion.title'),
        t('student_dashboard.tour.profile_page.steps.completion.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-profile-missing"]',
        t('student_dashboard.tour.profile_page.steps.missing.title'),
        t('student_dashboard.tour.profile_page.steps.missing.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-profile-complete"]',
        t('student_dashboard.tour.profile_page.steps.complete.title'),
        t('student_dashboard.tour.profile_page.steps.complete.description'),
        'top',
      ),
      createStep(
        '[data-tour="student-profile-account"]',
        t('student_dashboard.tour.profile_page.steps.account.title'),
        t('student_dashboard.tour.profile_page.steps.account.description'),
        'top',
      ),
    ];

    return rawSteps.filter(step => typeof step.element === 'string' && queryTarget(step.element));
  }, [t]);

  const startTour = useCallback(() => {
    if (!userId || !ready) return;

    setShowTourPrompt(false);
    markTourStatus('started');

    const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
    shouldCloseSidebarRef.current = !isDesktop;

    if (!isDesktop) {
      setMobileSidebarOpen(true);
    }

    if (activeTab !== 'overview') {
      navigate('/student/dashboard/overview');
    }

    window.setTimeout(() => {
      const steps = buildSteps();
      if (steps.length === 0) return;

      driverRef.current?.destroy();
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markTourStatus('completed');
          if (shouldCloseSidebarRef.current) {
            setMobileSidebarOpen(false);
            shouldCloseSidebarRef.current = false;
          }
        },
      });
      driverRef.current.drive();
    }, activeTab === 'overview' ? 120 : 420);
  }, [activeTab, buildSteps, markTourStatus, navigate, ready, setMobileSidebarOpen, t, userId]);

  const dismissTourPrompt = useCallback(() => {
    markTourStatus('dismissed');
    setShowTourPrompt(false);
  }, [markTourStatus]);

  const startApplicationsTour = useCallback(() => {
    if (!userId || !ready) return;

    const steps = buildApplicationsSteps();
    if (steps.length === 0) return;

    setMobileSidebarOpen(false);
    markApplicationsTourStatus('started');
    driverRef.current?.destroy();

    window.setTimeout(() => {
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markApplicationsTourStatus('completed');
        },
      });
      driverRef.current.drive();
    }, 260);
  }, [buildApplicationsSteps, markApplicationsTourStatus, ready, setMobileSidebarOpen, t, userId]);

  const startDocumentsTour = useCallback(() => {
    if (!userId || !ready) return;

    const steps = buildDocumentsSteps();
    if (steps.length === 0) return;

    setMobileSidebarOpen(false);
    markDocumentsTourStatus('started');
    driverRef.current?.destroy();

    window.setTimeout(() => {
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markDocumentsTourStatus('completed');
        },
      });
      driverRef.current.drive();
    }, 260);
  }, [buildDocumentsSteps, markDocumentsTourStatus, ready, setMobileSidebarOpen, t, userId]);

  const startSupplementalDataTour = useCallback(() => {
    if (!userId || !ready) return;

    const steps = buildSupplementalDataSteps();
    if (steps.length === 0) return;

    setMobileSidebarOpen(false);
    markSupplementalDataTourStatus('started');
    driverRef.current?.destroy();

    window.setTimeout(() => {
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markSupplementalDataTourStatus('completed');
        },
      });
      driverRef.current.drive();
    }, 260);
  }, [buildSupplementalDataSteps, markSupplementalDataTourStatus, ready, setMobileSidebarOpen, t, userId]);

  const startFormsTour = useCallback(() => {
    if (!userId || !ready) return;

    const steps = buildFormsSteps();
    if (steps.length === 0) return;

    setMobileSidebarOpen(false);
    markFormsTourStatus('started');
    driverRef.current?.destroy();

    window.setTimeout(() => {
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markFormsTourStatus('completed');
        },
      });
      driverRef.current.drive();
    }, 260);
  }, [buildFormsSteps, markFormsTourStatus, ready, setMobileSidebarOpen, t, userId]);

  const startRewardsTour = useCallback(() => {
    if (!userId || !ready) return false;

    const steps = buildRewardsSteps();
    if (steps.length === 0) return false;

    setMobileSidebarOpen(false);
    markRewardsTourStatus('started');
    driverRef.current?.destroy();

    window.setTimeout(() => {
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markRewardsTourStatus('completed');
        },
      });
      driverRef.current.drive();
    }, 260);

    return true;
  }, [buildRewardsSteps, markRewardsTourStatus, ready, setMobileSidebarOpen, t, userId]);

  const startSupportTour = useCallback(() => {
    if (!userId || !ready) return false;

    const steps = buildSupportSteps();
    if (steps.length === 0) return false;

    setMobileSidebarOpen(false);
    markSupportTourStatus('started');
    driverRef.current?.destroy();

    window.setTimeout(() => {
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markSupportTourStatus('completed');
        },
      });
      driverRef.current.drive();
    }, 260);

    return true;
  }, [buildSupportSteps, markSupportTourStatus, ready, setMobileSidebarOpen, t, userId]);

  const startProfileTour = useCallback(() => {
    if (!userId || !ready) return false;

    const steps = buildProfileSteps();
    if (steps.length === 0) return false;

    setMobileSidebarOpen(false);
    markProfileTourStatus('started');
    driverRef.current?.destroy();

    window.setTimeout(() => {
      driverRef.current = driver({
        steps,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        overlayColor: '#0a0a0a',
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 10,
        disableActiveInteraction: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        popoverClass: 'migma-student-tour',
        progressText: t('student_dashboard.tour.progress'),
        nextBtnText: t('student_dashboard.tour.next'),
        prevBtnText: t('student_dashboard.tour.previous'),
        doneBtnText: t('student_dashboard.tour.done'),
        onDestroyed: () => {
          markProfileTourStatus('completed');
        },
      });
      driverRef.current.drive();
    }, 260);

    return true;
  }, [buildProfileSteps, markProfileTourStatus, ready, setMobileSidebarOpen, t, userId]);

  useEffect(() => {
    if (!ready || !userId) return;

    const existingStatus = localStorage.getItem(getStorageKey(userId));
    setShowTourPrompt(!existingStatus);
  }, [ready, userId]);

  useEffect(() => {
    if (!ready || !userId || activeTab !== 'applications' || showTourPrompt) return;
    if (driverRef.current?.isActive()) return;

    const existingStatus = localStorage.getItem(getApplicationsStorageKey(userId));
    if (existingStatus) return;

    const timeoutId = window.setTimeout(startApplicationsTour, 320);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, ready, showTourPrompt, startApplicationsTour, userId]);

  useEffect(() => {
    if (!ready || !userId || activeTab !== 'documents' || showTourPrompt) return;
    if (driverRef.current?.isActive()) return;

    const existingStatus = localStorage.getItem(getDocumentsStorageKey(userId));
    if (existingStatus) return;

    const timeoutId = window.setTimeout(startDocumentsTour, 320);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, ready, showTourPrompt, startDocumentsTour, userId]);

  useEffect(() => {
    if (!ready || !userId || activeTab !== 'supplemental-data' || showTourPrompt) return;
    if (driverRef.current?.isActive()) return;

    const existingStatus = localStorage.getItem(getSupplementalDataStorageKey(userId));
    if (existingStatus) return;

    const timeoutId = window.setTimeout(startSupplementalDataTour, 320);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, ready, showTourPrompt, startSupplementalDataTour, userId]);

  useEffect(() => {
    if (!ready || !userId || activeTab !== 'forms' || showTourPrompt) return;
    if (driverRef.current?.isActive()) return;

    const existingStatus = localStorage.getItem(getFormsStorageKey(userId));
    if (existingStatus) return;

    const timeoutId = window.setTimeout(startFormsTour, 320);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, ready, showTourPrompt, startFormsTour, userId]);

  useEffect(() => {
    if (!ready || !userId || activeTab !== 'rewards' || showTourPrompt) return;
    if (driverRef.current?.isActive()) return;

    const existingStatus = localStorage.getItem(getRewardsStorageKey(userId));
    if (existingStatus) return;

    const intervalId = window.setInterval(() => {
      if (driverRef.current?.isActive() || startRewardsTour()) {
        window.clearInterval(intervalId);
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [activeTab, ready, showTourPrompt, startRewardsTour, userId]);

  useEffect(() => {
    if (!ready || !userId || activeTab !== 'support' || showTourPrompt) return;
    if (driverRef.current?.isActive()) return;

    const existingStatus = localStorage.getItem(getSupportStorageKey(userId));
    if (existingStatus) return;

    const intervalId = window.setInterval(() => {
      if (driverRef.current?.isActive() || startSupportTour()) {
        window.clearInterval(intervalId);
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [activeTab, ready, showTourPrompt, startSupportTour, userId]);

  useEffect(() => {
    if (!ready || !userId || activeTab !== 'profile' || showTourPrompt) return;
    if (driverRef.current?.isActive()) return;

    const existingStatus = localStorage.getItem(getProfileStorageKey(userId));
    if (existingStatus) return;

    const intervalId = window.setInterval(() => {
      if (driverRef.current?.isActive() || startProfileTour()) {
        window.clearInterval(intervalId);
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [activeTab, ready, showTourPrompt, startProfileTour, userId]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return {
    showTourPrompt,
    startTour,
    dismissTourPrompt,
  };
}
