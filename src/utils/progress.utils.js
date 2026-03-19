const {
  PROGRESS_STATUS_COMPLETED,
  PROGRESS_STATUS_IN_PROGRESS,
  PROGRESS_STATUS_NOT_STARTED,
} = require("../config/constants");

function normalizeProgressStatus(value) {
  if (value === PROGRESS_STATUS_COMPLETED) return PROGRESS_STATUS_COMPLETED;
  if (value === PROGRESS_STATUS_IN_PROGRESS) return PROGRESS_STATUS_IN_PROGRESS;
  return PROGRESS_STATUS_NOT_STARTED;
}

function computeCourseProgress(enrollment, course) {
  const allLessonIds = course.modules.flatMap((m) =>
    m.lessons.map((l) => l.lessonId),
  );
  const total = allLessonIds.length;
  const progressRecords = enrollment.learningProgress || [];
  const completedCount = progressRecords.filter(
    (p) => p.status === PROGRESS_STATUS_COMPLETED,
  ).length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  return { completedCount, total, percent };
}

function isVideoResource(resource) {
  return String(resource?.fileType || "").toLowerCase() === "video";
}

function buildLessonProgressState({
  lesson,
  learningProgress,
  resourceProgressMap,
  quizAttempts,
  assignmentSubmissions,
}) {
  const lessonResources = Array.isArray(lesson.lessonResources)
    ? lesson.lessonResources
    : [];
  const quiz =
    Array.isArray(lesson.quizzes) && lesson.quizzes.length > 0
      ? lesson.quizzes[0]
      : null;
  const assignment =
    Array.isArray(lesson.assignments) && lesson.assignments.length > 0
      ? lesson.assignments[0]
      : null;
  const latestAssignmentSubmission =
    Array.isArray(assignmentSubmissions) && assignmentSubmissions.length > 0
      ? [...assignmentSubmissions].sort(
          (left, right) =>
            new Date(right.submittedAt).getTime() -
            new Date(left.submittedAt).getTime(),
        )[0]
      : null;

  const hasContentRequirement = Boolean((lesson.contentText || "").trim());
  const hasPrimaryVideoRequirement = Boolean(lesson.mediaUrl);
  const hasQuizRequirement = Boolean(quiz);
  const hasAssignmentRequirement = Boolean(assignment);

  const resourceItems = lessonResources.map((resource) => {
    const progress = resourceProgressMap.get(resource.resourceId) || null;
    const completed = Boolean(progress?.completedAt);
    const started =
      completed ||
      Boolean(progress?.viewedAt) ||
      Number(progress?.lastWatchedSecond || 0) > 0 ||
      normalizeProgressStatus(progress?.status) === PROGRESS_STATUS_IN_PROGRESS;

    return {
      resourceId: resource.resourceId,
      title: resource.title,
      fileType: resource.fileType || "document",
      status: completed
        ? PROGRESS_STATUS_COMPLETED
        : started
          ? PROGRESS_STATUS_IN_PROGRESS
          : PROGRESS_STATUS_NOT_STARTED,
      viewedAt: progress?.viewedAt || null,
      completedAt: progress?.completedAt || null,
      lastWatchedSecond: progress?.lastWatchedSecond || 0,
    };
  });

  const passedQuiz = Boolean(
    quiz &&
    (quizAttempts || []).some(
      (attempt) =>
        Number(attempt.totalScore || 0) >= Number(quiz.passingScore || 0),
    ),
  );

  const requirements = [];
  if (hasContentRequirement) {
    requirements.push(Boolean(learningProgress?.contentViewedAt));
  }
  if (hasPrimaryVideoRequirement) {
    requirements.push(Boolean(learningProgress?.videoCompletedAt));
  }
  resourceItems.forEach((item) => requirements.push(Boolean(item.completedAt)));
  if (hasQuizRequirement) {
    requirements.push(passedQuiz);
  }
  if (hasAssignmentRequirement) {
    requirements.push(Boolean(latestAssignmentSubmission));
  }

  const hasTrackedRequirements = requirements.length > 0;
  const hasAnyActivity =
    normalizeProgressStatus(learningProgress?.status) ===
      PROGRESS_STATUS_IN_PROGRESS ||
    normalizeProgressStatus(learningProgress?.status) ===
      PROGRESS_STATUS_COMPLETED ||
    Boolean(learningProgress?.contentViewedAt) ||
    Boolean(learningProgress?.videoCompletedAt) ||
    Number(learningProgress?.lastWatchedSecond || 0) > 0 ||
    resourceItems.some((item) => item.status !== PROGRESS_STATUS_NOT_STARTED) ||
    (quizAttempts || []).length > 0 ||
    Boolean(latestAssignmentSubmission);

  let status = PROGRESS_STATUS_NOT_STARTED;
  if (hasTrackedRequirements) {
    status = requirements.every(Boolean)
      ? PROGRESS_STATUS_COMPLETED
      : hasAnyActivity
        ? PROGRESS_STATUS_IN_PROGRESS
        : PROGRESS_STATUS_NOT_STARTED;
  } else {
    status =
      normalizeProgressStatus(learningProgress?.status) ===
      PROGRESS_STATUS_COMPLETED
        ? PROGRESS_STATUS_COMPLETED
        : hasAnyActivity
          ? PROGRESS_STATUS_IN_PROGRESS
          : PROGRESS_STATUS_NOT_STARTED;
  }

  const completedAt =
    status === PROGRESS_STATUS_COMPLETED
      ? learningProgress?.completedAt || new Date()
      : null;

  return {
    status,
    completedAt,
    contentViewedAt: learningProgress?.contentViewedAt || null,
    videoCompletedAt: learningProgress?.videoCompletedAt || null,
    lastWatchedSecond: learningProgress?.lastWatchedSecond || 0,
    requirements: {
      hasContentRequirement,
      hasPrimaryVideoRequirement,
      hasQuizRequirement,
      hasAssignmentRequirement,
      totalResources: resourceItems.length,
      completedResources: resourceItems.filter(
        (item) => item.status === PROGRESS_STATUS_COMPLETED,
      ).length,
      quizPassed: passedQuiz,
    },
    resources: resourceItems,
    quiz: quiz
      ? {
          quizId: quiz.quizId,
          title: quiz.title || "Quiz",
          passingScore: quiz.passingScore,
          passed: passedQuiz,
          attemptsCount: (quizAttempts || []).length,
          bestScore: (quizAttempts || []).reduce(
            (max, attempt) => Math.max(max, Number(attempt.totalScore || 0)),
            0,
          ),
        }
      : null,
    assignment: assignment
      ? {
          assignmentId: assignment.assignmentId,
          title: assignment.title || lesson.title,
          instructions: assignment.instructions || "",
          submitted: Boolean(latestAssignmentSubmission),
          latestSubmission: latestAssignmentSubmission
            ? {
                submissionId: latestAssignmentSubmission.submissionId,
                submittedAt: latestAssignmentSubmission.submittedAt,
                grade: latestAssignmentSubmission.grade,
                feedback: latestAssignmentSubmission.feedback,
                status:
                  latestAssignmentSubmission.grade == null
                    ? "pending"
                    : "graded",
              }
            : null,
        }
      : null,
  };
}

