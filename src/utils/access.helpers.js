const prisma = require('./prisma');
const {
  ENROLLMENT_STATUS_ACTIVE,
  ENROLLMENT_STATUS_COMPLETED,
} = require('../config/constants');

const FLAGGED_COURSE_MESSAGE =
  'This course is temporarily unavailable because it has been flagged by the admin. Please come back later.';

function isAdminRole(roles = []) {
  return Array.isArray(roles) && roles.includes('admin');
}

function getFlaggedCourseError(course, roles = []) {
  if (course?.contentFlagged && !isAdminRole(roles)) {
    return { status: 403, message: FLAGGED_COURSE_MESSAGE };
  }
  return null;
}

function parseId(value, name) {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (Number.isNaN(n)) {
    return { error: { status: 400, message: `Invalid ${name}` } };
  }
  return { value: n };
}

/**
 * Load lesson by ID and check access: user is instructor, admin, or has active enrollment.
 * lessonId: number or string.
 * options.roles: optional array (e.g. req.userRoles); if includes 'admin', access is allowed.
 * Returns { lesson } or { error: { status, message } }.
 */
async function ensureLessonAccess(lessonId, userId, options = {}) {
  const parsed = parseId(lessonId, 'lesson ID');
  if (parsed.error) return parsed;

  const lesson = await prisma.lesson.findUnique({
    where: { lessonId: parsed.value },
    include: {
      module: {
        include: {
          course: { select: { courseId: true, instructorId: true } },
        },
      },
    },
  });

  if (!lesson) {
    return { error: { status: 404, message: 'Lesson not found' } };
  }

  const roles = options.roles || [];
  if (Array.isArray(roles) && roles.includes('admin')) {
    return { lesson };
  }

  const courseId = lesson.module.course.courseId;
  const instructorId = lesson.module.course.instructorId;
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  if (instructorId === userIdNum) {
    return { lesson };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: userIdNum, courseId } },
  });
  if (!enrollment || enrollment.status !== ENROLLMENT_STATUS_ACTIVE) {
    return { error: { status: 403, message: 'Not authorized to access this course content' } };
  }
  return { lesson };
}

/**
 * Same as ensureLessonAccess but for use when you already have lessonId (e.g. quiz by lesson).
 * Alias for consistency in quiz controller.
 */
async function ensureQuizLessonAccess(lessonId, userId, options = {}) {
  return ensureLessonAccess(lessonId, userId, options);
}

/**
 * Load lesson and require user to be course instructor. For create quiz, etc.
 */
async function getLessonForInstructor(lessonId, userId) {
  const parsed = parseId(lessonId, 'lesson ID');
  if (parsed.error) return parsed;

  const lesson = await prisma.lesson.findUnique({
    where: { lessonId: parsed.value },
    include: {
      module: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!lesson) {
    return { error: { status: 404, message: 'Lesson not found' } };
  }

  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (lesson.module.course.instructorId !== userIdNum) {
    return { error: { status: 403, message: 'Not authorized' } };
  }
  return { lesson };
}

/**
 * Get lesson with full course (for controllers that need course object).
 * options.roles: if includes 'admin', access is allowed.
 */
async function ensureLessonAccessWithCourse(lessonId, userId, options = {}) {
  const parsed = parseId(lessonId, 'lesson ID');
  if (parsed.error) return parsed;

  const lesson = await prisma.lesson.findUnique({
    where: { lessonId: parsed.value },
    include: {
      module: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!lesson) {
    return { error: { status: 404, message: 'Lesson not found' } };
  }

  const roles = options.roles || [];
  if (Array.isArray(roles) && roles.includes('admin')) {
    return { lesson };
  }

  const courseId = lesson.module.course.courseId;
  const instructorId = lesson.module.course.instructorId;
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  if (instructorId === userIdNum) {
    return { lesson };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: userIdNum, courseId } },
  });
  if (!enrollment || enrollment.status !== ENROLLMENT_STATUS_ACTIVE) {
    return { error: { status: 403, message: 'Not authorized to access this course content' } };
  }
  return { lesson };
}

/**
 * Load module by ID and check access (instructor, admin, or active enrollment).
 * options.roles: if includes 'admin', access is allowed.
 * Returns { module } or { error: { status, message } }.
 */
async function ensureModuleAccess(moduleId, userId, options = {}) {
  const parsed = parseId(moduleId, 'module ID');
  if (parsed.error) return parsed;

  const module = await prisma.module.findUnique({
    where: { moduleId: parsed.value },
    include: { course: { select: { courseId: true, instructorId: true } } },
  });

  if (!module) {
    return { error: { status: 404, message: 'Module not found' } };
  }

  const roles = options.roles || [];
  if (Array.isArray(roles) && roles.includes('admin')) {
    return { module };
  }

  const courseId = module.course.courseId;
  const instructorId = module.course.instructorId;
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  if (instructorId === userIdNum) {
    return { module };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: userIdNum, courseId } },
  });
  if (!enrollment || enrollment.status !== ENROLLMENT_STATUS_ACTIVE) {
    return { error: { status: 403, message: 'Not authorized to access this course content' } };
  }
  return { module };
}

