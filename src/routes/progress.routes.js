const { Router } = require("express");
const {
  updateProgress,
  getProgress,
  getUserProgress,
  markLessonStarted,
} = require("../controllers/progress.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = Router();

router.post("/lessons/:lessonId", authenticate, updateProgress);
router.post("/lessons/:lessonId/start", authenticate, markLessonStarted);
router.post('/lessons/:lessonId/viewed', authenticate, markLessonViewed);
router.get("/courses/:courseId", authenticate, getProgress);
router.get("/user", authenticate, getUserProgress);

module.exports = router;
