import { useOutletContext } from 'react-router-dom';
import { OnboardingCrmBoard } from '@/components/admin/OnboardingCrmBoard';

type DashboardOutletContext = {
  accessRole: 'admin' | 'mentor';
  mentorProfileId: string | null;
};

export function AdminUsers() {
  const context = useOutletContext<DashboardOutletContext | undefined>();

  return (
    <OnboardingCrmBoard
      title="Onboarding CRM"
      description="MIGMA onboarding hub — all products, profiles, orders and operational cases in one view."
      mentorProfileId={context?.accessRole === 'mentor' ? context.mentorProfileId : null}
    />
  );
}
