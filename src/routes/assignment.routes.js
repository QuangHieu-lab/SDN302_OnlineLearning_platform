const { Router } = require("express");

const {
  authenticate,
  requireLecturer,
} = require("../middleware/auth.middleware");
const {
  getAssignmentByLesson,
  submitAssignment,
  listLessonSubmissions,
} = require("../controllers/assignment.controller");

const router = Router();

router.get("/lessons/:lessonId", authenticate, getAssignmentByLesson);
router.post("/lessons/:lessonId/submissions", authenticate, submitAssignment);
router.get('/lessons/:lessonId/submissions', authenticate, requireLecturer, listLessonSubmissions);
module.exports = router;
