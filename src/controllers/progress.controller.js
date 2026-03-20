const prisma = require('../utils/prisma');
const { ensureCertificateIssuedIfEligible } = require('./certificate.controller');
const { mapPrismaError } = require('../utils/error.utils');
const {
  ENROLLMENT_STATUS_ACTIVE,
  ENROLLMENT_STATUS_COMPLETED,
  PROGRESS_STATUS_COMPLETED,
  PROGRESS_STATUS_IN_PROGRESS,
} = require('../config/constants');
const { buildEnrollmentProgressSnapshot } = require('../utils/progress.utils');
const {
  FLAGGED_COURSE_MESSAGE,
  getCourseForInstructor,
  getFlaggedCourseError,
} = require('../utils/access.helpers');

function toInt(value) {
  return typeof value === 'string' ? parseInt(value, 10) : value;
}

function isTrackableEnrollment(enrollment) {
  return enrollment && [ENROLLMENT_STATUS_ACTIVE, ENROLLMENT_STATUS_COMPLETED].includes(enrollment.status);
}

async function getLessonContext(userId, lessonId) {
  const lessonIdInt = toInt(lessonId);
  if (Number.isNaN(lessonIdInt)) {
    return { error: { status: 400, message: 'Invalid lesson ID' } };
  }

  const lesson = await prisma.lesson.findUnique({
    where: { lessonId: lessonIdInt },
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

  const flaggedError = getFlaggedCourseError(lesson.module.course);
  if (flaggedError) {
    return { error: flaggedError };
  }

  const userIdInt = toInt(userId);
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: userIdInt,
        courseId: lesson.module.course.courseId,
      },
    },
  });

  if (!isTrackableEnrollment(enrollment)) {
    return { error: { status: 403, message: 'You must be enrolled in this course to track progress' } };
  }

  return { lessonIdInt, userIdInt, lesson, enrollment };
}

async function getResourceContext(userId, resourceId) {
  const resourceIdInt = toInt(resourceId);
  if (Number.isNaN(resourceIdInt)) {
    return { error: { status: 400, message: 'Invalid resource ID' } };
  }

  const resource = await prisma.lessonResource.findUnique({
    where: { resourceId: resourceIdInt },
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

  if (!resource) {
    return { error: { status: 404, message: 'Resource not found' } };
  }

  const flaggedError = getFlaggedCourseError(resource.lesson.module.course);
  if (flaggedError) {
    return { error: flaggedError };
  }

  const userIdInt = toInt(userId);
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: userIdInt,
        courseId: resource.lesson.module.course.courseId,
      },
    },
  });

  if (!isTrackableEnrollment(enrollment)) {
    return { error: { status: 403, message: 'You must be enrolled in this course to track progress' } };
  }

  return { resourceIdInt, userIdInt, resource, enrollment };
}

