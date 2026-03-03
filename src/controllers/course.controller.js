const prisma = require('../utils/prisma');
const { isValidStatusTransition, canSubmit } = require('../utils/courseStatus');
const { ensureCourseAccess, getCourseForInstructor, sendAccessError } = require('../utils/access.helpers');
const { mapPrismaError } = require('../utils/error.utils');
const { DEFAULT_COURSE_CATEGORY, DEFAULT_COURSE_LEVEL_TARGET, ENROLLMENT_STATUS_ACTIVE, COURSE_CATEGORIES, USER_LEVELS, COURSE_STATUSES } = require('../config/constants');

const createCourse = async (req, res) => {
  try {
    const { title, description, price, category, levelTarget } = req.body;
    const instructorId = req.userId;

    if (category != null && !COURSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${COURSE_CATEGORIES.join(', ')}` });
    }
    if (levelTarget != null && !USER_LEVELS.includes(levelTarget)) {
      return res.status(400).json({ error: `Invalid levelTarget. Must be one of: ${USER_LEVELS.join(', ')}` });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        price: price ? parseFloat(price) : 0,
        instructorId,
        category: category || DEFAULT_COURSE_CATEGORY,
        levelTarget: levelTarget || DEFAULT_COURSE_LEVEL_TARGET,
      },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: true,
      },
    });

    res.status(201).json(course);
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCourses = async (req, res) => {
  try {
    const userId = req.userId;
    const { enrolled, status } = req.query;

    if (enrolled === 'true' && !userId) {
      return res.status(401).json({ error: 'Login required to view enrolled courses' });
    }

    let courses;

    if (enrolled === 'true') {
      const enrollments = await prisma.enrollment.findMany({
        where: { userId },
        include: {
          course: {
            include: {
              instructor: {
                select: {
                  userId: true,
                  fullName: true,
                  email: true,
                },
              },
              modules: {
                include: {
                  _count: {
                    select: {
                      lessons: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      courses = enrollments
        .filter((e) => e.course && (!status || e.course.status === status))
        .map((e) => ({ ...e.course, isEnrolled: true }));
    } else {
      const whereClause = {};
      if (status) {
        if (!COURSE_STATUSES.includes(status)) {
          return res.status(400).json({ error: `Invalid status. Must be one of: ${COURSE_STATUSES.join(', ')}` });
        }
        whereClause.status = status;
      }

      courses = await prisma.course.findMany({
        where: whereClause,
        include: {
          instructor: {
            select: {
              userId: true,
              fullName: true,
              email: true,
            },
          },
          modules: {
            include: {
              _count: {
                select: {
                  lessons: true,
                },
              },
            },
          },
        },
      });

      // Add isEnrolled when user is authenticated (guest: skip)
      if (userId) {
        const enrollments = await prisma.enrollment.findMany({
          where: { userId },
          select: { courseId: true },
        });
        const enrolledIds = new Set(enrollments.map((e) => e.courseId));
        courses = courses.map((c) => ({
          ...c,
          isEnrolled: enrolledIds.has(c.courseId),
        }));
      }
    }

    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.userId;

    const access = await ensureCourseAccess(courseId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const courseIdInt = access.course.courseId;

    // Guest (no login): return preview only - course info, no lesson content
    const isGuest = !userId;

    const course = await prisma.course.findUnique({
      where: { courseId: courseIdInt },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: {
          orderBy: {
            orderIndex: 'asc',
          },
          include: {
            lessons: {
              orderBy: {
                orderIndex: 'asc',
              },
              include: {
                quizzes: {
                  select: {
                    quizId: true,
                    title: true,
                    timeLimitMinutes: true,
                    passingScore: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Guest: return preview only (no lesson content)
    if (isGuest) {
      const courseWithoutContent = {
        ...course,
        modules: course.modules.map(module => ({
          ...module,
          lessons: [],
        })),
        isEnrolled: false,
      };
      return res.json(courseWithoutContent);
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: courseIdInt,
        },
      },
    });

    const isEnrolled = !!enrollment;
    const isInstructor = course.instructorId === userId;
    const isPaidCourse = Number(course.price) > 0;

    if (isPaidCourse && !isEnrolled && !isInstructor) {
      const courseWithoutContent = {
        ...course,
        modules: course.modules.map((module) => ({
          ...module,
          lessons: [],
        })),
        isEnrolled: false,
      };
      return res.json(courseWithoutContent);
    }

    res.json({
      ...course,
      isEnrolled: isEnrolled || isInstructor,
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description } = req.body;
    const userId = req.userId;

    const access = await getCourseForInstructor(courseId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const courseIdInt = access.course.courseId;

    const updatedCourse = await prisma.course.update({
      where: { courseId: courseIdInt },
      data: {
        title,
        description,
      },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: true,
      },
    });

    res.json(updatedCourse);
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createModule = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, orderIndex } = req.body;
    const userId = req.userId;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Module title is required' });
    }

    const access = await getCourseForInstructor(courseId, userId, {
      include: { modules: { orderBy: { orderIndex: 'asc' } } },
    });
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const course = access.course;
    const courseIdInt = course.courseId;

    const nextOrderIndex =
      typeof orderIndex === 'number' && !isNaN(orderIndex)
        ? orderIndex
        : (course.modules.length > 0
            ? Math.max(...course.modules.map((m) => m.orderIndex)) + 1
            : 0);

    const module = await prisma.module.create({
      data: {
        courseId: courseIdInt,
        title: title.trim(),
        description: description && typeof description === 'string' ? description.trim() : null,
        orderIndex: nextOrderIndex,
      },
      include: {
        _count: { select: { lessons: true } },
      },
    });

    res.status(201).json(module);
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getCourseModules = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.userId;

    const courseIdInt = parseInt(courseId, 10);
    if (isNaN(courseIdInt)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const access = await ensureCourseAccess(courseId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const course = access.course;
    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const isInstructor = course.instructorId === userIdNum;
    if (!isInstructor) {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: { userId: userIdNum, courseId: course.courseId },
        },
      });
      if (!enrollment || enrollment.status !== ENROLLMENT_STATUS_ACTIVE) {
        return res.status(403).json({ error: 'Not authorized to view modules' });
      }
    }

    const modules = await prisma.module.findMany({
      where: { courseId: course.courseId },
      orderBy: { orderIndex: 'asc' },
      include: {
        _count: { select: { lessons: true } },
      },
    });

    res.json(modules);
  } catch (error) {
    console.error('Get course modules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.userId;

    const access = await getCourseForInstructor(courseId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }

    await prisma.course.delete({
      where: { courseId: access.course.courseId },
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.userId;

    const access = await ensureCourseAccess(courseId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const course = access.course;
    const courseIdInt = course.courseId;

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (course.instructorId === userIdNum) {
      return res.status(400).json({ error: 'Cannot enroll in your own course' });
    }

    if (Number(course.price) > 0) {
      return res.status(402).json({
        error: 'Payment required',
        message: 'This course requires payment. Please create a payment first.',
        courseId: course.courseId,
        price: course.price,
      });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: courseIdInt,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId: courseIdInt,
      },
      include: {
        course: {
          select: {
            courseId: true,
            title: true,
            description: true,
          },
        },
      },
    });

    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Enroll error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }
    const { status, message } = mapPrismaError(error);
    return res.status(status).json({ error: message });
  }
};
const getCoursesByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params; // Lấy ID từ trên URL
    const studentIdInt = parseInt(studentId);
    const userId = req.userId;
    const roles = req.userRoles || [];

    if (isNaN(studentIdInt)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (userIdNum !== studentIdInt && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Forbidden: you can only view your own enrolled courses' });
    }

    // Truy vấn bảng Enrollments (Bảng trung gian)
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: studentIdInt, // Tìm tất cả dòng có userId này
        status: ENROLLMENT_STATUS_ACTIVE,
      },
      orderBy: {
        enrolledAt: 'desc',   // Khóa nào mua gần nhất hiện lên đầu
      },
      include: {
        // KẾT NỐI SANG BẢNG COURSE ĐỂ LẤY THÔNG TIN
        course: {
          select: {
            courseId: true,
            title: true,
            thumbnailUrl: true,
            description: true,
            levelTarget: true,
            // Lấy thêm thông tin giảng viên để hiển thị đẹp
            instructor: {
              select: {
                fullName: true,
                avatarUrl: true
              }
            },
            // Đếm số lượng bài học (để FE hiển thị ví dụ: "12 Lessons")
            modules: {
              select: {
                _count: {
                  select: { lessons: true }
                }
              }
            }
          }
        }
      }
    });

    // Prisma trả về mảng enrollment chứa object course lồng bên trong.
    // Chúng ta cần làm phẳng (flatten) nó ra để FE dễ dùng.
    const purchasedCourses = enrollments.map((item) => ({
      ...item.course,         // Lấy thông tin khóa học ra ngoài
      enrolledAt: item.enrolledAt, // Kèm ngày mua
      expiryDate: item.expiryDate  // Kèm ngày hết hạn (nếu có)
    }));

    res.json(purchasedCourses);

  } catch (error) {
    console.error('Get student courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit course for review
const submitCourseForReview = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.userId;

    const access = await getCourseForInstructor(courseId, userId, {
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const course = access.course;
    const courseIdInt = course.courseId;

    // Validate submission requirements
    const submissionCheck = canSubmit(course);
    if (!submissionCheck.canSubmit) {
      return res.status(400).json({ error: submissionCheck.reason });
    }

    // Validate status transition
    if (!isValidStatusTransition(course.status, 'pending_review')) {
      return res.status(400).json({ 
        error: `Cannot submit course. Current status: ${course.status}. Only draft courses can be submitted.` 
      });
    }

    const updatedCourse = await prisma.course.update({
      where: { courseId: courseIdInt },
      data: {
        status: 'pending_review',
      },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: {
          include: {
            _count: {
              select: { lessons: true },
            },
          },
        },
      },
    });

    res.json(updatedCourse);
  } catch (error) {
    console.error('Submit course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Approve course
const approveCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const access = await ensureCourseAccess(courseId, req.userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const course = access.course;
    const courseIdInt = course.courseId;

    // Validate status transition
    if (!isValidStatusTransition(course.status, 'approved_upload')) {
      return res.status(400).json({ 
        error: `Cannot approve course. Current status: ${course.status}. Only pending_review courses can be approved.` 
      });
    }

    const updatedCourse = await prisma.course.update({
      where: { courseId: courseIdInt },
      data: {
        status: 'approved_upload',
        adminNote: null,
      },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: {
          include: {
            _count: {
              select: { lessons: true },
            },
          },
        },
      },
    });

    res.json(updatedCourse);
  } catch (error) {
    console.error('Approve course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject course
const rejectCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { adminNote } = req.body;

    if (!adminNote || adminNote.trim() === '') {
      return res.status(400).json({ error: 'Admin note (rejection reason) is required' });
    }

    const access = await ensureCourseAccess(courseId, req.userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const course = access.course;
    const courseIdInt = course.courseId;

    // Validate status transition
    if (!isValidStatusTransition(course.status, 'rejected')) {
      return res.status(400).json({ 
        error: `Cannot reject course. Current status: ${course.status}. Only pending_review courses can be rejected.` 
      });
    }

    const updatedCourse = await prisma.course.update({
      where: { courseId: courseIdInt },
      data: {
        status: 'rejected',
        adminNote: adminNote.trim(),
      },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: {
          include: {
            _count: {
              select: { lessons: true },
            },
          },
        },
      },
    });

    res.json(updatedCourse);
  } catch (error) {
    console.error('Reject course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Revise course (change from rejected back to draft)
const reviseCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.userId;

    const access = await getCourseForInstructor(courseId, userId);
    if (access.error) {
      return sendAccessError(res, access.error);
    }
    const course = access.course;
    const courseIdInt = course.courseId;

    // Validate status transition
    if (!isValidStatusTransition(course.status, 'draft')) {
      return res.status(400).json({ 
        error: `Cannot revise course. Current status: ${course.status}. Only rejected courses can be revised.` 
      });
    }

    const updatedCourse = await prisma.course.update({
      where: { courseId: courseIdInt },
      data: {
        status: 'draft',
        adminNote: null,
      },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: {
          include: {
            _count: {
              select: { lessons: true },
            },
          },
        },
      },
    });

    res.json(updatedCourse);
  } catch (error) {
    console.error('Revise course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get pending courses (admin only)
const getPendingCourses = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: {
        status: 'pending_review',
      },
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: {
          include: {
            _count: {
              select: { lessons: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(courses);
  } catch (error) {
    console.error('Get pending courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get courses by instructor with optional status filter
const getInstructorCourses = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const instructorIdInt = parseInt(instructorId);
    const { status } = req.query;

    if (isNaN(instructorIdInt)) {
      return res.status(400).json({ error: 'Invalid instructor ID' });
    }

    const whereClause = {
      instructorId: instructorIdInt,
    };

    if (status) {
      whereClause.status = status;
    }

    const courses = await prisma.course.findMany({
      where: whereClause,
      include: {
        instructor: {
          select: {
            userId: true,
            fullName: true,
            email: true,
          },
        },
        modules: {
          include: {
            _count: {
              select: { lessons: true },
            },
            lessons: {
              orderBy: { orderIndex: 'asc' },
              include: {
                quizzes: {
                  select: { quizId: true, title: true },
                },
                lessonResources: {
                  select: { resourceId: true, fileType: true, fileUrl: true, title: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(courses);
  } catch (error) {
    console.error('Get instructor courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
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
  approveCourse,
  rejectCourse,
  reviseCourse,
  getPendingCourses,
  getInstructorCourses,
};
