-- Bananaz profile, settings, licensing, and broadcast persistence
-- Adds durable storage for editable profile data, app settings, manual counts/sales,
-- licensing/contact display, and admin-controlled Bananaz Mode.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS producer_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text DEFAULT 'ThisBeatIzBananaz',
  headline text DEFAULT '',
  slogan_quote text DEFAULT '',
  about_producer text DEFAULT '',
  bio text DEFAULT '',
  label text DEFAULT '',
  top_5_producers text[] DEFAULT '{}',
  favorite_producers text[] DEFAULT '{}',
  favorite_daws text[] DEFAULT '{}',
  partners text DEFAULT '',
  instagram_handle text DEFAULT '',
  threads_handle text DEFAULT '',
  youtube_handle text DEFAULT '',
  facebook_handle text DEFAULT '',
  additional_info text DEFAULT '',
  profile_image_url text DEFAULT '',
  qr_footer_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  image_url text DEFAULT '',
  description text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video')),
  title text DEFAULT '',
  download_enabled boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id uuid,
  beat_name text DEFAULT '',
  buyer_name text DEFAULT '',
  buyer_email text DEFAULT '',
  price numeric DEFAULT 0,
  payment_method text DEFAULT 'Manual',
  notes text DEFAULT '',
  private_sale boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS allow_submissions boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS bananaz_app_famz_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bananaz_app_sales_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS licensing_info jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_info jsonb DEFAULT '{}'::jsonb;

UPDATE app_settings
SET
  famz_count = CASE
    WHEN famz_count IS NULL OR famz_count = 11603 THEN 11203
    ELSE famz_count
  END,
  allow_submissions = COALESCE(allow_submissions, true),
  bananaz_app_famz_count = COALESCE(bananaz_app_famz_count, 0),
  bananaz_app_sales_count = COALESCE(bananaz_app_sales_count, 0),
  bananaz_mode_settings = COALESCE(
    bananaz_mode_settings,
    '{"active": false, "colorTheme": "gold"}'::jsonb
  ),
  licensing_info = COALESCE(licensing_info, '{}'::jsonb) || jsonb_build_object(
    'beats', 'Beats - Usable for all purposes. Must credit "prod. by ThisBeatIzBananaz" in any true/legible way with song title/displays. Available for submissions.',
    'free_downloads', 'Free DL''s - Usable for all purposes. Must credit "prod. by ThisBeatIzBananaz" in any true/legible way with song title/displays. Not available for submissions.',
    'produced_by', 'Produced by - All songs are considered demos, even though they are singles. They showcase song-writing, production, arrangements & concepts of the producer. All rights reserved, Rawheart Waymakerz Music Group© 2025. Owned by ThisBeatIzBananaz™'
  ),
  contact_info = COALESCE(contact_info, '{}'::jsonb) || jsonb_build_object(
    'instagram_handle', '',
    'threads_handle', '',
    'youtube_handle', '',
    'facebook_handle', ''
  )
WHERE id IS NOT NULL;

INSERT INTO app_settings (
  id,
  famz_count,
  allow_submissions,
  bananaz_app_famz_count,
  bananaz_app_sales_count,
  bananaz_mode_settings,
  licensing_info,
  contact_info
)
SELECT
  gen_random_uuid(),
  11203,
  true,
  0,
  0,
  '{"active": false, "colorTheme": "gold"}'::jsonb,
  jsonb_build_object(
    'beats', 'Beats - Usable for all purposes. Must credit "prod. by ThisBeatIzBananaz" in any true/legible way with song title/displays. Available for submissions.',
    'free_downloads', 'Free DL''s - Usable for all purposes. Must credit "prod. by ThisBeatIzBananaz" in any true/legible way with song title/displays. Not available for submissions.',
    'produced_by', 'Produced by - All songs are considered demos, even though they are singles. They showcase song-writing, production, arrangements & concepts of the producer. All rights reserved, Rawheart Waymakerz Music Group© 2025. Owned by ThisBeatIzBananaz™'
  ),
  jsonb_build_object(
    'instagram_handle', '',
    'threads_handle', '',
    'youtube_handle', '',
    'facebook_handle', ''
  )
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

INSERT INTO producer_profile (
  display_name,
  headline,
  slogan_quote,
  about_producer,
  bio,
  label,
  top_5_producers,
  favorite_producers,
  favorite_daws,
  partners,
  instagram_handle,
  threads_handle,
  youtube_handle,
  facebook_handle,
  additional_info,
  qr_footer_enabled
)
SELECT
  'ThisBeatIzBananaz',
  '',
  '',
  '',
  '',
  '',
  '{}'::text[],
  '{}'::text[],
  '{}'::text[],
  '',
  '',
  '',
  '',
  '',
  '',
  true
WHERE NOT EXISTS (SELECT 1 FROM producer_profile);

ALTER TABLE producer_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producer_profile_select_all ON producer_profile;
DROP POLICY IF EXISTS producer_profile_insert_all ON producer_profile;
DROP POLICY IF EXISTS producer_profile_update_all ON producer_profile;
DROP POLICY IF EXISTS producer_profile_delete_all ON producer_profile;

CREATE POLICY producer_profile_select_all ON producer_profile
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY producer_profile_insert_all ON producer_profile
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY producer_profile_update_all ON producer_profile
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY producer_profile_delete_all ON producer_profile
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS profile_partners_select_all ON profile_partners;
DROP POLICY IF EXISTS profile_partners_insert_all ON profile_partners;
DROP POLICY IF EXISTS profile_partners_update_all ON profile_partners;
DROP POLICY IF EXISTS profile_partners_delete_all ON profile_partners;

CREATE POLICY profile_partners_select_all ON profile_partners
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profile_partners_insert_all ON profile_partners
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY profile_partners_update_all ON profile_partners
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY profile_partners_delete_all ON profile_partners
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS profile_media_select_all ON profile_media;
DROP POLICY IF EXISTS profile_media_insert_all ON profile_media;
DROP POLICY IF EXISTS profile_media_update_all ON profile_media;
DROP POLICY IF EXISTS profile_media_delete_all ON profile_media;

CREATE POLICY profile_media_select_all ON profile_media
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profile_media_insert_all ON profile_media
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY profile_media_update_all ON profile_media
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY profile_media_delete_all ON profile_media
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS manual_sales_select_all ON manual_sales;
DROP POLICY IF EXISTS manual_sales_insert_all ON manual_sales;
DROP POLICY IF EXISTS manual_sales_update_all ON manual_sales;
DROP POLICY IF EXISTS manual_sales_delete_all ON manual_sales;

CREATE POLICY manual_sales_select_all ON manual_sales
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY manual_sales_insert_all ON manual_sales
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY manual_sales_update_all ON manual_sales
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY manual_sales_delete_all ON manual_sales
  FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS producer_profile_updated_at ON producer_profile;
CREATE TRIGGER producer_profile_updated_at
  BEFORE UPDATE ON producer_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS profile_partners_updated_at ON profile_partners;
CREATE TRIGGER profile_partners_updated_at
  BEFORE UPDATE ON profile_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS profile_media_updated_at ON profile_media;
CREATE TRIGGER profile_media_updated_at
  BEFORE UPDATE ON profile_media
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS manual_sales_updated_at ON manual_sales;
CREATE TRIGGER manual_sales_updated_at
  BEFORE UPDATE ON manual_sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
