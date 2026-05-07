import { useOutletContext } from 'react-router-dom';
import { OnboardingCrmBoard } from '@/components/admin/OnboardingCrmBoard';

type DashboardOutletContext = {
  accessRole: 'admin' | 'mentor';
  mentorProfileId: string | null;
};

export function AdminCrmTransfer() {
  const context = useOutletContext<DashboardOutletContext | undefined>();

  return (
    <OnboardingCrmBoard
      productLine="transfer"
      title="Transfer CRM"
      description="Transfer selection process cases filtered by product line."
      mentorProfileId={context?.accessRole === 'mentor' ? context.mentorProfileId : null}
    />
  );
}
