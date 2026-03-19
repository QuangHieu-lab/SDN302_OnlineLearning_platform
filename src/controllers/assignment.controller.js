const prisma = require("../utils/prisma");
const {
  ensureLessonAccessWithCourse,
  sendAccessError,
} = require("../utils/access.helpers");

async function getAssignmentByLesson(req, res) {
  try {
    const { lessonId } = req.params;
    const userId = req.userId;

    const access = await ensureLessonAccessWithCourse(lessonId, userId, {
      roles: req.userRoles || [],
    });
    if (access.error) {
      return sendAccessError(res, access.error);
    }

    const lesson = await loadAssignmentLesson(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const assignment = lesson.assignments?.[0];
    if (!assignment) {
      return res
        .status(404)
        .json({ error: "Assignment not found for this lesson" });
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

    let latestSubmission = null;
    if (enrollment) {
      latestSubmission = await prisma.assignmentSubmission.findFirst({
        where: {
          assignmentId: assignment.assignmentId,
          enrollmentId: enrollment.enrollmentId,
        },
        orderBy: {
          submittedAt: "desc",
        },
      });
    }

    return res.json({
      assignment: {
        assignmentId: assignment.assignmentId,
        lessonId: lesson.lessonId,
        lessonTitle: lesson.title,
        title: assignment.title || lesson.title,
        instructions: assignment.instructions || "",
      },
      latestSubmission: latestSubmission
        ? mapSubmission(latestSubmission)
        : null,
    });
  } catch (error) {
    console.error("Get assignment by lesson error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  getAssignmentByLesson,
};