async function loadCourseProgressSnapshot(enrollment, courseId) {
  const course = await prisma.course.findUnique({
    where: { courseId },
    include: {
      modules: {
        orderBy: { orderIndex: 'asc' },
        include: {
          lessons: {
            orderBy: { orderIndex: 'asc' },
            include: {
              lessonResources: true,
              quizzes: {
                select: { quizId: true, title: true, passingScore: true },
              },
              assignments: {
                select: {
                  assignmentId: true,
                  title: true,
                  instructions: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    return null;
  }

  const lessonIds = course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.lessonId));
  const resourceIds = course.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.lessonResources.map((resource) => resource.resourceId))
  );
  const quizIds = course.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.quizzes.map((quiz) => quiz.quizId))
  );
  const assignmentIds = course.modules.flatMap((module) =>
    module.lessons.flatMap((lesson) => lesson.assignments.map((assignment) => assignment.assignmentId))
  );

  const [learningProgressRecords, resourceProgressRecords, quizAttempts, assignmentSubmissions] = await Promise.all([
    prisma.learningProgress.findMany({
      where: {
        enrollmentId: enrollment.enrollmentId,
        lessonId: { in: lessonIds.length > 0 ? lessonIds : [-1] },
      },
    }),
    prisma.lessonResourceProgress.findMany({
      where: {
        enrollmentId: enrollment.enrollmentId,
        resourceId: { in: resourceIds.length > 0 ? resourceIds : [-1] },
      },
    }),
    prisma.quizAttempt.findMany({
      where: {
        enrollmentId: enrollment.enrollmentId,
        quizId: { in: quizIds.length > 0 ? quizIds : [-1] },
      },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.assignmentSubmission.findMany({
      where: {
        enrollmentId: enrollment.enrollmentId,
        assignmentId: { in: assignmentIds.length > 0 ? assignmentIds : [-1] },
      },
      orderBy: { submittedAt: 'desc' },
    }),
  ]);

  return buildEnrollmentProgressSnapshot({
    enrollment,
    course,
    learningProgressRecords,
    resourceProgressRecords,
    quizAttempts,
    assignmentSubmissions,
  });
}

async function syncLessonProgressState({ enrollment, lessonId, userId }) {
  const snapshot = await loadCourseProgressSnapshot(enrollment, enrollment.courseId);
  if (!snapshot) {
    return { snapshot: null, learningProgress: null, certificate: null };
  }

  const lessonSnapshot = snapshot.modules
    .flatMap((module) => module.lessons)
    .find((lesson) => lesson.lessonId === lessonId);

  let learningProgress = null;
  if (lessonSnapshot) {
    learningProgress = await prisma.learningProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.enrollmentId,
          lessonId,
        },
      },
      update: {
        status: lessonSnapshot.status,
        lastWatchedSecond: lessonSnapshot.lastWatchedSecond || 0,
        contentViewedAt: lessonSnapshot.contentViewedAt,
        videoCompletedAt: lessonSnapshot.videoCompletedAt,
        completedAt: lessonSnapshot.status === PROGRESS_STATUS_COMPLETED ? lessonSnapshot.completedAt || new Date() : null,
      },
      create: {
        enrollmentId: enrollment.enrollmentId,
        lessonId,
        status: lessonSnapshot.status,
        lastWatchedSecond: lessonSnapshot.lastWatchedSecond || 0,
        contentViewedAt: lessonSnapshot.contentViewedAt,
        videoCompletedAt: lessonSnapshot.videoCompletedAt,
        completedAt: lessonSnapshot.status === PROGRESS_STATUS_COMPLETED ? lessonSnapshot.completedAt || new Date() : null,
      },
    });
  }

  await prisma.enrollment.update({
    where: { enrollmentId: enrollment.enrollmentId },
    data: { progressPercent: snapshot.percentage },
  });

  let certificate = null;
  if (lessonSnapshot?.status === PROGRESS_STATUS_COMPLETED) {
    try {
      certificate = await ensureCertificateIssuedIfEligible(userId, enrollment.courseId);
    } catch (certError) {
      console.error('Auto-issue certificate failed:', certError);
    }
  }

  return { snapshot, learningProgress, certificate };
}

async function markLessonStartedInternal(userId, lessonId) {
  const context = await getLessonContext(userId, lessonId);
  if (context.error) return context;

  const { enrollment, lessonIdInt } = context;
  await prisma.learningProgress.upsert({
    where: {
      enrollmentId_lessonId: {
        enrollmentId: enrollment.enrollmentId,
        lessonId: lessonIdInt,
      },
    },
    update: {
      status: PROGRESS_STATUS_IN_PROGRESS,
    },
    create: {
      enrollmentId: enrollment.enrollmentId,
      lessonId: lessonIdInt,
      status: PROGRESS_STATUS_IN_PROGRESS,
    },
  });

  const synced = await syncLessonProgressState({
    enrollment,
    lessonId: lessonIdInt,
    userId: context.userIdInt,
  });
  return { ...context, ...synced };
}

