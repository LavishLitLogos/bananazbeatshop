-- Drop overly permissive policies for beats
DROP POLICY IF EXISTS beats_delete_all ON beats;
DROP POLICY IF EXISTS beats_insert_all ON beats;
DROP POLICY IF EXISTS beats_update_all ON beats;

-- Drop overly permissive policies for prod_by_songs
DROP POLICY IF EXISTS prod_delete_all ON prod_by_songs;
DROP POLICY IF EXISTS prod_insert_all ON prod_by_songs;
DROP POLICY IF EXISTS prod_update_all ON prod_by_songs;

-- Keep SELECT open for browsing (this is fine - public can view approved beats)
-- beats_select_all already exists, no change needed
-- prod_select_all already exists, no change needed

-- Create restrictive write policies - only service role can write
-- (service role bypasses RLS, so these policies effectively block regular users)
-- We explicitly deny anon and authenticated from writing

CREATE POLICY "beats_insert_service_only" ON beats
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "beats_update_service_only" ON beats
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "beats_delete_service_only" ON beats
  FOR DELETE
  TO authenticated, anon
  USING (false);

CREATE POLICY "prod_insert_service_only" ON prod_by_songs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "prod_update_service_only" ON prod_by_songs
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "prod_delete_service_only" ON prod_by_songs
  FOR DELETE
  TO authenticated, anon
  USING (false);