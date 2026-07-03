CREATE TABLE IF NOT EXISTS bananaz_room_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_mode text NOT NULL DEFAULT 'grid-3' CHECK (layout_mode IN ('grid-3', 'grid-4', 'free')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bananaz_room_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  extra_info text DEFAULT '',
  media_url text NOT NULL DEFAULT '',
  media_type text NOT NULL DEFAULT 'file' CHECK (media_type IN ('audio', 'image', 'video', 'file')),
  preview_image_url text DEFAULT '',
  price numeric(10,2) DEFAULT 0,
  is_free boolean DEFAULT true,
  hidden boolean DEFAULT false,
  approved boolean DEFAULT true,
  sold boolean DEFAULT false,
  release_download boolean DEFAULT true,
  position_x numeric DEFAULT 0,
  position_y numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO bananaz_room_settings (layout_mode)
SELECT 'grid-3'
WHERE NOT EXISTS (SELECT 1 FROM bananaz_room_settings);

ALTER TABLE bananaz_room_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bananaz_room_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bananaz_room_settings_select_all ON bananaz_room_settings;
DROP POLICY IF EXISTS bananaz_room_settings_insert_all ON bananaz_room_settings;
DROP POLICY IF EXISTS bananaz_room_settings_update_all ON bananaz_room_settings;
DROP POLICY IF EXISTS bananaz_room_settings_delete_all ON bananaz_room_settings;

CREATE POLICY bananaz_room_settings_select_all ON bananaz_room_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY bananaz_room_settings_insert_all ON bananaz_room_settings
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY bananaz_room_settings_update_all ON bananaz_room_settings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY bananaz_room_settings_delete_all ON bananaz_room_settings
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS bananaz_room_items_select_all ON bananaz_room_items;
DROP POLICY IF EXISTS bananaz_room_items_insert_all ON bananaz_room_items;
DROP POLICY IF EXISTS bananaz_room_items_update_all ON bananaz_room_items;
DROP POLICY IF EXISTS bananaz_room_items_delete_all ON bananaz_room_items;

CREATE POLICY bananaz_room_items_select_all ON bananaz_room_items
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY bananaz_room_items_insert_all ON bananaz_room_items
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY bananaz_room_items_update_all ON bananaz_room_items
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY bananaz_room_items_delete_all ON bananaz_room_items
  FOR DELETE TO anon, authenticated USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bananaz-room',
  'bananaz-room',
  true,
  2147483648,
  ARRAY[
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/flac',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/zip',
    'application/pdf',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS bananaz_room_objects_select_all ON storage.objects;
DROP POLICY IF EXISTS bananaz_room_objects_insert_all ON storage.objects;
DROP POLICY IF EXISTS bananaz_room_objects_update_all ON storage.objects;
DROP POLICY IF EXISTS bananaz_room_objects_delete_all ON storage.objects;

CREATE POLICY bananaz_room_objects_select_all ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'bananaz-room');

CREATE POLICY bananaz_room_objects_insert_all ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'bananaz-room');

CREATE POLICY bananaz_room_objects_update_all ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'bananaz-room')
  WITH CHECK (bucket_id = 'bananaz-room');

CREATE POLICY bananaz_room_objects_delete_all ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'bananaz-room');

CREATE OR REPLACE FUNCTION set_bananaz_room_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bananaz_room_settings_updated_at ON bananaz_room_settings;
CREATE TRIGGER bananaz_room_settings_updated_at
  BEFORE UPDATE ON bananaz_room_settings
  FOR EACH ROW EXECUTE FUNCTION set_bananaz_room_updated_at();

DROP TRIGGER IF EXISTS bananaz_room_items_updated_at ON bananaz_room_items;
CREATE TRIGGER bananaz_room_items_updated_at
  BEFORE UPDATE ON bananaz_room_items
  FOR EACH ROW EXECUTE FUNCTION set_bananaz_room_updated_at();
