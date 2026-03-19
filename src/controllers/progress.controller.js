const prisma = require("../utils/prisma");
const {
  ensureCertificateIssuedIfEligible,
} = require("./certificate.controller");
const { mapPrismaError } = require("../utils/error.utils");
const {
  PROGRESS_STATUS_COMPLETED,
  PROGRESS_STATUS_IN_PROGRESS,
  PROGRESS_STATUS_NOT_STARTED,
} = require("../config/constants");
const { computeCourseProgress } = require("../utils/progress.utils");

const updateProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { status, lastWatchedSecond } = req.body;
    const userId = req.userId;
    const lessonIdInt = parseInt(lessonId);

    if (isNaN(lessonIdInt)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
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
      return res.status(404).json({ error: "Lesson not found" });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.module.course.courseId,
        },
      },
    });

    if (!enrollment) {
      return res.status(403).json({
        error: "You must be enrolled in this course to track progress",
      });
    }

    let progressStatus = PROGRESS_STATUS_NOT_STARTED;
    if (status === PROGRESS_STATUS_COMPLETED || status === true) {
      progressStatus = PROGRESS_STATUS_COMPLETED;
    } else if (
      status === PROGRESS_STATUS_IN_PROGRESS ||
      lastWatchedSecond > 0
    ) {
      progressStatus = PROGRESS_STATUS_IN_PROGRESS;
    }

    const learningProgress = await prisma.learningProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: enrollment.enrollmentId,
          lessonId: lessonIdInt,
        },
      },
      update: {
        status: progressStatus,
        lastWatchedSecond: lastWatchedSecond || undefined,
        completedAt:
          progressStatus === PROGRESS_STATUS_COMPLETED ? new Date() : undefined,
      },
      create: {
        enrollmentId: enrollment.enrollmentId,
        lessonId: lessonIdInt,
        status: progressStatus,
        lastWatchedSecond: lastWatchedSecond || 0,
        completedAt:
          progressStatus === PROGRESS_STATUS_COMPLETED ? new Date() : null,
      },
    });
    let certificate = null;

    // Chỉ kiểm tra khi user đã hoàn thành bài học này
    if (progressStatus === PROGRESS_STATUS_COMPLETED) {
      try {
        certificate = await ensureCertificateIssuedIfEligible(
          userId,
          lesson.module.course.courseId,
        );
      } catch (certError) {
        console.error("Auto-issue certificate failed:", certError);
        // Không throw error để tránh làm lỗi luồng update progress chính
      }
    }
    // ============================================================

    // Trả về kết quả kèm thông tin chứng chỉ (nếu có)
    res.json({
      ...learningProgress,
      certificateEarned: !!certificate, // true nếu vừa nhận được bằng
      certificateData: certificate, // Dữ liệu bằng để hiển thị popup
    });
  } catch (error) {
    console.error("Update progress error:", error);
    if (error.code === "P2002") {
      const lessonIdInt = parseInt(req.params.lessonId);
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
      if (lesson) {
        const enrollment = await prisma.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId: req.userId,
              courseId: lesson.module.course.courseId,
            },
          },
        });
        if (enrollment) {
          const learningProgress = await prisma.learningProgress.update({
            where: {
              enrollmentId_lessonId: {
                enrollmentId: enrollment.enrollmentId,
                lessonId: lessonIdInt,
              },
            },
            data: {
              status: req.body.status || "in_progress",
              lastWatchedSecond: req.body.lastWatchedSecond || undefined,
              completedAt:
                req.body.status === PROGRESS_STATUS_COMPLETED
                  ? new Date()
                  : undefined,
            },
          });
          return res.json(learningProgress);
        }
      }
    }
    const { status, message } = mapPrismaError(error);
    return res.status(status).json({ error: message });
  }
};

const getProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const courseIdInt = parseInt(courseId);
    const userId = req.userId;

    if (isNaN(courseIdInt)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: courseIdInt,
        },
      },
    });

    if (!enrollment) {
      return res
        .status(403)
        .json({ error: "You must be enrolled in this course" });
    }

    const course = await prisma.course.findUnique({
      where: { courseId: courseIdInt },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    const allLessonIds = course.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.lessonId),
    );

    const progressRecords = await prisma.learningProgress.findMany({
      where: {
        enrollmentId: enrollment.enrollmentId,
        lessonId: {
          in: allLessonIds,
        },
      },
    });

    const progressMap = new Map(progressRecords.map((p) => [p.lessonId, p]));
    const enrollmentWithProgress = {
      ...enrollment,
      learningProgress: progressRecords,
    };
    const {
      completedCount: completedLessons,
      total: totalLessons,
      percent: percentage,
    } = computeCourseProgress(enrollmentWithProgress, course);

    const progress = {
      courseId: course.courseId,
      courseTitle: course.title,
      enrollmentId: enrollment.enrollmentId,
      totalLessons,
      completedLessons,
      percentage,
      modules: course.modules.map((module) => ({
        moduleId: module.moduleId,
        moduleTitle: module.title,
        lessons: module.lessons.map((lesson) => {
          const progressRecord = progressMap.get(lesson.lessonId);
          return {
            lessonId: lesson.lessonId,
            lessonTitle: lesson.title,
            status: progressRecord?.status || PROGRESS_STATUS_NOT_STARTED,
            lastWatchedSecond: progressRecord?.lastWatchedSecond || 0,
            completedAt: progressRecord?.completedAt || null,
          };
        }),
      })),
    };

    res.json(progress);
  } catch (error) {
    console.error("Get progress error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getUserProgress = async (req, res) => {
  try {
    const userId = req.userId;

    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            modules: {
              include: {
                lessons: true,
              },
            },
          },
        },
        learningProgress: true,
      },
    });

    const progress = enrollments.map((enrollment) => {
      const course = enrollment.course;
      const {
        completedCount: completedLessons,
        total: totalLessons,
        percent: percentage,
      } = computeCourseProgress(enrollment, course);
      return {
        courseId: course.courseId,
        courseTitle: course.title,
        enrollmentId: enrollment.enrollmentId,
        totalLessons,
        completedLessons,
        percentage,
      };
    });

    res.json(progress);
  } catch (error) {
    console.error("Get user progress error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const markLessonStarted = async (req, res) => {
  try {
    const result = await markLessonStartedInternal(
      req.userId,
      req.params.lessonId,
    );
    if (result.error) {
      return res
        .status(result.error.status)
        .json({ error: result.error.message });
    }
    return res.json({
      ...(result.learningProgress || {}),
      courseProgress: result.snapshot,
    });
  } catch (error) {
    console.error("Mark lesson started error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const markLessonViewed = async (req, res) => {
  try {
    const result = await markLessonViewedInternal(
      req.userId,
      req.params.lessonId,
    );
    if (result.error) {
      return res
        .status(result.error.status)
        .json({ error: result.error.message });
    }
    return res.json({
      ...(result.learningProgress || {}),
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
      courseProgress: result.snapshot,
    });
  } catch (error) {
    console.error("Mark lesson viewed error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateLessonVideoProgress = async (req, res) => {
  try {
    const result = await updateLessonVideoProgressInternal(
      req.userId,
      req.params.lessonId,
      req.body || {},
    );
    if (result.error) {
      return res
        .status(result.error.status)
        .json({ error: result.error.message });
    }
    return res.json({
      ...(result.learningProgress || {}),
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
      courseProgress: result.snapshot,
    });
  } catch (error) {
    console.error("Update lesson video progress error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const markResourceViewed = async (req, res) => {
  try {
    const result = await markResourceViewedInternal(
      req.userId,
      req.params.resourceId,
    );
    if (result.error) {
      return res
        .status(result.error.status)
        .json({ error: result.error.message });
    }
    return res.json({
      resourceId: result.resourceIdInt,
      lessonId: result.resource.lessonId,
      courseProgress: result.snapshot,
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
    });
  } catch (error) {
    console.error("Mark resource viewed error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const updateResourceVideoProgress = async (req, res) => {
  try {
    const result = await updateResourceVideoProgressInternal(
      req.userId,
      req.params.resourceId,
      req.body || {},
    );
    if (result.error) {
      return res
        .status(result.error.status)
        .json({ error: result.error.message });
    }
    return res.json({
      resourceId: result.resourceIdInt,
      lessonId: result.resource.lessonId,
      courseProgress: result.snapshot,
      certificateEarned: !!result.certificate,
      certificateData: result.certificate,
    });
  } catch (error) {
    console.error("Update resource video progress error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getInstructorCourseStudentsProgress = async (req, res) => {
  try {
    const courseIdInt = toInt(req.params.courseId);
    if (Number.isNaN(courseIdInt)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const access = await getCourseForInstructor(courseIdInt, req.userId);
    if (access.error) {
      return res
        .status(access.error.status)
        .json({ error: access.error.message });
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
      orderBy: { enrolledAt: "desc" },
    });

    const students = await Promise.all(
      enrollments.map(async (enrollment) => {
        const snapshot = await loadCourseProgressSnapshot(
          enrollment,
          courseIdInt,
        );
        const completedLessonDates = snapshot
          ? snapshot.modules
              .flatMap((module) => module.lessons)
              .map((lesson) => lesson.completedAt)
              .filter(Boolean)
          : [];
        const courseCompletedAt =
          snapshot &&
          Number(snapshot.percentage) >= 100 &&
          completedLessonDates.length > 0
            ? new Date(
                Math.max(
                  ...completedLessonDates.map((value) =>
                    new Date(value).getTime(),
                  ),
                ),
              )
            : null;
        const completionDurationMs =
          courseCompletedAt && enrollment.enrolledAt
            ? courseCompletedAt.getTime() -
              new Date(enrollment.enrolledAt).getTime()
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
      }),
    );

    res.json({
      courseId: courseIdInt,
      courseTitle: access.course.title,
      students: students.filter(Boolean),
    });
  } catch (error) {
    console.error("Get instructor course students progress error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  updateProgress,
  getProgress,
  getUserProgress,
  markLessonStarted,
  markLessonViewed,
  updateLessonVideoProgress,
  markResourceViewed,
  updateResourceVideoProgress,
  getInstructorCourseStudentsProgress,
};
