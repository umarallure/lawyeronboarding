export const RESTRICTED_USER_IDS = ['adda1255-2a0b-41da-9df0-3100d01b8649', 'eceb7ac0-0e4a-44ad-bb70-ba66010d0baa'];

/**
 * Check if the current user has restricted access (read-only view)
 * @param userId - The current user's ID
 * @returns boolean indicating if user has restricted access
 */
export const isRestrictedUser = (userId: string | undefined): boolean => {
  return userId ? RESTRICTED_USER_IDS.includes(userId) : false;
};

/**
 * Check if the current user can perform write operations (create, edit, delete)
 * @param userId - The current user's ID
 * @returns boolean indicating if user can perform write operations
 */
export const canPerformWriteOperations = (userId: string | undefined): boolean => {
  return !isRestrictedUser(userId);
};

/**
 * Check if the current user can access navigation menu
 * @param userId - The current user's ID
 * @returns boolean indicating if user can access navigation menu
 */
export const canAccessNavigation = (userId: string | undefined): boolean => {
  return !isRestrictedUser(userId);
};

/**
 * Check if the current user is a center user (lead vendor)
 * @param userId - The current user's ID
 * @returns boolean indicating if user is a center user
 */
export const isCenterUser = async (userId: string | undefined): Promise<boolean> => {
  if (!userId) return false;

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase
      .from('centers')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    return !error && !!data;
  } catch (error) {
    console.error('Error checking center user:', error);
    return false;
  }
};

/**
 * Check if the current user is a buffer agent
 * @param userId - The current user's ID
 * @returns boolean indicating if user is a buffer agent
 */
export const isBufferAgent = async (userId: string | undefined): Promise<boolean> => {
  if (!userId) return false;

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', userId)
      .single();

    if (error || !data) return false;

    // Buffer agent names list
    const bufferAgentNames = [
      'Ira', 'Kyla', 'Syed Kazmi', 'Justine', 'Kaye', 'Viez', 
      'Lourd', 'Mary', 'Nicole Mejia', 'Angelica', 'Laiza Batain'
    ];

    return bufferAgentNames.includes(data.display_name);
  } catch (error) {
    console.error('Error checking buffer agent:', error);
    return false;
  }
};

export type OnboardingTaskRoleFlags = {
  isAdmin: boolean;
  canAccess: boolean;
};

/**
 * Resolve task-management permissions for the lawyer-onboarding portal.
 * Admins / super-admins can assign tasks to anyone; everyone else can only
 * self-assign and see tasks they own or created. Restricted users have no access.
 */
export const getOnboardingTaskRoleFlags = async (
  userId: string | undefined
): Promise<OnboardingTaskRoleFlags> => {
  if (!userId || isRestrictedUser(userId)) {
    return { isAdmin: false, canAccess: false };
  }

  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, v: string) => {
            maybeSingle: () => Promise<{
              data: { role?: string | null; is_super_admin?: boolean | null } | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };

    const { data, error } = await client
      .from('app_users')
      .select('role,is_super_admin')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { isAdmin: false, canAccess: true };
    }

    const role = data?.role ?? null;
    const isAdmin =
      Boolean(data?.is_super_admin) || role === 'admin' || role === 'super_admin';

    return { isAdmin, canAccess: true };
  } catch (error) {
    console.error('Error checking onboarding task role flags:', error);
    return { isAdmin: false, canAccess: true };
  }
};