/**
 * Load module and require user to be course instructor. For create/update/delete lesson.
 */
async function getModuleForInstructor(moduleId, userId) {
  const parsed = parseId(moduleId, 'module ID');
  if (parsed.error) return parsed;

  const module = await prisma.module.findUnique({
    where: { moduleId: parsed.value },
    include: { course: true },
  });

  if (!module) {
    return { error: { status: 404, message: 'Module not found' } };
  }

  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (module.course.instructorId !== userIdNum) {
    return { error: { status: 403, message: 'Not authorized' } };
  }
  return { module };
}

/**
 * Load course and optionally require instructor ownership.
 * Returns { course } or { error: { status, message } }.
 */
async function ensureCourseAccess(courseId, userId, options = {}) {
  const { requireInstructor = false } = options;
  const parsed = parseId(courseId, 'course ID');
  if (parsed.error) return parsed;

  const course = await prisma.course.findUnique({
    where: { courseId: parsed.value },
    ...(options.include && { include: options.include }),
  });

  if (!course) {
    return { error: { status: 404, message: 'Course not found' } };
  }

  if (requireInstructor) {
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (course.instructorId !== userIdNum) {
      return { error: { status: 403, message: 'Not authorized' } };
    }
  }

  return { course };
}

/**
 * Ensure user is the course instructor. Convenience for update/delete/createModule etc.
 * options.include passed to findUnique when loading course.
 */
async function getCourseForInstructor(courseId, userId, options = {}) {
  return ensureCourseAccess(courseId, userId, { requireInstructor: true, ...options });
}

/**
 * Ensure user can access the quiz (instructor, admin, or enrolled).
 * options.roles: if includes 'admin', access is allowed.
 * Returns { quiz } or { error }.
 */
