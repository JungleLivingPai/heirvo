-- Allow users to give sessions a friendly name (e.g. "Mom's Wedding 1998")
-- independent of the disc's own label which is often generic or empty.
ALTER TABLE recovery_sessions ADD COLUMN user_label TEXT;
