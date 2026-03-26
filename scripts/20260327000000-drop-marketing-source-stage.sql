-- Drop confusing marketing_source_stage column from lawyer_leads
ALTER TABLE public.lawyer_leads
DROP COLUMN IF EXISTS marketing_source_stage;
