/**
 * Protected route component for admin-only pages
 * Verifies authentication and admin role before rendering children
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { checkAdminAccess, isAuthenticated } from '@/lib/auth';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    async function verifyAccess() {
      try {
        // Check if user is authenticated
        const authenticated = await isAuthenticated();
        
        if (!authenticated) {
          setIsAuthorized(false);
          setIsChecking(false);
          return;
        }

        // Check if user has admin role
        const hasAdminAccess = await checkAdminAccess();
        setIsAuthorized(hasAdminAccess);
      } catch (error) {
        console.error('[AdminRoute] Error verifying access:', error);
        setIsAuthorized(false);
      } finally {
        setIsChecking(false);
      }
    }

    verifyAccess();
  }, [location.pathname]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthorized) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Render children if authorized
  return <>{children}</>;
}

