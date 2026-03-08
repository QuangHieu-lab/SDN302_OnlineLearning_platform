-- AlterTable
ALTER TABLE `courses` ADD COLUMN `content_flagged` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `content_flagged_at` DATETIME(3) NULL,
    ADD COLUMN `content_flagged_by` INTEGER NULL,
    ADD COLUMN `content_flagged_reason` TEXT NULL;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_content_flagged_by_fkey` FOREIGN KEY (`content_flagged_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
