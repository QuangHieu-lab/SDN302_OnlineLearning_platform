const prisma = require('../utils/prisma');
const { getLessonForInstructor, ensureQuizLessonAccess, ensureQuizAccess, getQuizForInstructor, sendAccessError } = require('../utils/access.helpers');
const { DEFAULT_PASSING_SCORE, DEFAULT_TIME_LIMIT_MINUTES } = require('../config/constants');
const { scoreQuizSubmission, buildQuestionResultsFromAttempt } = require('../utils/quiz.utils');
const { syncLessonProgressState } = require('./progress.controller');

const createQuiz = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { title, timeLimitMinutes, passingScore } = req.body;
    const userId = req.userId;

    const access = await getLessonForInstructor(lessonId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const lessonIdInt = access.lesson.lessonId;

    const quiz = await prisma.quiz.create({
      data: {
        lessonId: lessonIdInt,
        title: title || 'Quiz',
        timeLimitMinutes: timeLimitMinutes != null ? parseInt(timeLimitMinutes, 10) : DEFAULT_TIME_LIMIT_MINUTES,
        passingScore: passingScore != null ? parseInt(passingScore, 10) : DEFAULT_PASSING_SCORE,
      },
      include: {
        questions: {
          include: {
            questionAnswers: true,
          },
        },
      },
    });

    res.status(201).json(quiz);
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getQuizzes = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.userId;

    const access = await ensureQuizLessonAccess(lessonId, userId, { roles: req.userRoles || [] });
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const lessonIdInt = access.lesson.lessonId;

    const quizzes = await prisma.quiz.findMany({
      where: { lessonId: lessonIdInt },
      include: {
        _count: {
          select: {
            questions: true,
            quizAttempts: true,
          },
        },
      },
    });

    res.json(quizzes);
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const access = await ensureQuizAccess(quizId, userId, { roles: req.userRoles || [] });
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const quizIdInt = access.quiz.quizId;
    const courseId = access.quiz.lesson.module.course.courseId;
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const quiz = await prisma.quiz.findUnique({
      where: { quizId: quizIdInt },
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
        questions: {
          include: {
            questionAnswers: true,
          },
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    let enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: userIdNum,
          courseId,
        },
      },
    });

    let existingAttempt = null;
    if (enrollment) {
      existingAttempt = await prisma.quizAttempt.findFirst({
        where: {
          quizId: quizIdInt,
          enrollmentId: enrollment.enrollmentId,
        },
        orderBy: {
          startedAt: 'desc',
        },
      });
    }

    let questionResults = [];
    if (existingAttempt) {
      const attemptWithAnswers = await prisma.quizAttempt.findUnique({
        where: { attemptId: existingAttempt.attemptId },
        include: {
          quizAttemptAnswers: {
            include: {
              question: { include: { questionAnswers: true } },
              selectedAnswer: true,
            },
          },
        },
      });
      questionResults = buildQuestionResultsFromAttempt(quiz, attemptWithAnswers);
    }

    res.json({
      quiz,
      attempt: existingAttempt,
      questionResults,
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, timeLimitMinutes, passingScore } = req.body;
    const userId = req.userId;

    const access = await getQuizForInstructor(quizId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const quizIdInt = access.quiz.quizId;

    const updatedQuiz = await prisma.quiz.update({
      where: { quizId: quizIdInt },
      data: {
        title,
        timeLimitMinutes: timeLimitMinutes ? parseInt(timeLimitMinutes) : undefined,
        passingScore: passingScore ? parseInt(passingScore) : undefined,
      },
    });

    res.json(updatedQuiz);
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    const access = await getQuizForInstructor(quizId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }

    await prisma.quiz.delete({
      where: { quizId: access.quiz.quizId },
    });

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;
    const userId = req.userId;

    const access = await ensureQuizAccess(quizId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const quizFromAccess = access.quiz;
    const courseId = quizFromAccess.lesson.module.course.courseId;
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const quiz = await prisma.quiz.findUnique({
      where: { quizId: quizFromAccess.quizId },
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
        questions: {
          include: {
            questionAnswers: true,
          },
        },
      },
    });

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: userIdNum,
          courseId,
        },
      },
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'You must be enrolled in this course to take the quiz' });
    }

    const { correctCount, totalQuestions, questionResults, quizAttemptAnswers, score } = scoreQuizSubmission(quiz, answers || []);

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.quizId,
        enrollmentId: enrollment.enrollmentId,
        totalScore: score,
        completedAt: new Date(),
        quizAttemptAnswers: {
          create: quizAttemptAnswers,
        },
      },
      include: {
        quizAttemptAnswers: {
          include: {
            question: true,
            selectedAnswer: true,
          },
        },
      },
    });

    let syncedProgress = null;
    let certificate = null;
    try {
      const syncResult = await syncLessonProgressState({
        enrollment,
        lessonId: quiz.lessonId,
        userId: userIdNum,
      });
      syncedProgress = syncResult.snapshot;
      certificate = syncResult.certificate;
    } catch (syncError) {
      console.error('Sync quiz progress error:', syncError);
    }

    res.status(201).json({
      attempt,
      score,
      totalQuestions,
      correctCount,
      passed: score >= quiz.passingScore,
      questionResults,
      courseProgress: syncedProgress,
      certificateEarned: !!certificate,
      certificateData: certificate,
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  submitQuiz,
};
