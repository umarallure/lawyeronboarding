import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { hasOnboardingPortalAccess } from '@/lib/portalAccess';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [accessCheckLoading, setAccessCheckLoading] = useState(false);

  useEffect(() => {
    const checkUserAccess = async () => {
      if (loading || !user) return;

      setAccessCheckLoading(true);
      const hasAccess = await hasOnboardingPortalAccess(user.id);
      setAccessCheckLoading(false);

      if (hasAccess) {
        return;
      }

      await signOut();
      navigate('/auth', { replace: true, state: { from: location.pathname } });
    };

    checkUserAccess();
  }, [user, loading, navigate, location.pathname, signOut]);

  if (loading || accessCheckLoading) {
    // Avoid full-screen loaders so the app shell remains visible.
    // Page-level loading states still handle data fetching UX.
    return user ? <>{children}</> : null;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;