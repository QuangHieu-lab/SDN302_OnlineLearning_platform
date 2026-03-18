const { Router } = require("express");
const {
  updateProgress,
  getProgress,
  getUserProgress,
  markLessonStarted,
  markLessonViewed,
  updateLessonVideoProgress,
  markResourceViewed,
  updateResourceVideoProgress,
} = require("../controllers/progress.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = Router();

router.post("/lessons/:lessonId", authenticate, updateProgress);
router.post("/lessons/:lessonId/start", authenticate, markLessonStarted);
router.post('/lessons/:lessonId/viewed', authenticate, markLessonViewed);
router.post('/lessons/:lessonId/video', authenticate, updateLessonVideoProgress);
router.post('/resources/:resourceId/viewed', authenticate, markResourceViewed);
router.post('/resources/:resourceId/video', authenticate, updateResourceVideoProgress);
router.get("/courses/:courseId", authenticate, getProgress);
router.get("/user", authenticate, getUserProgress);

module.exports = router;
