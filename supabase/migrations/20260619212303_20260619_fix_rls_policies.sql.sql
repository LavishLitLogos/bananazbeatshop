-- Fix RLS policies to allow anon role for admin operations (single-admin shop)
-- Drop restrictive policies that only allow authenticated role

-- BEATS TABLE
DROP POLICY IF EXISTS beats_insert_admin ON beats;
DROP POLICY IF EXISTS beats_update_admin ON beats;
DROP POLICY IF EXISTS beats_delete_admin ON beats;

CREATE POLICY beats_insert_all ON beats FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY beats_update_all ON beats FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY beats_delete_all ON beats FOR DELETE
  TO anon, authenticated USING (true);

-- BEAT_TAPES TABLE
DROP POLICY IF EXISTS beat_tapes_insert_admin ON beat_tapes;
DROP POLICY IF EXISTS beat_tapes_update_admin ON beat_tapes;
DROP POLICY IF EXISTS beat_tapes_delete_admin ON beat_tapes;

CREATE POLICY beat_tapes_insert_all ON beat_tapes FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY beat_tapes_update_all ON beat_tapes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY beat_tapes_delete_all ON beat_tapes FOR DELETE
  TO anon, authenticated USING (true);

-- PROD_BY_SONGS TABLE
DROP POLICY IF EXISTS prod_insert_admin ON prod_by_songs;
DROP POLICY IF EXISTS prod_update_admin ON prod_by_songs;
DROP POLICY IF EXISTS prod_delete_admin ON prod_by_songs;

CREATE POLICY prod_insert_all ON prod_by_songs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY prod_update_all ON prod_by_songs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY prod_delete_all ON prod_by_songs FOR DELETE
  TO anon, authenticated USING (true);

-- ORDERS TABLE - allow anon update for admin operations
DROP POLICY IF EXISTS orders_update_admin ON orders;
DROP POLICY IF EXISTS orders_delete_admin ON orders;

CREATE POLICY orders_update_all ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY orders_delete_all ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- SUBMISSIONS TABLE - allow anon update for admin operations
DROP POLICY IF EXISTS submissions_update_admin ON submissions;
DROP POLICY IF EXISTS submissions_delete_admin ON submissions;

CREATE POLICY submissions_update_all ON submissions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY submissions_delete_all ON submissions FOR DELETE
  TO anon, authenticated USING (true);

-- APP_SETTINGS TABLE
DROP POLICY IF EXISTS settings_insert_admin ON app_settings;
DROP POLICY IF EXISTS settings_update_admin ON app_settings;
DROP POLICY IF EXISTS settings_delete_admin ON app_settings;

CREATE POLICY settings_insert_all ON app_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY settings_update_all ON app_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY settings_delete_all ON app_settings FOR DELETE
  TO anon, authenticated USING (true);

-- NOTIFICATIONS TABLE - allow anon update/delete for admin
DROP POLICY IF EXISTS notif_update_admin ON notifications;
DROP POLICY IF EXISTS notif_delete_admin ON notifications;

CREATE POLICY notif_update_all ON notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY notif_delete_all ON notifications FOR DELETE
  TO anon, authenticated USING (true);

-- ADMIN_AUDIT_LOG - allow anon insert/select
DROP POLICY IF EXISTS audit_insert_all ON admin_audit_log;
DROP POLICY IF EXISTS audit_select_all ON admin_audit_log;

CREATE POLICY audit_insert_all ON admin_audit_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY audit_select_all ON admin_audit_log FOR SELECT
  TO anon, authenticated USING (true);

-- LAB_MESSAGES - allow anon insert/update for community chat
DROP POLICY IF EXISTS lab_messages_insert_admin ON lab_messages;
DROP POLICY IF EXISTS lab_messages_update_admin ON lab_messages;

CREATE POLICY lab_messages_insert_all ON lab_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY lab_messages_update_all ON lab_messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY lab_messages_delete_all ON lab_messages FOR DELETE
  TO anon, authenticated USING (true);

-- BEAT_TAPE_TRACKS - allow anon operations
DROP POLICY IF EXISTS beat_tape_tracks_insert_admin ON beat_tape_tracks;
DROP POLICY IF EXISTS beat_tape_tracks_update_admin ON beat_tape_tracks;
DROP POLICY IF EXISTS beat_tape_tracks_delete_admin ON beat_tape_tracks;

CREATE POLICY beat_tape_tracks_insert_all ON beat_tape_tracks FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY beat_tape_tracks_update_all ON beat_tape_tracks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY beat_tape_tracks_delete_all ON beat_tape_tracks FOR DELETE
  TO anon, authenticated USING (true);