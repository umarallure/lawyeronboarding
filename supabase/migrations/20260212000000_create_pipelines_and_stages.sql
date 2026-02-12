-- ============================================================
-- Create portal_stages table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.portal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,              -- e.g. 'transfer_portal', 'submission_portal'
  key text NOT NULL,                   -- slugified label, e.g. 'pending_signature', 'transfer_api'
  label text NOT NULL,                 -- human-readable, e.g. 'Pending Signature', 'Transfer API'
  display_order integer NOT NULL DEFAULT 0,
  column_class text,                   -- Tailwind CSS classes for the kanban column
  header_class text,                   -- Tailwind CSS classes for the kanban column header
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline, key)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_portal_stages_pipeline ON public.portal_stages(pipeline);
CREATE INDEX IF NOT EXISTS idx_portal_stages_order ON public.portal_stages(pipeline, display_order);

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE public.portal_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on portal_stages"
  ON public.portal_stages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon read on portal_stages"
  ON public.portal_stages FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- Seed: Transfer Portal stages
-- ============================================================
INSERT INTO public.portal_stages (pipeline, key, label, display_order, column_class, header_class) VALUES
  ('transfer_portal', 'transfer_api',          'Transfer API',             1,  'border-sky-200 bg-sky-50/40',          NULL),
  ('transfer_portal', 'incomplete_transfer',   'Incomplete Transfer',      2,  'border-amber-200 bg-amber-50/40',      NULL),
  ('transfer_portal', 'returned_to_center_dq', 'Returned To Center - DQ',  3,  'border-orange-200 bg-orange-50/40',    NULL),
  ('transfer_portal', 'previously_sold_bpo',   'Previously Sold BPO',      4,  'border-slate-200 bg-slate-50/40',      NULL),
  ('transfer_portal', 'needs_bpo_callback',    'Needs BPO Callback',       5,  'border-yellow-200 bg-yellow-50/40',    NULL),
  ('transfer_portal', 'application_withdrawn', 'Application Withdrawn',    6,  'border-fuchsia-200 bg-fuchsia-50/40',  NULL),
  ('transfer_portal', 'pending_information',   'Pending Information',      7,  'border-indigo-200 bg-indigo-50/40',    NULL),
  ('transfer_portal', 'pending_approval',      'Pending Approval',         8,  'border-emerald-200 bg-emerald-50/40',  NULL);

-- ============================================================
-- Seed: Submission Portal stages
-- ============================================================
INSERT INTO public.portal_stages (pipeline, key, label, display_order, column_class, header_class) VALUES
  ('submission_portal', 'pending_signature',              'Pending Signature',              1,  'border-t-4 border-slate-500/50 bg-slate-50/50 dark:bg-slate-950/15',      'bg-slate-50/60 dark:bg-slate-950/10'),
  ('submission_portal', 'pending_police_report',          'Pending Police Report',          2,  'border-t-4 border-lime-500/50 bg-lime-50/50 dark:bg-lime-950/15',         'bg-lime-50/60 dark:bg-lime-950/10'),
  ('submission_portal', 'signed_police_report_pending',   'Signed & Police Report Pending', 3,  'border-t-4 border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/15',   'bg-indigo-50/60 dark:bg-indigo-950/10'),
  ('submission_portal', 'information_verification',       'Information Verification',       4,  'border-t-4 border-sky-500/50 bg-sky-50/50 dark:bg-sky-950/15',            'bg-sky-50/60 dark:bg-sky-950/10'),
  ('submission_portal', 'attorney_submission',            'Attorney Submission',            5,  'border-t-4 border-violet-500/50 bg-violet-50/50 dark:bg-violet-950/15',   'bg-violet-50/60 dark:bg-violet-950/10'),
  ('submission_portal', 'insurance_verification',         'Insurance Verification',         6,  'border-t-4 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/15',      'bg-amber-50/60 dark:bg-amber-950/10'),
  ('submission_portal', 'retainer_process_email',         'Retainer Process (Email)',       7,  'border-t-4 border-cyan-500/50 bg-cyan-50/50 dark:bg-cyan-950/15',         'bg-cyan-50/60 dark:bg-cyan-950/10'),
  ('submission_portal', 'retainer_process_postal_mail',   'Retainer Process (Postal Mail)', 8,  'border-t-4 border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/15',   'bg-orange-50/60 dark:bg-orange-950/10'),
  ('submission_portal', 'retainer_signed_pending',        'Retainer Signed Pending',        9,  'border-t-4 border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/15',   'bg-yellow-50/60 dark:bg-yellow-950/10'),
  ('submission_portal', 'retainer_signed',                'Retainer Signed',                10, 'border-t-4 border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/15','bg-emerald-50/60 dark:bg-emerald-950/10'),
  ('submission_portal', 'attorney_decision',              'Attorney Decision',              11, 'border-t-4 border-rose-500/50 bg-rose-50/50 dark:bg-rose-950/15',         'bg-rose-50/60 dark:bg-rose-950/10'),
  ('submission_portal', 'retainer_signed_payable',        'Retainer Signed – Payable',      12, 'border-t-4 border-teal-500/50 bg-teal-50/50 dark:bg-teal-950/15',         'bg-teal-50/60 dark:bg-teal-950/10'),
  ('submission_portal', 'retainer_paid',                  'Retainer Paid',                  13, 'border-t-4 border-fuchsia-500/50 bg-fuchsia-50/50 dark:bg-fuchsia-950/15','bg-fuchsia-50/60 dark:bg-fuchsia-950/10');
