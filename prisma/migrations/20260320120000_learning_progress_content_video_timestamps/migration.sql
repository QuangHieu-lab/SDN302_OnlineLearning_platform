-- Track text content viewed and primary lesson video completion per enrollment+lesson
ALTER TABLE `learning_progress`
  ADD COLUMN `content_viewed_at` DATETIME(3) NULL,
  ADD COLUMN `video_completed_at` DATETIME(3) NULL;
