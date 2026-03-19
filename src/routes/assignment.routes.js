const { Router } = require('express');
const {
  getAssignmentByLesson,
} = require('../controllers/assignment.controller');
const { authenticate, requireLecturer } = require('../middleware/auth.middleware');

const router = Router();

router.get('/lessons/:lessonId', authenticate, getAssignmentByLesson);

module.exports = router;
