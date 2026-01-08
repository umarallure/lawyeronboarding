import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCenterUser } from '@/hooks/useCenterUser';

interface CenterProtectedRouteProps {
  children: React.ReactNode;
}

const CenterProtectedRoute = ({ children }: CenterProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isCenterUser, loading: centerLoading } = useCenterUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authLoading || centerLoading) return;

    if (!user) {
      // Redirect to center auth if not logged in
      navigate('/center-auth');
      return;
    }

    if (!isCenterUser) {
      // Redirect to regular auth if not a center user
      navigate('/auth');
      return;
    }

    // Center users can only access center-specific routes
    const allowedPaths = ['/center-lead-portal', '/center-calendar-view', '/center-auth', '/center-callback-request'];
    if (!allowedPaths.includes(location.pathname)) {
      console.log('[CenterProtectedRoute] Blocking access to:', location.pathname, 'Allowed paths:', allowedPaths);
      navigate('/center-lead-portal', { replace: true });
    }
  }, [user, isCenterUser, authLoading, centerLoading, navigate, location.pathname]);

  if (authLoading || centerLoading) {
    // Avoid full-screen loaders so the app shell remains visible.
    return user ? <>{children}</> : null;
  }

  if (!user || !isCenterUser) {
    return null;
  }

  return <>{children}</>;
};

export default CenterProtectedRoute;