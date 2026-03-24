-- Add marketing_source_stage field to lawyer_leads table
-- This field stores the marketing pipeline stage name when a lead transitions to lawyer portal

ALTER TABLE lawyer_leads 
ADD COLUMN IF NOT EXISTS marketing_source_stage TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN lawyer_leads.marketing_source_stage IS 'Stores the marketing pipeline stage label when a lead transitions from marketing pipeline to lawyer portal';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lawyer_leads' 
  AND column_name = 'marketing_source_stage';
