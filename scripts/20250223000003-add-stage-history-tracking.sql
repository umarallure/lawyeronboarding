-- Create stage_history table to track customer journey (stage movements)
-- This replaces the need for a separate "Follow-up" pipeline

CREATE TABLE IF NOT EXISTS stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  pipeline_name VARCHAR(100) NOT NULL,
  from_stage_id UUID,
  to_stage_id UUID,
  from_stage_label VARCHAR(255),
  to_stage_label VARCHAR(255),
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stage_history_lead_id ON stage_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at ON stage_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_history_pipeline ON stage_history(pipeline_name);

-- Add RLS policies
ALTER TABLE stage_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all stage history
CREATE POLICY "Users can view all stage history" ON stage_history
  FOR SELECT USING (true);

-- Policy: Authenticated users can insert stage history
CREATE POLICY "Authenticated users can insert stage history" ON stage_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to automatically log stage changes
CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if stage_id actually changed
  IF (TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id) OR TG_OP = 'INSERT' THEN
    INSERT INTO stage_history (
      lead_id,
      pipeline_name,
      from_stage_id,
      to_stage_id,
      from_stage_label,
      to_stage_label,
      changed_by
    )
    SELECT 
      NEW.id,
      NEW.pipeline_name,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage_id ELSE NULL END,
      NEW.stage_id,
      CASE WHEN TG_OP = 'UPDATE' THEN (SELECT label FROM portal_stages WHERE id = OLD.stage_id) ELSE NULL END,
      (SELECT label FROM portal_stages WHERE id = NEW.stage_id),
      auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on lawyer_leads table
DROP TRIGGER IF EXISTS trigger_log_stage_change ON lawyer_leads;
CREATE TRIGGER trigger_log_stage_change
  AFTER INSERT OR UPDATE OF stage_id ON lawyer_leads
  FOR EACH ROW
  EXECUTE FUNCTION log_stage_change();

-- Verify the table was created
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'stage_history'
ORDER BY ordinal_position;