async function markLessonViewedInternal(userId, lessonId) {
  const context = await getLessonContext(userId, lessonId);
  if (context.error) return context;

  const { enrollment, lessonIdInt } = context;
  await prisma.learningProgress.upsert({
    where: {
      enrollmentId_lessonId: {
        enrollmentId: enrollment.enrollmentId,
        lessonId: lessonIdInt,
      },
    },
    update: {
      status: PROGRESS_STATUS_IN_PROGRESS,
      contentViewedAt: new Date(),
    },
    create: {
      enrollmentId: enrollment.enrollmentId,
      lessonId: lessonIdInt,
      status: PROGRESS_STATUS_IN_PROGRESS,
      contentViewedAt: new Date(),
    },
  });

  const synced = await syncLessonProgressState({
    enrollment,
    lessonId: lessonIdInt,
    userId: context.userIdInt,
  });
  return { ...context, ...synced };
}

async function updateLessonVideoProgressInternal(userId, lessonId, payload = {}) {
  const context = await getLessonContext(userId, lessonId);
  if (context.error) return context;

  const { enrollment, lessonIdInt, lesson } = context;
  if (!lesson.mediaUrl) {
    return { error: { status: 400, message: 'This lesson does not have a primary video to track' } };
  }

  const watchedSecond = Math.max(0, Number(payload.lastWatchedSecond || payload.currentSecond || 0));
  const durationSeconds = Math.max(0, Number(lesson.durationSeconds || payload.durationSeconds || 0));
  const ended = Boolean(payload.ended) || (durationSeconds > 0 && watchedSecond >= Math.max(durationSeconds - 1, 0));

  await prisma.learningProgress.upsert({
    where: {
      enrollmentId_lessonId: {
        enrollmentId: enrollment.enrollmentId,
        lessonId: lessonIdInt,
      },
    },
    update: {
      status: PROGRESS_STATUS_IN_PROGRESS,
      lastWatchedSecond: watchedSecond,
      ...(ended ? { videoCompletedAt: new Date() } : {}),
    },
    create: {
      enrollmentId: enrollment.enrollmentId,
      lessonId: lessonIdInt,
      status: PROGRESS_STATUS_IN_PROGRESS,
      lastWatchedSecond: watchedSecond,
      videoCompletedAt: ended ? new Date() : null,
    },
  });

  const synced = await syncLessonProgressState({
    enrollment,
    lessonId: lessonIdInt,
    userId: context.userIdInt,
  });
  return { ...context, ...synced };
}

async function markResourceViewedInternal(userId, resourceId) {
  const context = await getResourceContext(userId, resourceId);
  if (context.error) return context;

  const { enrollment, resourceIdInt, resource } = context;
  await prisma.lessonResourceProgress.upsert({
    where: {
      enrollmentId_resourceId: {
        enrollmentId: enrollment.enrollmentId,
        resourceId: resourceIdInt,
      },
    },
    update: {
      status: PROGRESS_STATUS_COMPLETED,
      viewedAt: new Date(),
      completedAt: new Date(),
    },
    create: {
      enrollmentId: enrollment.enrollmentId,
      resourceId: resourceIdInt,
      status: PROGRESS_STATUS_COMPLETED,
      viewedAt: new Date(),
      completedAt: new Date(),
    },
  });

  const synced = await syncLessonProgressState({
    enrollment,
    lessonId: resource.lessonId,
    userId: context.userIdInt,
  });
  return { ...context, ...synced };
}

