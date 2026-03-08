const { Router } = require('express');
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  createModule,
  getCourseModules,
  enrollInCourse,
  getCoursesByStudentId,
  submitCourseForReview,
  publishCourse,
  approveCourse,
  rejectCourse,
  reviseCourse,
  flagCourseContent,
  unflagCourseContent,
  getPendingCourses,
  getInstructorCourses,
  uploadCourseThumbnail,
} = require('../controllers/course.controller');
const { authenticate, optionalAuthenticate, requireLecturer, requireAdmin } = require('../middleware/auth.middleware');
const { uploadThumbnail } = require('../middleware/upload.middleware');

const router = Router();

router.post('/', authenticate, requireLecturer, createCourse);
router.get('/', optionalAuthenticate, getCourses);

// Filtered course listing routes (must come before /:courseId)
router.get('/pending', authenticate, requireAdmin, getPendingCourses);
router.get('/instructor/:instructorId', authenticate, getInstructorCourses);
router.get('/student/:studentId', authenticate, getCoursesByStudentId);

// Course submission and review routes (must come before generic /:courseId)
router.post('/:courseId/submit', authenticate, requireLecturer, submitCourseForReview);
router.post('/:courseId/publish', authenticate, requireLecturer, publishCourse);
router.post('/:courseId/approve', authenticate, requireAdmin, approveCourse);
router.post('/:courseId/reject', authenticate, requireAdmin, rejectCourse);
router.post('/:courseId/flag', authenticate, requireAdmin, flagCourseContent);
router.post('/:courseId/unflag', authenticate, requireAdmin, unflagCourseContent);
router.put('/:courseId/revise', authenticate, requireLecturer, reviseCourse);
router.post('/:courseId/thumbnail', authenticate, requireLecturer, uploadThumbnail.single('thumbnail'), uploadCourseThumbnail);

// Generic course routes (/:courseId/modules must be before /:courseId)
router.get('/:courseId/modules', authenticate, getCourseModules);
router.get('/:courseId', optionalAuthenticate, getCourseById);
router.put('/:courseId', authenticate, requireLecturer, updateCourse);
router.delete('/:courseId', authenticate, requireLecturer, deleteCourse);
router.post('/:courseId/modules', authenticate, requireLecturer, createModule);
router.post('/:courseId/enroll', authenticate, enrollInCourse);

module.exports = router;
