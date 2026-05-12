-- Add disc_type column for disc-type-aware Save UX.
-- NULLable so old sessions keep working; backend / frontend treat NULL as
-- 'Unknown' and falls back to showing all Save buttons.
ALTER TABLE recovery_sessions ADD COLUMN disc_type TEXT;