async function updateResourceVideoProgressInternal(userId, resourceId, payload = {}) {
  const context = await getResourceContext(userId, resourceId);
  if (context.error) return context;

  const { enrollment, resourceIdInt, resource } = context;
  if (String(resource.fileType || '').toLowerCase() !== 'video') {
    return { error: { status: 400, message: 'This resource is not a video' } };
  }

  const watchedSecond = Math.max(0, Number(payload.lastWatchedSecond || payload.currentSecond || 0));
  const durationSeconds = Math.max(0, Number(payload.durationSeconds || 0));
  const ended = Boolean(payload.ended) || (durationSeconds > 0 && watchedSecond >= Math.max(durationSeconds - 1, 0));

  await prisma.lessonResourceProgress.upsert({
    where: {
      enrollmentId_resourceId: {
        enrollmentId: enrollment.enrollmentId,
        resourceId: resourceIdInt,
      },
    },
    update: {
      status: ended ? PROGRESS_STATUS_COMPLETED : PROGRESS_STATUS_IN_PROGRESS,
      lastWatchedSecond: watchedSecond,
      viewedAt: new Date(),
      completedAt: ended ? new Date() : null,
    },
    create: {
      enrollmentId: enrollment.enrollmentId,
      resourceId: resourceIdInt,
      status: ended ? PROGRESS_STATUS_COMPLETED : PROGRESS_STATUS_IN_PROGRESS,
      lastWatchedSecond: watchedSecond,
      viewedAt: new Date(),
      completedAt: ended ? new Date() : null,
    },
  });

  const synced = await syncLessonProgressState({
    enrollment,
    lessonId: resource.lessonId,
    userId: context.userIdInt,
  });
  return { ...context, ...synced };
}

const updateProgress = async (req, res) => {
  try {
    const { status, action, lastWatchedSecond, durationSeconds, ended } = req.body || {};
    let result;

    if (status === PROGRESS_STATUS_IN_PROGRESS || action === 'start') {
      result = await markLessonStartedInternal(req.userId, req.params.lessonId);
    } else if (
      status === PROGRESS_STATUS_COMPLETED ||
      action === 'mark_viewed' ||
      action === 'viewed'
    ) {
      result = await markLessonViewedInternal(req.userId, req.params.lessonId);
    } else if (lastWatchedSecond != null || durationSeconds != null || ended) {
      result = await updateLessonVideoProgressInternal(req.userId, req.params.lessonId, req.body);
    } else {
      return res.status(400).json({ error: 'Unsupported progress update payload' });
    }

    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    return res.json({
      ...(result.learningProgress || {}),
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
      courseProgress: result.snapshot,
    });
  } catch (error) {
    console.error('Update progress error:', error);
    const { status, message } = mapPrismaError(error);
    return res.status(status).json({ error: message });
  }
};