function buildEnrollmentProgressSnapshot({
  enrollment,
  course,
  learningProgressRecords,
  resourceProgressRecords,
  quizAttempts,
  assignmentSubmissions,
}) {
  const learningProgressMap = new Map(
    (learningProgressRecords || []).map((record) => [record.lessonId, record]),
  );
  const resourceProgressMap = new Map(
    (resourceProgressRecords || []).map((record) => [
      record.resourceId,
      record,
    ]),
  );
  const attemptsByQuizId = new Map();
  (quizAttempts || []).forEach((attempt) => {
    const list = attemptsByQuizId.get(attempt.quizId) || [];
    list.push(attempt);
    attemptsByQuizId.set(attempt.quizId, list);
  });
  const submissionsByAssignmentId = new Map();
  (assignmentSubmissions || []).forEach((submission) => {
    const list = submissionsByAssignmentId.get(submission.assignmentId) || [];
    list.push(submission);
    submissionsByAssignmentId.set(submission.assignmentId, list);
  });

  const orderedModules = [...(course.modules || [])].sort(
    (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
  );
  const modules = orderedModules.map((module) => {
    const orderedLessons = [...(module.lessons || [])].sort(
      (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
    );
    const lessons = orderedLessons.map((lesson) => {
      const learningProgress = learningProgressMap.get(lesson.lessonId) || null;
      const lessonState = buildLessonProgressState({
        lesson,
        learningProgress,
        resourceProgressMap,
        quizAttempts: attemptsByQuizId.get(lesson.quizzes?.[0]?.quizId) || [],
        assignmentSubmissions:
          submissionsByAssignmentId.get(
            lesson.assignments?.[0]?.assignmentId,
          ) || [],
      });

      return {
        lessonId: lesson.lessonId,
        lessonTitle: lesson.title,
        lessonType: lesson.type,
        orderIndex: lesson.orderIndex || 0,
        status: lessonState.status,
        completedAt: lessonState.completedAt,
        lastWatchedSecond: lessonState.lastWatchedSecond,
        contentViewedAt: lessonState.contentViewedAt,
        videoCompletedAt: lessonState.videoCompletedAt,
        requirements: lessonState.requirements,
        resources: lessonState.resources,
        quiz: lessonState.quiz,
        assignment: lessonState.assignment,
      };
    });

    const completedLessons = lessons.filter(
      (lesson) => lesson.status === PROGRESS_STATUS_COMPLETED,
    ).length;
    const moduleStatus =
      lessons.length > 0 && completedLessons === lessons.length
        ? PROGRESS_STATUS_COMPLETED
        : lessons.some(
              (lesson) => lesson.status !== PROGRESS_STATUS_NOT_STARTED,
            )
          ? PROGRESS_STATUS_IN_PROGRESS
          : PROGRESS_STATUS_NOT_STARTED;

    return {
      moduleId: module.moduleId,
      moduleTitle: module.title,
      orderIndex: module.orderIndex || 0,
      status: moduleStatus,
      totalLessons: lessons.length,
      completedLessons,
      lessons,
    };
  });

  const flatLessons = modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      moduleId: module.moduleId,
      moduleTitle: module.moduleTitle,
      ...lesson,
    })),
  );

  const completedLessons = flatLessons.filter(
    (lesson) => lesson.status === PROGRESS_STATUS_COMPLETED,
  ).length;
  const totalLessons = flatLessons.length;
  const percentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const currentLesson =
    flatLessons.find((lesson) => lesson.status !== PROGRESS_STATUS_COMPLETED) ||
    null;
  const currentModule = currentLesson
    ? {
        moduleId: currentLesson.moduleId,
        moduleTitle: currentLesson.moduleTitle,
      }
    : null;

  return {
    courseId: course.courseId,
    courseTitle: course.title,
    enrollmentId: enrollment.enrollmentId,
    userId: enrollment.userId,
    totalLessons,
    completedLessons,
    percentage,
    currentModule,
    currentLesson: currentLesson
      ? {
          lessonId: currentLesson.lessonId,
          lessonTitle: currentLesson.lessonTitle,
          lessonType: currentLesson.lessonType,
          status: currentLesson.status,
        }
      : null,
    modules,
  };
}

module.exports = {
  buildEnrollmentProgressSnapshot,
  buildLessonProgressState,
  computeCourseProgress,
  isVideoResource,
  normalizeProgressStatus,
};
