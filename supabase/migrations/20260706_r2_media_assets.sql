CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_table text DEFAULT '',
  related_record_id text DEFAULT '',
  media_role text NOT NULL DEFAULT 'preview',
  storage_provider text NOT NULL DEFAULT 'r2',
  bucket_name text DEFAULT '',
  original_filename text NOT NULL DEFAULT '',
  storage_path text NOT NULL UNIQUE,
  public_url text DEFAULT '',
  mime_type text DEFAULT 'application/octet-stream',
  file_size bigint DEFAULT 0,
  content_kind text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_assets_select_authenticated ON media_assets;
CREATE POLICY media_assets_select_authenticated
  ON media_assets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS media_assets_modify_authenticated ON media_assets;
CREATE POLICY media_assets_modify_authenticated
  ON media_assets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION set_media_assets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_assets_updated_at ON media_assets;
CREATE TRIGGER media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION set_media_assets_updated_at();
