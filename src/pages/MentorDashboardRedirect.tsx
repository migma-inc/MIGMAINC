import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { checkMentorAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const MentorDashboardRedirect = () => {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    async function resolveTarget() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setTarget('/mentor/login');
        return;
      }

      const hasMentorAccess = await checkMentorAccess();
      setTarget(hasMentorAccess ? '/dashboard/users' : '/mentor/login?message=Mentor access required.');
    }

    void resolveTarget();
  }, []);

  if (!target) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-medium mx-auto"></div>
          <p className="mt-4 text-gray-400">Verifying mentor access...</p>
        </div>
      </div>
    );
  }

  return <Navigate to={target} replace />;
};
