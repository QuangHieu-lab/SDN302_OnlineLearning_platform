const { Router } = require("express");

const {
  authenticate,
  requireLecturer,
} = require("../middleware/auth.middleware");
const {
  getAssignmentByLesson,
} = require("../controllers/assignment.controller");

const router = Router();

router.get("/lessons/:lessonId", authenticate, getAssignmentByLesson);
router.post("/lessons/:lessonId/submissions", authenticate, submitAssignment);

module.exports = router;
