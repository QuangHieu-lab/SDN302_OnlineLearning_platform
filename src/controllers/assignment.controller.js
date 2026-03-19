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

async function submitAssignment(req, res) {
  try {
    const { lessonId } = req.params;
    const userId = req.userId;
    const { contentText, fileUrl } = req.body;

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

    if (lesson.module.course.instructorId === toInt(userId)) {
      return res
        .status(403)
        .json({ error: "Instructors cannot submit their own assignment" });
    }

    const assignment = lesson.assignments?.[0];
    if (!assignment) {
      return res
        .status(404)
        .json({ error: "Assignment not found for this lesson" });
    }

    if (!String(contentText || "").trim() && !String(fileUrl || "").trim()) {
      return res
        .status(400)
        .json({ error: "Assignment text or file URL is required" });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: toInt(userId),
          courseId: lesson.module.course.courseId,
        },
      },
    });

    if (!enrollment) {
      return res
        .status(403)
        .json({ error: "You must be enrolled to submit this assignment" });
    }

    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: assignment.assignmentId,
        enrollmentId: enrollment.enrollmentId,
        contentText: String(contentText || "").trim() || null,
        fileUrl: String(fileUrl || "").trim() || null,
      },
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                userId: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return res.status(201).json({
      message: "Assignment submitted successfully",
      submission: mapSubmission(submission),
    });
  } catch (error) {
    console.error("Submit assignment error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  getAssignmentByLesson,
  submitAssignment,
};
