-- Add hidden field to content tables for visibility control
ALTER TABLE beats ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;
ALTER TABLE beat_tapes ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;
ALTER TABLE prod_by_songs ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;

-- Add sales_count to app_settings if not exists, defaulting to 119
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'sales_count') THEN
    ALTER TABLE app_settings ADD COLUMN sales_count integer DEFAULT 119;
  END IF;
END $$;

-- Set initial sales_count to 119 for existing settings
UPDATE app_settings SET sales_count = 119 WHERE sales_count IS NULL OR sales_count = 0;