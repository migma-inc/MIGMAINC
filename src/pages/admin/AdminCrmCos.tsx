import { useOutletContext } from 'react-router-dom';
import { OnboardingCrmBoard } from '@/components/admin/OnboardingCrmBoard';

type DashboardOutletContext = {
  accessRole: 'admin' | 'mentor';
  mentorProfileId: string | null;
};

export function AdminCrmCos() {
  const context = useOutletContext<DashboardOutletContext | undefined>();

  return (
    <OnboardingCrmBoard
      productLine="cos"
      title="COS CRM"
      description="Change of Status — selection process cases filtered by product line."
      mentorProfileId={context?.accessRole === 'mentor' ? context.mentorProfileId : null}
    />
  );
}
