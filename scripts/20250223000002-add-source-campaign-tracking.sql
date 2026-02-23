-- Add Source and Campaign/Software tracking fields to lawyer_leads table
-- These fields will track where leads originated from for analytics

-- Add source field (e.g., Facebook, Instagram, LinkedIn, Cold Call, Networking)
ALTER TABLE lawyer_leads 
ADD COLUMN IF NOT EXISTS source VARCHAR(100);

-- Add campaign_software field (e.g., "FlowChat - Ben's Account", "Instantly - Promo Email")
ALTER TABLE lawyer_leads 
ADD COLUMN IF NOT EXISTS campaign_software VARCHAR(255);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lawyer_leads_source ON lawyer_leads(source);
CREATE INDEX IF NOT EXISTS idx_lawyer_leads_campaign_software ON lawyer_leads(campaign_software);

-- Verify the columns were added
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'lawyer_leads' 
  AND column_name IN ('source', 'campaign_software')
ORDER BY column_name;
