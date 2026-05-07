import { useOutletContext } from 'react-router-dom';
import { OnboardingCrmBoard } from '@/components/admin/OnboardingCrmBoard';

type DashboardOutletContext = {
  accessRole: 'admin' | 'mentor';
  mentorProfileId: string | null;
};

export function AdminCrmInitial() {
  const context = useOutletContext<DashboardOutletContext | undefined>();

  return (
    <OnboardingCrmBoard
      productLine="initial"
      title="Initial CRM"
      description="Initial F-1 selection process cases filtered by product line."
      mentorProfileId={context?.accessRole === 'mentor' ? context.mentorProfileId : null}
    />
  );
}
