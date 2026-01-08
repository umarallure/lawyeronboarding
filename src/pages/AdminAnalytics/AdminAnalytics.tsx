import { useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLicensedAgent } from '@/hooks/useLicensedAgent';
import { useToast } from '@/hooks/use-toast';

// Import sidebar component
import { AnalyticsSidebar } from './components/AnalyticsSidebar';
import { TabLoading } from './components/TabLoading';

// Layout component that wraps all analytics pages
const AdminAnalyticsLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const { loading: licensedLoading } = useLicensedAgent();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Restrict access to Ben only
  const isBen = user?.id === '424f4ea8-1b8c-4c0f-bc13-3ea699900c79';

  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/admin-analytics/vendors')) return 'vendors';
    if (path.includes('/admin-analytics/daily')) return 'daily';
    if (path.includes('/admin-analytics/carriers')) return 'carriers';
    return 'agents'; // Default tab
  };

  // Handle tab change - navigate to new route
  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'agents':
        navigate('/admin-analytics/agents');
        break;
      case 'vendors':
        navigate('/admin-analytics/vendors');
        break;
      case 'daily':
        navigate('/admin-analytics/daily');
        break;
      case 'carriers':
        navigate('/admin-analytics/carriers');
        break;
      default:
        navigate('/admin-analytics/agents');
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    
    // Redirect non-Ben users to dashboard
    if (!authLoading && user && !isBen) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate('/dashboard');
    }
  }, [user, authLoading, isBen, navigate, toast]);

  // Redirect base /admin-analytics to /admin-analytics/agents
  useEffect(() => {
    if (location.pathname === '/admin-analytics') {
      navigate('/admin-analytics/agents', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Auth loading check
  if (authLoading || licensedLoading) {
    return <TabLoading message="Authenticating..." />;
  }

  return (
    <div className="flex">
      {/* Sidebar - uses URL-based navigation */}
      <AnalyticsSidebar activeTab={getActiveTab()} onTabChange={handleTabChange} />

      {/* Main Content - renders child route */}
      <div className="flex-1 p-6 space-y-6">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminAnalyticsLayout;
