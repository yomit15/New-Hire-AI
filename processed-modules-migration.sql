-- Create processed_modules table
CREATE TABLE IF NOT EXISTS processed_modules (
  id SERIAL PRIMARY KEY,
  training_module_id INTEGER REFERENCES training_modules(id) ON DELETE CASCADE,
  ai_module_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