async function ensureQuizAccess(quizId, userId, options = {}) {
  const parsed = parseId(quizId, 'quiz ID');
  if (parsed.error) return parsed;

  const quiz = await prisma.quiz.findUnique({
    where: { quizId: parsed.value },
    include: {
      lesson: {
        include: {
          module: {
            include: {
              course: { select: { courseId: true, instructorId: true } },
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    return { error: { status: 404, message: 'Quiz not found' } };
  }

  const roles = options.roles || [];
  if (Array.isArray(roles) && roles.includes('admin')) {
    return { quiz };
  }

  const courseId = quiz.lesson.module.course.courseId;
  const instructorId = quiz.lesson.module.course.instructorId;
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  if (instructorId === userIdNum) {
    return { quiz };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: userIdNum, courseId } },
  });
  if (
    !enrollment ||
    (enrollment.status !== ENROLLMENT_STATUS_ACTIVE &&
      enrollment.status !== ENROLLMENT_STATUS_COMPLETED)
  ) {
    return { error: { status: 403, message: 'Not authorized to access this quiz' } };
  }
  return { quiz };
}

/**
 * Load quiz and require user to be course instructor. For update/delete quiz.
 */
async function getQuizForInstructor(quizId, userId) {
  const parsed = parseId(quizId, 'quiz ID');
  if (parsed.error) return parsed;

  const quiz = await prisma.quiz.findUnique({
    where: { quizId: parsed.value },
    include: {
      lesson: {
        include: {
          module: {
            include: {
              course: true,
            },
          },
        },
      },
    },
  });

  if (!quiz) {
    return { error: { status: 404, message: 'Quiz not found' } };
  }

  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (quiz.lesson.module.course.instructorId !== userIdNum) {
    return { error: { status: 403, message: 'Not authorized' } };
  }
  return { quiz };
}

/**
 * Ensure user is instructor of the course that owns the question (via quiz → lesson → module → course).
 * Can be called with questionId or quizId. Returns { question, quiz } or { quiz } or { error }.
 */
async function ensureQuestionOwnership(identifier, userId, byQuestionId = true) {
  if (byQuestionId) {
    const parsed = parseId(identifier, 'question ID');
    if (parsed.error) return parsed;

    const question = await prisma.question.findUnique({
      where: { questionId: parsed.value },
      include: {
        quiz: {
          include: {
            lesson: {
              include: {
                module: {
                  include: {
                    course: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!question) {
      return { error: { status: 404, message: 'Question not found' } };
    }

    const instructorId = question.quiz.lesson.module.course.instructorId;
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (instructorId !== userIdNum) {
      return { error: { status: 403, message: 'Not authorized' } };
    }
    return { question, quiz: question.quiz };
  } else {
    const parsed = parseId(identifier, 'quiz ID');
    if (parsed.error) return parsed;

    const quiz = await prisma.quiz.findUnique({
      where: { quizId: parsed.value },
      include: {
        lesson: {
          include: {
            module: {
              include: {
                course: true,
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      return { error: { status: 404, message: 'Quiz not found' } };
    }

    const instructorId = quiz.lesson.module.course.instructorId;
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (instructorId !== userIdNum) {
      return { error: { status: 403, message: 'Not authorized' } };
    }
    return { quiz };
  }
}

/**
 * Ensure user is instructor of the course that owns the answer (via question → quiz → lesson → module → course).
 */
async function ensureAnswerOwnership(answerId, userId) {
  const parsed = parseId(answerId, 'answer ID');
  if (parsed.error) return parsed;

  const answer = await prisma.questionAnswer.findUnique({
    where: { answerId: parsed.value },
    include: {
      question: {
        include: {
          quiz: {
            include: {
              lesson: {
                include: {
                  module: {
                    include: {
                      course: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!answer) {
    return { error: { status: 404, message: 'Answer not found' } };
  }

  const instructorId = answer.question.quiz.lesson.module.course.instructorId;
  const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (instructorId !== userIdNum) {
    return { error: { status: 403, message: 'Not authorized' } };
  }
  return { answer };
}

function sendAccessError(res, err) {
  return res.status(err.status).json({ error: err.message });
}

module.exports = {
  FLAGGED_COURSE_MESSAGE,
  getFlaggedCourseError,
  isAdminRole,
  parseId,
  ensureModuleAccess,
  getModuleForInstructor,
  ensureLessonAccess,
  ensureQuizLessonAccess,
  getLessonForInstructor,
  ensureLessonAccessWithCourse,
  ensureCourseAccess,
  getCourseForInstructor,
  ensureQuizAccess,
  getQuizForInstructor,
  ensureQuestionOwnership,
  ensureAnswerOwnership,
  sendAccessError,
};
