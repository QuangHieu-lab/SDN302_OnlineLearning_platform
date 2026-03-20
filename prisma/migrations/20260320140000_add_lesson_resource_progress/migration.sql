CREATE TABLE `lesson_resource_progress` (
    `resource_progress_id` INTEGER NOT NULL AUTO_INCREMENT,
    `enrollment_id` INTEGER NOT NULL,
    `resource_id` INTEGER NOT NULL,
    `status` ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
    `last_watched_second` INTEGER NOT NULL DEFAULT 0,
    `viewed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `lesson_resource_progress_enrollment_id_resource_id_key`(`enrollment_id`, `resource_id`),
    PRIMARY KEY (`resource_progress_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `lesson_resource_progress` ADD CONSTRAINT `lesson_resource_progress_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`enrollment_id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `lesson_resource_progress` ADD CONSTRAINT `lesson_resource_progress_resource_id_fkey` FOREIGN KEY (`resource_id`) REFERENCES `lesson_resources`(`resource_id`) ON DELETE CASCADE ON UPDATE CASCADE;
