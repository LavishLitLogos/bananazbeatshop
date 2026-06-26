
-- Beats table
CREATE TABLE beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cover_art_url text,
  audio_file_url text,
  price numeric(10,2) DEFAULT 30.00,
  is_free boolean DEFAULT false,
  sold boolean DEFAULT false,
  release_download boolean DEFAULT false,
  exclusive boolean DEFAULT false,
  bananaz_exclusive boolean DEFAULT false,
  no_sharing boolean DEFAULT false,
  style text,
  vibe text,
  genre text,
  type text,
  mood text,
  artist_suggestion text,
  description text,
  terms text DEFAULT 'USUABLE FOR ALL PURPOSES. Credit: prod. by ThisBeatIzBananaz 🔥',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE beats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beats_select_all" ON beats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "beats_insert_admin" ON beats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "beats_update_admin" ON beats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "beats_delete_admin" ON beats FOR DELETE TO authenticated USING (true);

-- Orders table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id uuid REFERENCES beats(id),
  beat_name text NOT NULL,
  beat_thumbnail text,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  payment_method text NOT NULL,
  payment_destination text,
  amount numeric(10,2),
  status text DEFAULT 'Pending Verification',
  release_download boolean DEFAULT false,
  sold boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select_all" ON orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "orders_insert_all" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "orders_delete_admin" ON orders FOR DELETE TO authenticated USING (true);

-- Beat tapes table
CREATE TABLE beat_tapes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cover_art_url text,
  price numeric(10,2) DEFAULT 0,
  is_free boolean DEFAULT false,
  colab_usable boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE beat_tapes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beat_tapes_select_all" ON beat_tapes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "beat_tapes_insert_admin" ON beat_tapes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "beat_tapes_update_admin" ON beat_tapes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "beat_tapes_delete_admin" ON beat_tapes FOR DELETE TO authenticated USING (true);

-- Beat tape tracks table
CREATE TABLE beat_tape_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tape_id uuid REFERENCES beat_tapes(id) ON DELETE CASCADE,
  title text NOT NULL,
  audio_file_url text,
  track_order integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE beat_tape_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tracks_select_all" ON beat_tape_tracks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tracks_insert_admin" ON beat_tape_tracks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tracks_update_admin" ON beat_tape_tracks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tracks_delete_admin" ON beat_tape_tracks FOR DELETE TO authenticated USING (true);

-- Prod By songs table
CREATE TABLE prod_by_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist_name text,
  audio_file_url text,
  cover_art_url text,
  description text,
  rights_text text DEFAULT 'All rights reserved. Rawheart Waymakerz Music Group© 2026.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prod_by_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_select_all" ON prod_by_songs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prod_insert_admin" ON prod_by_songs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prod_update_admin" ON prod_by_songs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prod_delete_admin" ON prod_by_songs FOR DELETE TO authenticated USING (true);

-- Lab messages table
CREATE TABLE lab_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_type text DEFAULT 'guest',
  sender_name text NOT NULL,
  sender_avatar text,
  text text,
  attachments jsonb DEFAULT '[]',
  room text DEFAULT 'main',
  topic text,
  reactions jsonb DEFAULT '{}',
  reply_to uuid,
  is_automated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lab_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_all" ON lab_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "messages_insert_all" ON lab_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "messages_update_admin" ON lab_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "messages_delete_admin" ON lab_messages FOR DELETE TO authenticated USING (true);

-- Submissions table
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  beat_id uuid REFERENCES beats(id),
  song_file_url text,
  song_title text NOT NULL,
  status text DEFAULT 'Pending',
  mic_rating integer,
  accepted boolean DEFAULT false,
  rejected boolean DEFAULT false,
  produced_by_toggle boolean DEFAULT false,
  exclusive_toggle boolean DEFAULT false,
  list_eligible_toggle boolean DEFAULT false,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_select_all" ON submissions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "submissions_insert_all" ON submissions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "submissions_update_admin" ON submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "submissions_delete_admin" ON submissions FOR DELETE TO authenticated USING (true);

-- Settings table (single row)
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_methods jsonb DEFAULT '{"paypal": "daddygangthreads@gmail.com", "cashapp": "$RoyceRipken"}',
  profile jsonb DEFAULT '{}',
  social_links jsonb DEFAULT '{}',
  leasing_terms text DEFAULT 'USUABLE FOR ALL PURPOSES. Credit: prod. by ThisBeatIzBananaz 🔥',
  notification_email text DEFAULT 'thisbeatizbananaz@gmail.com',
  automated_comments_enabled boolean DEFAULT true,
  bananaz_mode_settings jsonb DEFAULT '{"colorTheme": "gold", "active": false}',
  famz_count integer DEFAULT 11603,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_all" ON app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_insert_admin" ON app_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "settings_update_admin" ON app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "settings_delete_admin" ON app_settings FOR DELETE TO authenticated USING (true);

-- Insert default settings
INSERT INTO app_settings (id) VALUES (gen_random_uuid());

-- Notifications table
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean DEFAULT false,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_admin" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "notif_insert_all" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "notif_update_admin" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notif_delete_admin" ON notifications FOR DELETE TO authenticated USING (true);
