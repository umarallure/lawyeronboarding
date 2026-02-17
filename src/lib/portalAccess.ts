import { supabase } from '@/integrations/supabase/client';

const PORTAL_ALLOWED_ROLES = ['admin', 'super_admin'] as const;

type AllowedRole = (typeof PORTAL_ALLOWED_ROLES)[number];

const hasAllowedRole = (role: string | null | undefined): role is AllowedRole => {
  if (!role) return false;
  return PORTAL_ALLOWED_ROLES.includes(role as AllowedRole);
};

type UntypedClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { role?: string | null } | null; error: unknown }>;
      };
    };
  };
};

export const hasOnboardingPortalAccess = async (userId: string | undefined): Promise<boolean> => {
  if (!userId) return false;

  const untypedClient = supabase as unknown as UntypedClient;

  const { data: appUser, error: appUsersError } = await untypedClient
    .from('app_users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (!appUsersError && hasAllowedRole(appUser?.role)) {
    return true;
  }

  const { data: userRole, error: userRolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', [...PORTAL_ALLOWED_ROLES])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!userRolesError && hasAllowedRole(userRole?.role)) {
    return true;
  }

  return false;
};
