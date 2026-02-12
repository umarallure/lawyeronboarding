ALTER TABLE public.daily_deal_flow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_deal_flow_select_all_authenticated" ON public.daily_deal_flow;
DROP POLICY IF EXISTS "daily_deal_flow_select_center_authenticated" ON public.daily_deal_flow;

CREATE POLICY "daily_deal_flow_select_center_authenticated" ON public.daily_deal_flow
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all
    EXISTS (
      SELECT 1
      FROM public.app_users au
      WHERE au.user_id = auth.uid()
        AND (
          au.role IN ('admin', 'super_admin')
          OR COALESCE(au.is_super_admin, false) = true
        )
    )
    OR
    -- Sales manager / agent users without center assigned can see all
    EXISTS (
      SELECT 1
      FROM public.app_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'agent'
        AND au.center_id IS NULL
    )
    OR
    -- Otherwise only rows matching user's center (via lead_vendor)
    EXISTS (
      SELECT 1
      FROM public.app_users au
      JOIN public.centers c ON c.id = au.center_id
      WHERE au.user_id = auth.uid()
        AND au.center_id IS NOT NULL
        AND c.lead_vendor IS NOT NULL
        AND c.lead_vendor = public.daily_deal_flow.lead_vendor
    )
  );