const markLessonStarted = async (req, res) => {
  try {
    const result = await markLessonStartedInternal(req.userId, req.params.lessonId);
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    return res.json({ ...(result.learningProgress || {}), courseProgress: result.snapshot });
  } catch (error) {
    console.error('Mark lesson started error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markLessonViewed = async (req, res) => {
  try {
    const result = await markLessonViewedInternal(req.userId, req.params.lessonId);
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    return res.json({
      ...(result.learningProgress || {}),
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
      courseProgress: result.snapshot,
    });
  } catch (error) {
    console.error('Mark lesson viewed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateLessonVideoProgress = async (req, res) => {
  try {
    const result = await updateLessonVideoProgressInternal(req.userId, req.params.lessonId, req.body || {});
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    return res.json({
      ...(result.learningProgress || {}),
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
      courseProgress: result.snapshot,
    });
  } catch (error) {
    console.error('Update lesson video progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markResourceViewed = async (req, res) => {
  try {
    const result = await markResourceViewedInternal(req.userId, req.params.resourceId);
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    return res.json({
      resourceId: result.resourceIdInt,
      lessonId: result.resource.lessonId,
      courseProgress: result.snapshot,
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
    });
  } catch (error) {
    console.error('Mark resource viewed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateResourceVideoProgress = async (req, res) => {
  try {
    const result = await updateResourceVideoProgressInternal(req.userId, req.params.resourceId, req.body || {});
    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }
    return res.json({
      resourceId: result.resourceIdInt,
      lessonId: result.resource.lessonId,
      courseProgress: result.snapshot,
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
    });
  } catch (error) {
    console.error('Update resource video progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProgress = async (req, res) => {
  try {
    const courseIdInt = toInt(req.params.courseId);
    if (Number.isNaN(courseIdInt)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const userIdInt = toInt(req.userId);
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: userIdInt,
          courseId: courseIdInt,
        },
      },
    });

    if (!isTrackableEnrollment(enrollment)) {
      return res.status(403).json({ error: 'You must be enrolled in this course' });
    }

    const snapshot = await loadCourseProgressSnapshot(enrollment, courseIdInt);
    if (!snapshot) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = await prisma.course.findUnique({
      where: { courseId: courseIdInt },
      select: { contentFlagged: true },
    });
    if (getFlaggedCourseError(course)) {
      return res.status(403).json({ error: FLAGGED_COURSE_MESSAGE });
    }

    res.json(snapshot);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUserProgress = async (req, res) => {
  try {
    const userIdInt = toInt(req.userId);
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: userIdInt,
        status: {
          in: [ENROLLMENT_STATUS_ACTIVE, ENROLLMENT_STATUS_COMPLETED],
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const progress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const snapshot = await loadCourseProgressSnapshot(enrollment, enrollment.courseId);
        return snapshot
          ? {
              courseId: snapshot.courseId,
              courseTitle: snapshot.courseTitle,
              enrollmentId: snapshot.enrollmentId,
              totalLessons: snapshot.totalLessons,
              completedLessons: snapshot.completedLessons,
              percentage: snapshot.percentage,
              currentModule: snapshot.currentModule,
              currentLesson: snapshot.currentLesson,
            }
          : null;
      })
    );

    res.json(progress.filter(Boolean));
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getInstructorCourseStudentsProgress = async (req, res) => {
  try {
    const courseIdInt = toInt(req.params.courseId);
    if (Number.isNaN(courseIdInt)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const access = await getCourseForInstructor(courseIdInt, req.userId);
    if (access.error) {
      return res.status(access.error.status).json({ error: access.error.message });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId: courseIdInt,
        status: {
          in: [ENROLLMENT_STATUS_ACTIVE, ENROLLMENT_STATUS_COMPLETED],
        },
      },
      include: {
        user: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const students = await Promise.all(
      enrollments.map(async (enrollment) => {
        const snapshot = await loadCourseProgressSnapshot(enrollment, courseIdInt);
        const completedLessonDates = snapshot
          ? snapshot.modules
              .flatMap((module) => module.lessons)
              .map((lesson) => lesson.completedAt)
              .filter(Boolean)
          : [];
        const courseCompletedAt =
          snapshot && Number(snapshot.percentage) >= 100 && completedLessonDates.length > 0
            ? new Date(
                Math.max(...completedLessonDates.map((value) => new Date(value).getTime()))
              )
            : null;
        const completionDurationMs =
          courseCompletedAt && enrollment.enrolledAt
            ? courseCompletedAt.getTime() - new Date(enrollment.enrolledAt).getTime()
            : null;

        return snapshot
          ? {
              student: enrollment.user,
              enrollmentId: enrollment.enrollmentId,
              enrolledAt: enrollment.enrolledAt,
              enrollmentStatus: enrollment.status,
              courseCompletedAt,
              completionDurationMs,
              progressPercent: snapshot.percentage,
              completedLessons: snapshot.completedLessons,
              totalLessons: snapshot.totalLessons,
              currentModule: snapshot.currentModule,
              currentLesson: snapshot.currentLesson,
              modules: snapshot.modules,
            }
          : null;
      })
    );

    res.json({
      courseId: courseIdInt,
      courseTitle: access.course.title,
      students: students.filter(Boolean),
    });
  } catch (error) {
    console.error('Get instructor course students progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getInstructorCourseStudentsProgress,
  getProgress,
  getUserProgress,
  markLessonStarted,
  markLessonViewed,
  markResourceViewed,
  updateLessonVideoProgress,
  updateProgress,
  updateResourceVideoProgress,
  syncLessonProgressState,
};
