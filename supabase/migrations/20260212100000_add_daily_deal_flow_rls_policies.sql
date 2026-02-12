-- ============================================================
-- Add UPDATE policy for daily_deal_flow table
-- Existing policies: admin_full_access (ALL), admin_update_invoice_id (UPDATE/public),
--   delete_authenticated (DELETE), select policies (SELECT).
-- Missing: a general UPDATE policy for authenticated users.
-- ============================================================

-- Add UPDATE policy so authenticated users can update status (and other fields)
DROP POLICY IF EXISTS "daily_deal_flow_update_authenticated" ON public.daily_deal_flow;
CREATE POLICY "daily_deal_flow_update_authenticated" ON public.daily_deal_flow
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
