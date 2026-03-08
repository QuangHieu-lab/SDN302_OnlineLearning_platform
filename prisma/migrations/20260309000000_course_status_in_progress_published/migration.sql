-- Step 1: Expand enum to include in_progress so we can update existing rows
ALTER TABLE `courses` MODIFY COLUMN `status` ENUM('draft','pending_review','approved_upload','published','rejected','archived','in_progress') NOT NULL DEFAULT 'draft';

-- Step 2: Map old status values to new (draft/pending_review/rejected/approved_upload -> in_progress, published stays published)
UPDATE `courses` SET `status` = 'in_progress' WHERE `status` IN ('draft','pending_review','rejected','approved_upload');

-- Step 3: Restrict enum to in_progress, published, archived and set default
ALTER TABLE `courses` MODIFY COLUMN `status` ENUM('in_progress','published','archived') NOT NULL DEFAULT 'in_progress';
