-- Replace the existing cold_call_pipeline stages with the new Marketing Pipeline stages
DELETE FROM portal_stages
WHERE pipeline = 'cold_call_pipeline';

INSERT INTO portal_stages (pipeline, key, label, display_order)
VALUES
  ('cold_call_pipeline', 'contacted_confirmed_mva_lawyer', 'Contacted (Confirmed MVA/Lawyer)', 1),
  ('cold_call_pipeline', 'not_connected_cannot_get_hold', 'Not Connected (Cannot get a hold of)', 2),
  ('cold_call_pipeline', 'qualified', 'Qualified', 3),
  ('cold_call_pipeline', 'not_qualified', 'Not Qualified', 4),
  ('cold_call_pipeline', 'scheduled_for_zoom', 'Scheduled for Zoom', 5);

-- Verify the migration
SELECT 
  pipeline,
  key,
  label,
  display_order,
  id
FROM portal_stages 
WHERE pipeline = 'cold_call_pipeline'
ORDER BY display_order;
