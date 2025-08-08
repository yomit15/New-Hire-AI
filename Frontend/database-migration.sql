-- Database Migration for Module 3: AI Processing
-- Add new fields to training_modules table

-- Add new columns for AI processing
ALTER TABLE training_modules 
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS ai_modules TEXT,
ADD COLUMN IF NOT EXISTS ai_topics TEXT,
ADD COLUMN IF NOT EXISTS ai_objectives TEXT,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';

-- Update existing records to have a default processing_status
UPDATE training_modules 
SET processing_status = 'pending' 
WHERE processing_status IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_training_modules_processing_status 
ON training_modules(processing_status);

-- Create index for company-based queries
CREATE INDEX IF NOT EXISTS idx_training_modules_company_id 
ON training_modules(company_id); 