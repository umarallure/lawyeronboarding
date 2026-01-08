import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLicensedAgent } from '@/hooks/useLicensedAgent';

interface LicensedAgentProtectedRouteProps {
  children: React.ReactNode;
}

const LicensedAgentProtectedRoute = ({ children }: LicensedAgentProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isLicensedAgent, loading: licensedLoading } = useLicensedAgent();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authLoading || licensedLoading) return;

    if (!user) {
      // Redirect to regular auth if not logged in
      navigate('/auth');
      return;
    }

    if (!isLicensedAgent) {
      // Redirect to dashboard if not a licensed agent
      navigate('/dashboard');
      return;
    }

    // Licensed agents can access commission-portal and other allowed paths
    const allowedPaths = ['/commission-portal', '/dashboard'];
    if (!allowedPaths.some(path => location.pathname.startsWith(path))) {
      navigate('/commission-portal', { replace: true });
    }
  }, [user, isLicensedAgent, authLoading, licensedLoading, navigate, location.pathname]);

  if (authLoading || licensedLoading) {
    // Avoid full-screen loaders so the app shell remains visible.
    return user ? <>{children}</> : null;
  }

  if (!user || !isLicensedAgent) {
    return null;
  }

  return <>{children}</>;
};

export default LicensedAgentProtectedRoute;