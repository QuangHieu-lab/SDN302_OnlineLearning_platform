-- Duplicate of 20260303000000_add_course_content_flagged: same ALTER TABLE was applied twice.
-- Shadow DB replays all migrations in order; the second ADD COLUMN caused MySQL 1060 (duplicate column).
-- No schema changes here — content_flagged* columns and FK already exist from the earlier migration.
SELECT 1;
