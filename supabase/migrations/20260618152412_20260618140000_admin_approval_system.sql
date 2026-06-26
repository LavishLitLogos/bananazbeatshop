
-- Add admin approval to beats
ALTER TABLE beats ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT false;
ALTER TABLE beats ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT '';

-- Add admin approval to beat_tapes
ALTER TABLE beat_tapes ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT false;
ALTER TABLE beat_tapes ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT '';

-- Add admin approval to prod_by_songs
ALTER TABLE prod_by_songs ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT false;
ALTER TABLE prod_by_songs ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT '';

-- Add admin approval to submissions (already exists but ensure)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT false;

-- Add admin approval to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_received boolean DEFAULT false;

-- Add admin approval to lab_messages
ALTER TABLE lab_messages ADD COLUMN IF NOT EXISTS admin_approved boolean DEFAULT true;

-- Update existing data to be approved (so current content shows)
UPDATE beats SET admin_approved = true;
UPDATE beat_tapes SET admin_approved = true;
UPDATE prod_by_songs SET admin_approved = true;
UPDATE orders SET admin_approved = true WHERE status IN ('Released', 'Sold');
UPDATE orders SET admin_approved = false WHERE status = 'Pending Verification';
UPDATE lab_messages SET admin_approved = true;

-- Add admin_only access table for audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON admin_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert_admin" ON admin_audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_update_admin" ON admin_audit_log FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_delete_admin" ON admin_audit_log FOR DELETE TO authenticated USING (true);
