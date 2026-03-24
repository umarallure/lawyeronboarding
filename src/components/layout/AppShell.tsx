import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Grid3X3,
  LayoutDashboard,
  Package,
  Users,
  LogOut,
  Eye,
  CheckCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';

import { TbUserShield } from "react-icons/tb";

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
import { supabase } from '@/integrations/supabase/client';

type NavItem = {
  label: string;
  icon: ReactNode;
  to?: string;
  end?: boolean;
  show?: boolean;
  groupKey?: string;
  children?: Array<{
    label: string;
    to: string;
    end?: boolean;
    show?: boolean;
  }>;
};

const linkBaseClass =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface AppShellProps {
  title: string;
  children: ReactNode;
  collapseSidebar?: boolean;
  defaultSidebarCollapsed?: boolean;
  autoCollapseSidebarAfterMs?: number;
}

const AppShell = ({
  title,
  children,
  collapseSidebar = false,
  defaultSidebarCollapsed,
  autoCollapseSidebarAfterMs,
}: AppShellProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as { activeNav?: string } | null) || null;
  const activeNavOverride = locationState?.activeNav;

  const isDailyDealFlowRoute = location.pathname.startsWith('/daily-deal-flow');

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    // Outside Daily Outreach Report, keep sidebar open.
    if (!isDailyDealFlowRoute) return false;

    // If the route provides an explicit default (e.g., Daily Outreach Report), honor it.
    if (defaultSidebarCollapsed !== undefined) return defaultSidebarCollapsed;

    // Otherwise, persist the last choice for Daily Outreach Report.
    try {
      const stored = window.localStorage.getItem('app_shell_sidebar_collapsed');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      console.warn('Failed to read sidebar collapsed state from localStorage', error);
    }

    return collapseSidebar;
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    account_management: location.pathname.startsWith('/account-management'),
  });

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) {
        setIsSuperAdmin(false);
        return;
      }

      try {
        const client = supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (col: string, v: string) => {
                maybeSingle: () => Promise<{ data: unknown | null; error: { message: string } | null }>;
              };
            };
          };
        };

        const { data, error } = await client
          .from('app_users')
          .select('role,is_super_admin')
          .eq('user_id', user.id)
          .maybeSingle();

        const typed = data as { role?: string | null; is_super_admin?: boolean } | null;
        if (error) {
          setIsSuperAdmin(false);
          return;
        }

        setIsSuperAdmin(Boolean(typed?.is_super_admin) || typed?.role === 'super_admin');
      } catch {
        setIsSuperAdmin(false);
      }
    };

    void run();
  }, [user?.id]);

  useEffect(() => {
    // Keep the persisted state aligned for Daily Outreach Report routes that don't force a default.
    if (!isDailyDealFlowRoute) return;
    if (defaultSidebarCollapsed !== undefined) return;
    try {
      window.localStorage.setItem('app_shell_sidebar_collapsed', String(sidebarCollapsed));
    } catch (error) {
      console.warn('Failed to persist sidebar collapsed state to localStorage', error);
    }
  }, [sidebarCollapsed, defaultSidebarCollapsed, isDailyDealFlowRoute]);

  useEffect(() => {
    // Whenever we arrive on a non–Daily Deal Flow route, default the sidebar to open.
    if (isDailyDealFlowRoute) return;
    setSidebarCollapsed(false);
  }, [isDailyDealFlowRoute, location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/account-management')) {
      setExpandedGroups((prev) => ({ ...prev, account_management: true }));
    }
  }, [location.pathname]);

  useEffect(() => {
    // If a route forces a default (e.g., Daily Outreach Report), apply it immediately.
    if (defaultSidebarCollapsed === undefined) return;
    if (!isDailyDealFlowRoute) return;
    setSidebarCollapsed(defaultSidebarCollapsed);
  }, [defaultSidebarCollapsed, isDailyDealFlowRoute]);

  const isSidebarCollapsed = sidebarCollapsed;

  const autoCollapseTimeoutRef = useRef<number | null>(null);

  const clearAutoCollapseTimer = () => {
    if (autoCollapseTimeoutRef.current !== null) {
      window.clearTimeout(autoCollapseTimeoutRef.current);
      autoCollapseTimeoutRef.current = null;
    }
  };

  const startAutoCollapseTimer = () => {
    if (!autoCollapseSidebarAfterMs) return;
    clearAutoCollapseTimer();
    autoCollapseTimeoutRef.current = window.setTimeout(() => {
      setSidebarCollapsed(true);
    }, autoCollapseSidebarAfterMs);
  };

  const handleSidebarActivity = () => {
    if (!autoCollapseSidebarAfterMs) return;
    if (isSidebarCollapsed) return;
    startAutoCollapseTimer();
  };

  useEffect(() => {
    if (!autoCollapseSidebarAfterMs) return;

    // Only run the timer when the sidebar is opened.
    if (!isSidebarCollapsed) startAutoCollapseTimer();
    else clearAutoCollapseTimer();

    return () => {
      clearAutoCollapseTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCollapseSidebarAfterMs, isSidebarCollapsed]);

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        label: 'Dashboard',
        to: '/manager-dashboard',
        icon: <LayoutDashboard className="h-4 w-4 text-current" />,
      },
      {
        label: 'Marketing Team',
        to: '/marketing-team',
        icon: <Users className="h-4 w-4 text-current" />,
        show: isSuperAdmin,
      },
      {
        label: 'Lead Assignment',
        to: '/lead-assignment',
        icon: <Users className="h-4 w-4 text-current" />,
        show: isSuperAdmin,
      },
      {
        label: 'Account Management',
        icon: <TbUserShield className="h-4 w-4 text-current" />,
        groupKey: 'account_management',
        children: [
          {
            label: 'Order Management',
            to: '/account-management/orders',
          },
        ],
      },
      {
        label: 'Lawyers',
        to: '/leads',
        icon: <Users className="h-4 w-4 text-current" />,
        end: true,
      },
      {
        label: 'Marketing Pipeline',
        to: '/transfer-portal',
        icon: <Eye className="h-4 w-4 text-current" />,
      },
      {
        label: 'Lawyer Portal',
        to: '/submission-portal',
        icon: <CheckCircle className="h-4 w-4 text-current" />,
      },
      {
        label: 'Daily Outreach Report',
        to: '/daily-deal-flow',
        icon: <Grid3X3 className="h-4 w-4 text-current" />,
      },
    ];

    return items.filter((i) => i.show !== false);
  }, [isSuperAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const avatarFallback = useMemo(() => {
    const email = user?.email;
    if (!email) return '?';
    return email.trim().charAt(0).toUpperCase();
  }, [user?.email]);

  const isNavItemActive = (to?: string, end?: boolean) => {
    if (!to) return false;
    if (activeNavOverride) return activeNavOverride === to;
    if (end) return location.pathname === to;
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <div className="h-screen w-full bg-background overflow-hidden">
      <div className="flex h-full w-full">
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          onMouseMove={handleSidebarActivity}
          onMouseDown={handleSidebarActivity}
          onKeyDown={handleSidebarActivity}
          onFocus={handleSidebarActivity}
          onTouchStart={handleSidebarActivity}
          className={
            `${isSidebarCollapsed ? "w-16" : "w-64"} shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col transition-transform duration-300 ease-in-out
            ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
            fixed lg:static inset-y-0 left-0 z-50`
          }
        >
          <div
            className={
              isSidebarCollapsed
                ? "h-14 px-2 flex items-center justify-center border-b border-sidebar-border"
                : "h-14 px-4 flex items-center border-b border-sidebar-border"
            }
          >
            <img
              src={isSidebarCollapsed ? '/assets/logo-collapse.png' : '/assets/logo.png'}
              alt="Lawyer Onboarding Portal"
              className={isSidebarCollapsed ? "h-10 w-auto max-w-full" : "h-7 w-auto"}
            />
          </div>

          <nav
            className="px-2 py-3 space-y-1 flex-1 overflow-y-auto"
          >
            {navItems.map((item) => {
              const visibleChildren = (item.children || []).filter((child) => child.show !== false);
              const hasChildren = visibleChildren.length > 0;
              const isGroupOpen = item.groupKey ? Boolean(expandedGroups[item.groupKey]) : false;
              const hasActiveChild = visibleChildren.some((child) => isNavItemActive(child.to, child.end));
              const primaryTo = item.to || visibleChildren[0]?.to;

              if (hasChildren && isSidebarCollapsed && primaryTo) {
                return (
                  <NavLink
                    key={item.groupKey || item.label}
                    to={primaryTo}
                    className={() =>
                      `${linkBaseClass} justify-center px-0 ${
                        hasActiveChild
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                      }`
                    }
                    title={item.label}
                  >
                    {item.icon}
                  </NavLink>
                );
              }

              if (hasChildren) {
                return (
                  <div key={item.groupKey || item.label} className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          ...prev,
                          [item.groupKey || item.label]: !prev[item.groupKey || item.label],
                        }))
                      }
                      className={`${linkBaseClass} w-full justify-between text-left ${
                        hasActiveChild
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {isGroupOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    </button>

                    {isGroupOpen ? (
                      <div className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                        {visibleChildren.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            end={child.end}
                            className={() =>
                              `${linkBaseClass} py-1.5 ${
                                isNavItemActive(child.to, child.end)
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                              }`
                            }
                          >
                            <Package className="h-3.5 w-3.5 text-current" />
                            <span>{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to!}
                  end={item.end}
                  className={() =>
                    `${linkBaseClass} ${
                      isSidebarCollapsed ? "justify-center px-0" : ""
                    } ${
                      isNavItemActive(item.to, item.end)
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                    }`
                  }
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 min-h-0 flex-col">
          <header className="h-14 border-b bg-card">
            <div className="h-full px-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile Hamburger Menu */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 lg:hidden"
                  aria-label="Toggle menu"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>

                {/* Desktop Sidebar Toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hidden lg:flex"
                  aria-label={isSidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
                  onClick={() => {
                    setSidebarCollapsed((prev) => !prev);
                  }}
                >
                  {isSidebarCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
                <h1 className="text-xs sm:text-sm font-semibold text-foreground truncate">{title}</h1>
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

          <main className="app-main min-w-0 flex-1 overflow-y-auto">
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Keep route changes from forcing scroll lock in some pages */}
      <div className="sr-only">{location.pathname}</div>
    </div>
  );
};

export default AppShell;
