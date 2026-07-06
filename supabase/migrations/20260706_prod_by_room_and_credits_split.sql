ALTER TABLE prod_by_songs
  ADD COLUMN IF NOT EXISTS room_type text DEFAULT 'prodby',
  ADD COLUMN IF NOT EXISTS external_url text DEFAULT '';

UPDATE prod_by_songs
SET room_type = CASE
  WHEN COALESCE(NULLIF(trim(artist_name), ''), '') <> '' AND COALESCE(exclusive, false) = false THEN 'credits'
  ELSE 'prodby'
END
WHERE room_type IS NULL OR room_type = '';

ALTER TABLE prod_by_songs
  ALTER COLUMN room_type SET DEFAULT 'prodby';

ALTER TABLE prod_by_songs
  DROP CONSTRAINT IF EXISTS prod_by_songs_room_type_check;

ALTER TABLE prod_by_songs
  ADD CONSTRAINT prod_by_songs_room_type_check
  CHECK (room_type IN ('prodby', 'credits'));
