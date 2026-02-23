-- Revert Submission Portal to original stages (keeping it as-is for other portals)
-- Create new Lawyer Portal pipeline with the 6 stages

-- First, ensure Submission Portal has its original stages
-- Parent stages are shown as columns, sub-stages (with " - " in label) are grouped under them
DELETE FROM portal_stages WHERE pipeline = 'submission_portal';

INSERT INTO portal_stages (pipeline, key, label, display_order)
VALUES
  -- Docs Pending (parent stage - shows as column)
  ('submission_portal', 'docs_pending', 'Docs Pending', 1),
  -- Sub-reasons under Docs Pending (grouped under parent)
  ('submission_portal', 'docs_pending_police_report', 'Docs Pending - Police Report Pending', 2),
  ('submission_portal', 'docs_pending_medical_report', 'Docs Pending - Medical Report Pending', 3),
  ('submission_portal', 'docs_pending_insurance_docs', 'Docs Pending - Insurance Docs Pending', 4),
  
  -- Retainer Sent (parent stage - shows as column)
  ('submission_portal', 'retainer_sent', 'Retainer Sent', 5),
  -- Sub-reasons under Retainer Sent (grouped under parent)
  ('submission_portal', 'retainer_sent_email', 'Retainer Sent - Email', 6),
  ('submission_portal', 'retainer_sent_mail', 'Retainer Sent - Mail', 7),
  
  -- Standalone stages (each shows as its own column)
  ('submission_portal', 'awaiting_retainer_signature', 'Awaiting Retainer Signature', 8),
  ('submission_portal', 'retainer_signed', 'Retainer Signed', 9),
  ('submission_portal', 'attorney_review', 'Attorney Review', 10),
  ('submission_portal', 'approved_payable', 'Approved - Payable', 11),
  ('submission_portal', 'paid_to_bpo', 'Paid to BPO', 12);

-- Now create the NEW Lawyer Portal pipeline
DELETE FROM portal_stages WHERE pipeline = 'lawyer_portal';

INSERT INTO portal_stages (pipeline, key, label, display_order)
VALUES
  ('lawyer_portal', 'ready_to_move_forward', 'Ready to Move Forward', 1),
  ('lawyer_portal', 'retainer_sent_pending_signature', 'Retainer Sent (Pending signature)', 2),
  ('lawyer_portal', 'retainer_signed', 'Retainer Signed', 3),
  ('lawyer_portal', 'scheduled_onboarding', 'Scheduled Onboarding', 4),
  ('lawyer_portal', 'onboarded_inactive_no_orders_yet', 'Onboarded (Inactive/No orders yet)', 5),
  ('lawyer_portal', 'active_actively_paying_placing_orders', 'Active (Actively paying/placing orders)', 6);

-- Verify both pipelines
SELECT 
  pipeline,
  key,
  label,
  display_order,
  id
FROM portal_stages 
WHERE pipeline IN ('submission_portal', 'lawyer_portal')
ORDER BY pipeline, display_order;
