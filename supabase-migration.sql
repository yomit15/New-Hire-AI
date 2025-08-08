-- Supabase Migration for Module 3: AI Processing
-- Run this in your Supabase SQL Editor

-- Enable RLS (Row Level Security) if not already enabled
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;

-- Add new columns for AI processing
ALTER TABLE training_modules 
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS ai_modules TEXT,
ADD COLUMN IF NOT EXISTS ai_topics TEXT,
ADD COLUMN IF NOT EXISTS ai_objectives TEXT,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_training_modules_processing_status 
ON training_modules(processing_status);

CREATE INDEX IF NOT EXISTS idx_training_modules_company_processing 
ON training_modules(company_id, processing_status);

-- Update existing records to have a default processing status
UPDATE training_modules 
SET processing_status = 'completed' 
WHERE processing_status IS NULL;

-- Grant necessary permissions (adjust based on your RLS policies)
-- This assumes you have RLS policies already set up
-- If not, you may need to create appropriate policies

-- Example RLS policy for training_modules (adjust as needed)
-- CREATE POLICY "Users can view training modules from their company" ON training_modules
-- FOR SELECT USING (
--   company_id IN (
--     SELECT company_id FROM admins WHERE email = auth.jwt() ->> 'email'
--     UNION
--     SELECT company_id FROM employees WHERE email = auth.jwt() ->> 'email'
--   )
-- );

-- CREATE POLICY "Admins can insert training modules for their company" ON training_modules
-- FOR INSERT WITH CHECK (
--   company_id IN (
--     SELECT company_id FROM admins WHERE email = auth.jwt() ->> 'email'
--   )
-- );

-- CREATE POLICY "Admins can update training modules for their company" ON training_modules
-- FOR UPDATE USING (
--   company_id IN (
--     SELECT company_id FROM admins WHERE email = auth.jwt() ->> 'email'
--   )
-- );

-- CREATE POLICY "Admins can delete training modules for their company" ON training_modules
-- FOR DELETE USING (
--   company_id IN (
--     SELECT company_id FROM admins WHERE email = auth.jwt() ->> 'email'
--   )
-- ); 