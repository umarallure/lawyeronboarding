import { ReactNode, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Grid3X3,
  LayoutDashboard,
  LogOut,
  Zap,
  Eye,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useLicensedAgent } from '@/hooks/useLicensedAgent';
import { useCenterUser } from '@/hooks/useCenterUser';
import { canAccessNavigation, isRestrictedUser } from '@/lib/userPermissions';

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
  end?: boolean;
  show?: boolean;
};

const linkBaseClass =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors';

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `${linkBaseClass} ${
    isActive
      ? 'bg-sidebar-accent text-sidebar-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
  }`;

interface AppShellProps {
  title: string;
  children: ReactNode;
}

const AppShell = ({ title, children }: AppShellProps) => {
  const { user, signOut } = useAuth();
  const { isLicensedAgent, loading: licensedLoading } = useLicensedAgent();
  const { isCenterUser, loading: centerLoading } = useCenterUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isBen = user?.id === '89da43d0-db34-4ffe-b6f1-8ca2453d2d76';
  const isAuthorizedUser = user?.id === '89da43d0-db34-4ffe-b6f1-8ca2453d2d76';
  const hasNavigationAccess = canAccessNavigation(user?.id);

  const navItems = useMemo<NavItem[]>(() => {
    const restricted = isRestrictedUser(user?.id);

    // Keep nav aligned with existing access rules.
    const items: NavItem[] = [
      {
        label: 'Dashboard',
        to: '/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        end: true,
        show: !isCenterUser && !restricted,
      },
      {
        label: 'Daily Deal Flow',
        to: '/daily-deal-flow',
        icon: <Grid3X3 className="h-4 w-4" />,
        show: (isAuthorizedUser && hasNavigationAccess) || restricted,
      },
      {
        label: 'Transfer Portal',
        to: '/transfer-portal',
        icon: <Eye className="h-4 w-4" />,
        show: isAuthorizedUser && hasNavigationAccess && !restricted,
      },
      {
        label: 'Submission Portal',
        to: '/submission-portal',
        icon: <CheckCircle className="h-4 w-4" />,
        show: isAuthorizedUser && hasNavigationAccess && !restricted,
      },
      {
        label: 'Agent Reports & Logs',
        to: '/reports',
        icon: <BarChart3 className="h-4 w-4" />,
        show: isAuthorizedUser && hasNavigationAccess && !restricted,
      },
      {
        label: 'Admin Analytics',
        to: '/admin-analytics/agents',
        icon: <BarChart3 className="h-4 w-4" />,
        show: isBen && hasNavigationAccess && !restricted,
      },
      {
        label: 'GHL Sync Portal',
        to: '/ghl-sync',
        icon: <Zap className="h-4 w-4" />,
        show: isAuthorizedUser && hasNavigationAccess && !restricted,
      },
    ];

    return items.filter((i) => i.show !== false);
  }, [
    user?.id,
    isLicensedAgent,
    licensedLoading,
    isCenterUser,
    centerLoading,
    isBen,
    isAuthorizedUser,
    hasNavigationAccess,
  ]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const avatarFallback = useMemo(() => {
    const email = user?.email;
    if (!email) return '?';
    return email.trim().charAt(0).toUpperCase();
  }, [user?.email]);

  return (
    <div className="h-screen w-full bg-background overflow-hidden">
      <div className="flex h-full w-full">
        <aside className="w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
          <div className="h-14 px-4 flex items-center border-b border-sidebar-border">
            <img src="/assets/logo.png" alt="Crash Guard" className="h-7 w-auto" />
          </div>

          <nav className="px-2 py-3 space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClassName}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 min-h-0 flex-col">
          <header className="h-14 border-b bg-card">
            <div className="h-full px-6 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="Account menu"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src="" alt={user?.email || 'User'} />
                      <AvatarFallback className="text-foreground">{avatarFallback}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
                    {user?.email || 'Signed in'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      void handleSignOut();
                    }}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Keep route changes from forcing scroll lock in some pages */}
      <div className="sr-only">{location.pathname}</div>
    </div>
  );
};

export default AppShell;
