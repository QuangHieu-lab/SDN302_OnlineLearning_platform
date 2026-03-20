const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { buildEnrollmentProgressSnapshot } = require('../src/utils/progress.utils');

const prisma = new PrismaClient();

const SAMPLE_PDF_URL =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const SAMPLE_VIDEO_URLS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
];

const sampleQuestions10 = [
  {
    contentText: 'What is the capital of France?',
    questionAnswers: [
      { contentText: 'London', isCorrect: false, orderIndex: 0 },
      { contentText: 'Berlin', isCorrect: false, orderIndex: 1 },
      { contentText: 'Paris', isCorrect: true, orderIndex: 2 },
      { contentText: 'Madrid', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'Which programming language is used for web development?',
    questionAnswers: [
      { contentText: 'Python', isCorrect: false, orderIndex: 0 },
      { contentText: 'JavaScript', isCorrect: true, orderIndex: 1 },
      { contentText: 'C++', isCorrect: false, orderIndex: 2 },
      { contentText: 'Java', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What does HTML stand for?',
    questionAnswers: [
      { contentText: 'HyperText Markup Language', isCorrect: true, orderIndex: 0 },
      { contentText: 'High Tech Modern Language', isCorrect: false, orderIndex: 1 },
      { contentText: 'Home Tool Markup Language', isCorrect: false, orderIndex: 2 },
      { contentText: 'Hyperlink and Text Markup Language', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What is the result of 2 + 2?',
    questionAnswers: [
      { contentText: '3', isCorrect: false, orderIndex: 0 },
      { contentText: '4', isCorrect: true, orderIndex: 1 },
      { contentText: '5', isCorrect: false, orderIndex: 2 },
      { contentText: '6', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'Which of the following is a database management system?',
    questionAnswers: [
      { contentText: 'MySQL', isCorrect: true, orderIndex: 0 },
      { contentText: 'HTML', isCorrect: false, orderIndex: 1 },
      { contentText: 'CSS', isCorrect: false, orderIndex: 2 },
      { contentText: 'JavaScript', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What is the main purpose of CSS?',
    questionAnswers: [
      { contentText: 'To structure web pages', isCorrect: false, orderIndex: 0 },
      { contentText: 'To style web pages', isCorrect: true, orderIndex: 1 },
      { contentText: 'To add interactivity', isCorrect: false, orderIndex: 2 },
      { contentText: 'To store data', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'Which HTTP method is used to retrieve data?',
    questionAnswers: [
      { contentText: 'POST', isCorrect: false, orderIndex: 0 },
      { contentText: 'PUT', isCorrect: false, orderIndex: 1 },
      { contentText: 'GET', isCorrect: true, orderIndex: 2 },
      { contentText: 'DELETE', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What is React?',
    questionAnswers: [
      { contentText: 'A database', isCorrect: false, orderIndex: 0 },
      { contentText: 'A JavaScript library for building user interfaces', isCorrect: true, orderIndex: 1 },
      { contentText: 'A programming language', isCorrect: false, orderIndex: 2 },
      { contentText: 'A web server', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What does API stand for?',
    questionAnswers: [
      { contentText: 'Application Programming Interface', isCorrect: true, orderIndex: 0 },
      { contentText: 'Advanced Programming Interface', isCorrect: false, orderIndex: 1 },
      { contentText: 'Application Program Integration', isCorrect: false, orderIndex: 2 },
      { contentText: 'Automated Programming Interface', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'Which of the following is a version control system?',
    questionAnswers: [
      { contentText: 'Git', isCorrect: true, orderIndex: 0 },
      { contentText: 'Java', isCorrect: false, orderIndex: 1 },
      { contentText: 'Python', isCorrect: false, orderIndex: 2 },
      { contentText: 'HTML', isCorrect: false, orderIndex: 3 },
    ],
  },
];

const ieltsListeningQuestions = [
  {
    contentText: 'In IELTS Listening, how many sections are there?',
    questionAnswers: [
      { contentText: '2 sections', isCorrect: false, orderIndex: 0 },
      { contentText: '3 sections', isCorrect: false, orderIndex: 1 },
      { contentText: '4 sections', isCorrect: true, orderIndex: 2 },
      { contentText: '5 sections', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What is the best strategy for IELTS Listening?',
    questionAnswers: [
      { contentText: 'Read all questions before listening', isCorrect: true, orderIndex: 0 },
      { contentText: 'Listen first, then read questions', isCorrect: false, orderIndex: 1 },
      { contentText: 'Skip difficult questions', isCorrect: false, orderIndex: 2 },
      { contentText: 'Only focus on keywords', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'How long is the IELTS Listening test?',
    questionAnswers: [
      { contentText: '30 minutes', isCorrect: true, orderIndex: 0 },
      { contentText: '40 minutes', isCorrect: false, orderIndex: 1 },
      { contentText: '50 minutes', isCorrect: false, orderIndex: 2 },
      { contentText: '60 minutes', isCorrect: false, orderIndex: 3 },
    ],
  },
];

const ieltsReadingQuestions = [
  {
    contentText: 'How many passages are in IELTS Academic Reading?',
    questionAnswers: [
      { contentText: '2 passages', isCorrect: false, orderIndex: 0 },
      { contentText: '3 passages', isCorrect: true, orderIndex: 1 },
      { contentText: '4 passages', isCorrect: false, orderIndex: 2 },
      { contentText: '5 passages', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What is the time limit for IELTS Reading?',
    questionAnswers: [
      { contentText: '50 minutes', isCorrect: false, orderIndex: 0 },
      { contentText: '60 minutes', isCorrect: true, orderIndex: 1 },
      { contentText: '70 minutes', isCorrect: false, orderIndex: 2 },
      { contentText: '80 minutes', isCorrect: false, orderIndex: 3 },
    ],
  },
];

const ieltsWritingQuestions = [
  {
    contentText: 'How many tasks are in IELTS Writing test?',
    questionAnswers: [
      { contentText: '1 task', isCorrect: false, orderIndex: 0 },
      { contentText: '2 tasks', isCorrect: true, orderIndex: 1 },
      { contentText: '3 tasks', isCorrect: false, orderIndex: 2 },
      { contentText: '4 tasks', isCorrect: false, orderIndex: 3 },
    ],
  },
  {
    contentText: 'What is the minimum word count for Task 1?',
    questionAnswers: [
      { contentText: '100 words', isCorrect: false, orderIndex: 0 },
      { contentText: '150 words', isCorrect: true, orderIndex: 1 },
      { contentText: '200 words', isCorrect: false, orderIndex: 2 },
      { contentText: '250 words', isCorrect: false, orderIndex: 3 },
    ],
  },
];

async function createQuizWithQuestions(lessonId, title, timeLimitMinutes, passingScore, questions) {
  const quiz = await prisma.quiz.create({
    data: {
      lessonId,
      title,
      timeLimitMinutes,
      passingScore,
    },
  });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await prisma.question.create({
      data: {
        quizId: quiz.quizId,
        contentText: q.contentText,
        type: 'single_choice',
        orderIndex: i,
        questionAnswers: {
          create: q.questionAnswers,
        },
      },
    });
  }

  return quiz;
}

async function markContentViewed(enrollmentId, lessonId, viewedAt = new Date()) {
  return prisma.learningProgress.upsert({
    where: {
      enrollmentId_lessonId: { enrollmentId, lessonId },
    },
    update: {
      status: 'in_progress',
      contentViewedAt: viewedAt,
    },
    create: {
      enrollmentId,
      lessonId,
      status: 'in_progress',
      contentViewedAt: viewedAt,
    },
  });
}

async function completePrimaryVideo(enrollmentId, lesson, completedAt = new Date()) {
  return prisma.learningProgress.upsert({
    where: {
      enrollmentId_lessonId: { enrollmentId, lessonId: lesson.lessonId },
    },
    update: {
      status: 'in_progress',
      lastWatchedSecond: lesson.durationSeconds || 0,
      videoCompletedAt: completedAt,
    },
    create: {
      enrollmentId,
      lessonId: lesson.lessonId,
      status: 'in_progress',
      lastWatchedSecond: lesson.durationSeconds || 0,
      videoCompletedAt: completedAt,
    },
  });
}

async function completeLessonResource(enrollmentId, resourceId, completedAt = new Date()) {
  return prisma.lessonResourceProgress.upsert({
    where: {
      enrollmentId_resourceId: { enrollmentId, resourceId },
    },
    update: {
      status: 'completed',
      viewedAt: completedAt,
      completedAt,
    },
    create: {
      enrollmentId,
      resourceId,
      status: 'completed',
      viewedAt: completedAt,
      completedAt,
    },
  });
}

async function seedQuizAttempt(enrollmentId, quizId, totalScore, completedAt = new Date()) {
  // Only used by seed to mark quiz lesson as completed/in-progress in progress snapshot.
  return prisma.quizAttempt.create({
    data: {
      enrollmentId,
      quizId,
      totalScore,
      startedAt: new Date(),
      completedAt,
    },
  });
}

async function seedAssignmentSubmission(enrollmentId, assignmentId, { submittedAt = new Date(), grade = null, feedback = null } = {}) {
  // Only used by seed to mark assignment lesson as completed in progress snapshot.
  return prisma.assignmentSubmission.create({
    data: {
      enrollmentId,
      assignmentId,
      submittedAt,
      grade,
      feedback,
    },
  });
}

async function refreshEnrollmentPercentFromSnapshot(enrollmentId, courseId) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { enrollmentId },
    include: { learningProgress: true },
  });
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
              quizzes: { select: { quizId: true, title: true, passingScore: true } },
              assignments: {
                select: { assignmentId: true, title: true, instructions: true },
              },
            },
          },
        },
      },
    },
  });
  if (!enrollment || !course) return;

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.lessonId));
  const resourceIds = course.modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.lessonResources.map((r) => r.resourceId)),
  );
  const quizIds = course.modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.quizzes.map((q) => q.quizId)),
  );
  const assignmentIds = course.modules.flatMap((m) =>
    m.lessons.flatMap((l) => l.assignments.map((a) => a.assignmentId)),
  );

  const [learningProgressRecords, resourceProgressRecords, quizAttempts, assignmentSubmissions] =
    await Promise.all([
      prisma.learningProgress.findMany({
        where: {
          enrollmentId,
          lessonId: { in: lessonIds.length > 0 ? lessonIds : [-1] },
        },
      }),
      prisma.lessonResourceProgress.findMany({
        where: {
          enrollmentId,
          resourceId: { in: resourceIds.length > 0 ? resourceIds : [-1] },
        },
      }),
      prisma.quizAttempt.findMany({
        where: {
          enrollmentId,
          quizId: { in: quizIds.length > 0 ? quizIds : [-1] },
        },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.assignmentSubmission.findMany({
        where: {
          enrollmentId,
          assignmentId: { in: assignmentIds.length > 0 ? assignmentIds : [-1] },
        },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

  const snapshot = buildEnrollmentProgressSnapshot({
    enrollment,
    course,
    learningProgressRecords,
    resourceProgressRecords,
    quizAttempts,
    assignmentSubmissions,
  });

  await prisma.enrollment.update({
    where: { enrollmentId },
    data: { progressPercent: snapshot.percentage },
  });
}

async function main() {
  console.log('🌱 Seeding database...\n');

  const hashedPassword = await bcrypt.hash('password123', 10);

  console.log('📋 Creating roles...');
  const studentRole = await prisma.role.upsert({
    where: { roleName: 'student' },
    update: {},
    create: {
      roleName: 'student',
      description: 'Học viên',
    },
  });

  const instructorRole = await prisma.role.upsert({
    where: { roleName: 'instructor' },
    update: {},
    create: {
      roleName: 'instructor',
      description: 'Giảng viên',
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { roleName: 'admin' },
    update: {},
    create: {
      roleName: 'admin',
      description: 'Quản trị viên',
    },
  });
  console.log('✅ Roles created\n');

  console.log('👥 Creating users...');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      fullName: 'Admin User',
      currentLevel: 'C2',
      userRoles: {
        create: {
          roleId: adminRole.roleId,
        },
      },
    },
  });
  console.log('  ✅ Admin:', admin.email);

  const lecturer1 = await prisma.user.upsert({
    where: { email: 'lecturer@example.com' },
    update: {},
    create: {
      email: 'lecturer@example.com',
      passwordHash: hashedPassword,
      fullName: 'Nguyễn Văn Giảng',
      currentLevel: 'C2',
      userRoles: {
        create: {
          roleId: instructorRole.roleId,
        },
      },
    },
  });
  console.log('  ✅ Instructor 1:', lecturer1.email);

  const lecturer2 = await prisma.user.upsert({
    where: { email: 'teacher2@example.com' },
    update: {},
    create: {
      email: 'teacher2@example.com',
      passwordHash: hashedPassword,
      fullName: 'Trần Thị Hương',
      currentLevel: 'C1',
      userRoles: {
        create: {
          roleId: instructorRole.roleId,
        },
      },
    },
  });
  console.log('  ✅ Instructor 2:', lecturer2.email);

  const student1 = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      passwordHash: hashedPassword,
      fullName: 'Lê Văn Học',
      currentLevel: 'A1',
      userRoles: {
        create: {
          roleId: studentRole.roleId,
        },
      },
    },
  });
  console.log('  ✅ Student 1:', student1.email);

  const student2 = await prisma.user.upsert({
    where: { email: 'student2@example.com' },
    update: {},
    create: {
      email: 'student2@example.com',
      passwordHash: hashedPassword,
      fullName: 'Phạm Thị Mai',
      currentLevel: 'B1',
      userRoles: {
        create: {
          roleId: studentRole.roleId,
        },
      },
    },
  });
  console.log('  ✅ Student 2:', student2.email);

  const student3 = await prisma.user.upsert({
    where: { email: 'student3@example.com' },
    update: {},
    create: {
      email: 'student3@example.com',
      passwordHash: hashedPassword,
      fullName: 'Hoàng Văn Nam',
      currentLevel: 'A2',
      userRoles: {
        create: {
          roleId: studentRole.roleId,
        },
      },
    },
  });
  console.log('  ✅ Student 3:', student3.email);

  const instructorBlueprints = [
    { email: 'instructor3@example.com', fullName: 'Lâm Minh Đức', currentLevel: 'C1' },
    { email: 'instructor4@example.com', fullName: 'Đỗ Quỳnh Anh', currentLevel: 'C2' },
    { email: 'instructor5@example.com', fullName: 'Phan Gia Bảo', currentLevel: 'C1' },
    { email: 'instructor6@example.com', fullName: 'Trịnh Bảo Châu', currentLevel: 'B2' },
    { email: 'instructor7@example.com', fullName: 'Vũ Quang Huy', currentLevel: 'C1' },
  ];
  const createdExtraInstructors = [];
  for (const item of instructorBlueprints) {
    const instructor = await prisma.user.upsert({
      where: { email: item.email },
      update: {},
      create: {
        email: item.email,
        passwordHash: hashedPassword,
        fullName: item.fullName,
        currentLevel: item.currentLevel,
        userRoles: { create: { roleId: instructorRole.roleId } },
      },
    });
    createdExtraInstructors.push(instructor);
    console.log('  ✅ Extra instructor:', instructor.email);
  }

  const studentBlueprints = [
    { email: 'student4@example.com', fullName: 'Nguyễn Quốc An', currentLevel: 'A2' },
    { email: 'student5@example.com', fullName: 'Trần Mỹ Linh', currentLevel: 'B1' },
    { email: 'student6@example.com', fullName: 'Bùi Hoàng Phúc', currentLevel: 'B2' },
    { email: 'student7@example.com', fullName: 'Võ Thảo Nhi', currentLevel: 'A1' },
    { email: 'student8@example.com', fullName: 'Đặng Minh Khoa', currentLevel: 'B1' },
    { email: 'student9@example.com', fullName: 'Phạm Gia Hân', currentLevel: 'A2' },
    { email: 'student10@example.com', fullName: 'Lý Thành Nam', currentLevel: 'B2' },
    { email: 'student11@example.com', fullName: 'Ngô Thảo Vy', currentLevel: 'A1' },
    { email: 'student12@example.com', fullName: 'Đinh Hải Long', currentLevel: 'B1' },
    { email: 'student13@example.com', fullName: 'Tạ Minh Trí', currentLevel: 'B2' },
    { email: 'student14@example.com', fullName: 'Trương Nhật Lan', currentLevel: 'A2' },
    { email: 'student15@example.com', fullName: 'Lương Gia Huy', currentLevel: 'B1' },
    { email: 'student16@example.com', fullName: 'Mai Hà Phương', currentLevel: 'A2' },
    { email: 'student17@example.com', fullName: 'Phùng Đức Minh', currentLevel: 'B2' },
    { email: 'student18@example.com', fullName: 'Hoàng Bảo Ngọc', currentLevel: 'A1' },
    { email: 'student19@example.com', fullName: 'Châu Anh Khoa', currentLevel: 'B1' },
    { email: 'student20@example.com', fullName: 'Đỗ Thùy Dương', currentLevel: 'B2' },
    { email: 'student21@example.com', fullName: 'Vương Thành Tín', currentLevel: 'A2' },
    { email: 'student22@example.com', fullName: 'Lê Gia Bảo', currentLevel: 'B1' },
    { email: 'student23@example.com', fullName: 'Hà Minh Quân', currentLevel: 'A2' },
  ];
  const createdExtraStudents = [];
  for (const item of studentBlueprints) {
    const student = await prisma.user.upsert({
      where: { email: item.email },
      update: {},
      create: {
        email: item.email,
        passwordHash: hashedPassword,
        fullName: item.fullName,
        currentLevel: item.currentLevel,
        userRoles: { create: { roleId: studentRole.roleId } },
      },
    });
    createdExtraStudents.push(student);
    console.log('  ✅ Extra student:', student.email);
  }
  console.log('');

  console.log('📚 Creating FREE courses...');

  const freeCourse1 = await prisma.course.create({
    data: {
      title: 'Introduction to Web Development',
      description: 'Learn the fundamentals of web development including HTML, CSS, JavaScript, and modern frameworks.',
      price: 0,
      instructorId: lecturer1.userId,
      category: 'Communication',
      levelTarget: 'A1',
      status: 'published',
      modules: {
        create: [
          {
            title: 'Module 1: HTML Fundamentals',
            description: 'Learn the basics of HTML structure and tags',
            orderIndex: 0,
            lessons: {
              create: [
                { title: 'Introduction to HTML', type: 'video', orderIndex: 1, contentText: 'HTML is the foundation of web development.' },
                { title: 'HTML Forms and Input', type: 'video', orderIndex: 2, contentText: 'Create interactive forms with various input types.' },
              ],
            },
          },
          {
            title: 'Module 2: CSS Styling',
            description: 'Master CSS to style your web pages',
            orderIndex: 1,
            lessons: {
              create: [
                { title: 'CSS Basics', type: 'video', orderIndex: 1, contentText: 'Learn about selectors, properties, and values.' },
                { title: 'CSS Layouts', type: 'video', orderIndex: 2, contentText: 'Flexbox and Grid for modern layouts.' },
              ],
            },
          },
          {
            title: 'Module 3: JavaScript Basics',
            description: 'Add interactivity with JavaScript',
            orderIndex: 2,
            lessons: {
              create: [
                { title: 'JavaScript Fundamentals', type: 'video', orderIndex: 1, contentText: 'Variables, functions, and control structures.' },
                { title: 'DOM Manipulation', type: 'video', orderIndex: 2, contentText: 'Interact with HTML elements using JavaScript.' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('  ✅ FREE Course 1:', freeCourse1.title);

  const freeCourse2 = await prisma.course.create({
    data: {
      title: 'English Grammar Basics',
      description: 'Master the fundamentals of English grammar.',
      price: 0,
      instructorId: lecturer2.userId,
      category: 'Grammar',
      levelTarget: 'A0',
      status: 'published',
      modules: {
        create: [
          {
            title: 'Module 1: Parts of Speech',
            description: 'Learn about nouns, verbs, adjectives, and more',
            orderIndex: 0,
            lessons: {
              create: [
                { title: 'Nouns and Pronouns', type: 'video', orderIndex: 1, contentText: 'Understanding nouns and how to use pronouns correctly.' },
                { title: 'Verbs and Tenses', type: 'video', orderIndex: 2, contentText: 'Master verb forms and basic tenses.' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('  ✅ FREE Course 2:', freeCourse2.title);
  console.log('');

  console.log('💰 Creating PAID courses...');

  const paidCourse1 = await prisma.course.create({
    data: {
      title: 'Advanced English Course - IELTS Preparation',
      description: 'Comprehensive IELTS preparation course with practice tests.',
      price: 500000,
      instructorId: lecturer1.userId,
      category: 'IELTS',
      levelTarget: 'B2',
      status: 'published',
      modules: {
        create: [
          {
            title: 'Module 1: IELTS Listening',
            description: 'Master IELTS Listening skills',
            orderIndex: 0,
            lessons: {
              create: [
                {
                  title: 'IELTS Listening Fundamentals',
                  type: 'video',
                  orderIndex: 1,
                  mediaUrl: SAMPLE_VIDEO_URLS[0],
                  durationSeconds: 596,
                  contentText: 'Learn the structure and strategies for IELTS Listening test.',
                  lessonResources: {
                    create: [
                      { title: 'Listening handout (PDF)', fileUrl: SAMPLE_PDF_URL, fileType: 'pdf' },
                      { title: 'Supplementary listening clip', fileUrl: SAMPLE_VIDEO_URLS[1], fileType: 'video' },
                    ],
                  },
                },
                { title: 'Practice Test 1', type: 'quiz', orderIndex: 2, contentText: 'Complete a full IELTS Listening practice test.' },
              ],
            },
          },
          {
            title: 'Module 2: IELTS Reading',
            description: 'IELTS Reading strategies',
            orderIndex: 1,
            lessons: {
              create: [
                {
                  title: 'IELTS Reading Strategies',
                  type: 'video',
                  orderIndex: 1,
                  mediaUrl: SAMPLE_VIDEO_URLS[2],
                  durationSeconds: 887,
                  contentText: 'Learn how to read efficiently and answer questions accurately.',
                  lessonResources: {
                    create: [{ title: 'Reading skills checklist', fileUrl: SAMPLE_PDF_URL, fileType: 'pdf' }],
                  },
                },
                { title: 'Practice Test 2', type: 'quiz', orderIndex: 2, contentText: 'Complete a full IELTS Reading practice test.' },
              ],
            },
          },
          {
            title: 'Module 3: IELTS Writing',
            description: 'IELTS Writing Task 1 & 2',
            orderIndex: 2,
            lessons: {
              create: [
                { title: 'IELTS Writing Task 1 & 2', type: 'video', orderIndex: 1, contentText: 'Master both writing tasks with detailed examples.' },
                { title: 'Writing Practice', type: 'assignment', orderIndex: 2, contentText: 'Submit your writing for expert feedback.' },
              ],
            },
          },
          {
            title: 'Module 4: IELTS Speaking',
            description: 'IELTS Speaking Practice',
            orderIndex: 3,
            lessons: {
              create: [
                { title: 'IELTS Speaking Practice', type: 'assignment', orderIndex: 1, contentText: 'Practice speaking with AI tutor and get feedback.' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('  ✅ PAID Course 1:', paidCourse1.title, `(${paidCourse1.price.toLocaleString('vi-VN')} VND)`);

  const paidCourse2 = await prisma.course.create({
    data: {
      title: 'TOEIC Preparation Course',
      description: 'Complete TOEIC preparation course covering all sections.',
      price: 300000,
      instructorId: lecturer2.userId,
      category: 'TOEIC',
      levelTarget: 'B1',
      status: 'published',
      modules: {
        create: [
          {
            title: 'Module 1: Listening Comprehension',
            description: 'Master TOEIC Listening section',
            orderIndex: 0,
            lessons: {
              create: [
                { title: 'Part 1: Photos', type: 'video', orderIndex: 1, contentText: 'Learn strategies for photo description questions.' },
                { title: 'Part 2: Question-Response', type: 'video', orderIndex: 2, contentText: 'Master question-response patterns.' },
              ],
            },
          },
          {
            title: 'Module 2: Reading Comprehension',
            description: 'TOEIC Reading strategies',
            orderIndex: 1,
            lessons: {
              create: [
                { title: 'Part 5: Incomplete Sentences', type: 'video', orderIndex: 1, contentText: 'Grammar and vocabulary for sentence completion.' },
                { title: 'Part 6: Text Completion', type: 'video', orderIndex: 2, contentText: 'Reading comprehension and context clues.' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('  ✅ PAID Course 2:', paidCourse2.title, `(${paidCourse2.price.toLocaleString('vi-VN')} VND)`);

  const paidCourse3 = await prisma.course.create({
    data: {
      title: 'Business English Communication',
      description: 'Professional English communication skills for the workplace.',
      price: 400000,
      instructorId: lecturer1.userId,
      category: 'Business',
      levelTarget: 'B2',
      status: 'published',
      modules: {
        create: [
          {
            title: 'Module 1: Business Writing',
            description: 'Professional email and report writing',
            orderIndex: 0,
            lessons: {
              create: [
                { title: 'Email Etiquette', type: 'video', orderIndex: 1, contentText: 'Learn how to write professional emails.' },
                { title: 'Business Reports', type: 'video', orderIndex: 2, contentText: 'Structure and write effective business reports.' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log('  ✅ PAID Course 3:', paidCourse3.title, `(${paidCourse3.price.toLocaleString('vi-VN')} VND)`);

  const instructorPool = [lecturer1, lecturer2, ...createdExtraInstructors];
  const extraCourseBlueprints = [
    {
      title: 'Public Speaking Fundamentals',
      description: 'Build confidence and structure for public presentations.',
      price: 0,
      category: 'Communication',
      levelTarget: 'A2',
      modules: [
        {
          title: 'Module 1: Speaking Basics',
          lessons: [
            { title: 'Voice and Pronunciation', type: 'video', contentText: 'Control pace, tone, and clarity.' },
            { title: 'Body Language Essentials', type: 'video', contentText: 'Use gesture and posture effectively.' },
          ],
        },
      ],
    },
    {
      title: 'English for Customer Support',
      description: 'Practical English for customer-facing conversations.',
      price: 200000,
      category: 'Business',
      levelTarget: 'B1',
      modules: [
        {
          title: 'Module 1: Call Handling',
          lessons: [
            { title: 'Greeting and Verification', type: 'video', contentText: 'Open calls professionally.' },
            { title: 'Handling Complaints', type: 'video', contentText: 'De-escalation and empathy scripts.' },
          ],
        },
        {
          title: 'Module 2: Email Follow-up',
          lessons: [
            { title: 'Support Email Templates', type: 'video', contentText: 'Write concise support emails.' },
            { title: 'Case Summary Assignment', type: 'assignment', contentText: 'Submit a sample case summary.' },
          ],
        },
      ],
    },
    {
      title: 'Academic Writing Essentials',
      description: 'Develop formal writing for academic contexts.',
      price: 250000,
      category: 'Communication',
      levelTarget: 'B2',
      modules: [
        {
          title: 'Module 1: Essay Structure',
          lessons: [
            { title: 'Introduction and Thesis', type: 'video', contentText: 'Craft strong thesis statements.' },
            { title: 'Body Paragraph Logic', type: 'video', contentText: 'Build coherent argument flow.' },
          ],
        },
      ],
    },
    {
      title: 'English Interview Preparation',
      description: 'Prepare for common interview scenarios in English.',
      price: 300000,
      category: 'Business',
      levelTarget: 'B1',
      modules: [
        {
          title: 'Module 1: Interview Core',
          lessons: [
            { title: 'Tell Me About Yourself', type: 'video', contentText: 'Structure concise self-introductions.' },
            { title: 'Behavioral Questions', type: 'video', contentText: 'Use STAR technique in English.' },
          ],
        },
      ],
    },
    {
      title: 'TOEFL Reading and Writing',
      description: 'Integrated TOEFL preparation for reading and writing sections.',
      price: 350000,
      category: 'IELTS',
      levelTarget: 'B2',
      modules: [
        {
          title: 'Module 1: Reading Skills',
          lessons: [
            { title: 'Skimming and Scanning', type: 'video', contentText: 'Improve reading speed and accuracy.' },
            { title: 'Inference Questions', type: 'quiz', contentText: 'Practice inference and purpose questions.' },
          ],
        },
        {
          title: 'Module 2: Writing Response',
          lessons: [
            { title: 'Integrated Writing Task', type: 'assignment', contentText: 'Submit one integrated writing response.' },
          ],
        },
      ],
    },
    {
      title: 'Presentation Slide Writing',
      description: 'Create clear and persuasive English presentation slides.',
      price: 180000,
      category: 'Business',
      levelTarget: 'B1',
      modules: [
        {
          title: 'Module 1: Slide Structure',
          lessons: [
            { title: 'Headline and Message', type: 'video', contentText: 'Write concise slide headlines.' },
            { title: 'Slide Deck Assignment', type: 'assignment', contentText: 'Submit a 5-slide outline.' },
          ],
        },
      ],
    },
    {
      title: 'Grammar for Workplace Writing',
      description: 'Target common grammar mistakes in professional writing.',
      price: 0,
      category: 'Grammar',
      levelTarget: 'A2',
      modules: [
        {
          title: 'Module 1: Core Grammar',
          lessons: [
            { title: 'Sentence Consistency', type: 'video', contentText: 'Keep tense and subject agreement consistent.' },
            { title: 'Proofreading Quiz', type: 'quiz', contentText: 'Identify grammar errors in context.' },
          ],
        },
      ],
    },
    {
      title: 'English Negotiation Basics',
      description: 'Learn practical language for negotiation meetings.',
      price: 280000,
      category: 'Business',
      levelTarget: 'B2',
      modules: [
        {
          title: 'Module 1: Negotiation Language',
          lessons: [
            { title: 'Opening and Positioning', type: 'video', contentText: 'Set targets and open discussions.' },
            { title: 'Counteroffer Practice', type: 'assignment', contentText: 'Submit a written counteroffer response.' },
          ],
        },
      ],
    },
    {
      title: 'Email Writing for Teams',
      description: 'Write clearer internal and external team communication.',
      price: 150000,
      category: 'Communication',
      levelTarget: 'A2',
      modules: [
        {
          title: 'Module 1: Internal Communication',
          lessons: [
            { title: 'Status Update Emails', type: 'video', contentText: 'Write concise status updates.' },
            { title: 'Follow-up Assignment', type: 'assignment', contentText: 'Submit one follow-up email draft.' },
          ],
        },
      ],
    },
    {
      title: 'TOEIC Intensive Mock Tests',
      description: 'Practice full-length TOEIC-style sections.',
      price: 320000,
      category: 'TOEIC',
      levelTarget: 'B2',
      modules: [
        {
          title: 'Module 1: Timed Practice',
          lessons: [
            { title: 'Listening Speed Drill', type: 'video', contentText: 'Train under timed conditions.' },
            { title: 'Mock Test Quiz', type: 'quiz', contentText: 'Complete a mini mock test.' },
          ],
        },
      ],
    },
    {
      title: 'English Writing Clinic',
      description: 'Focused practice for sentence and paragraph quality.',
      price: 220000,
      category: 'Communication',
      levelTarget: 'B1',
      modules: [
        {
          title: 'Module 1: Clarity and Coherence',
          lessons: [
            { title: 'Paragraph Coherence', type: 'video', contentText: 'Link ideas smoothly.' },
            { title: 'Rewrite Assignment', type: 'assignment', contentText: 'Rewrite a weak paragraph into a strong one.' },
          ],
        },
      ],
    },
    {
      title: 'Cross-cultural Communication',
      description: 'Improve communication across international teams.',
      price: 0,
      category: 'Communication',
      levelTarget: 'A2',
      modules: [
        {
          title: 'Module 1: Communication Context',
          lessons: [
            { title: 'Tone and Politeness', type: 'video', contentText: 'Adapt tone for audience and culture.' },
            { title: 'Scenario Assignment', type: 'assignment', contentText: 'Respond to a cross-cultural scenario.' },
          ],
        },
      ],
    },
  ];

  const createdExtraCourses = [];
  for (let i = 0; i < extraCourseBlueprints.length; i++) {
    const bp = extraCourseBlueprints[i];
    const instructor = instructorPool[i % instructorPool.length];
    const course = await prisma.course.create({
      data: {
        title: bp.title,
        description: bp.description,
        price: bp.price,
        instructorId: instructor.userId,
        category: bp.category,
        levelTarget: bp.levelTarget,
        status: 'published',
        modules: {
          create: bp.modules.map((m, moduleIdx) => ({
            title: m.title,
            description: `${m.title} overview`,
            orderIndex: moduleIdx,
            lessons: {
              create: m.lessons.map((l, lessonIdx) => ({
                title: l.title,
                type: l.type,
                orderIndex: lessonIdx + 1,
                contentText: l.contentText,
              })),
            },
          })),
        },
      },
    });
    createdExtraCourses.push(course);
    console.log(`  ✅ EXTRA Course ${i + 1}:`, course.title, `(${course.price.toLocaleString('vi-VN')} VND)`);
  }
  console.log('');

  console.log('📝 Creating quizzes...');

  const freeCourse1Modules = await prisma.module.findMany({
    where: { courseId: freeCourse1.courseId },
    include: { lessons: true },
  });
  const freeCourse1Lessons = freeCourse1Modules.flatMap((m) => m.lessons);

  if (freeCourse1Lessons.length > 0) {
    const quiz1 = await createQuizWithQuestions(
      freeCourse1Lessons[0].lessonId,
      'HTML Basics Quiz',
      10,
      70,
      sampleQuestions10.slice(0, 5)
    );
    console.log('  ✅ Quiz:', quiz1.title, `(${5} questions)`);
  }

  const paidCourse1Modules = await prisma.module.findMany({
    where: { courseId: paidCourse1.courseId },
    include: { lessons: true },
  });
  const paidCourse1Lessons = paidCourse1Modules.flatMap((m) => m.lessons);

  if (paidCourse1Lessons.length >= 2) {
    const ieltsQuiz1 = await createQuizWithQuestions(
      paidCourse1Lessons[1].lessonId,
      'IELTS Listening Practice Quiz',
      30,
      70,
      ieltsListeningQuestions
    );
    console.log('  ✅ Quiz:', ieltsQuiz1.title, `(${ieltsListeningQuestions.length} questions)`);

    if (paidCourse1Lessons.length >= 4) {
      const ieltsQuiz2 = await createQuizWithQuestions(
        paidCourse1Lessons[3].lessonId,
        'IELTS Reading Comprehension Quiz',
        60,
        70,
        ieltsReadingQuestions
      );
      console.log('  ✅ Quiz:', ieltsQuiz2.title, `(${ieltsReadingQuestions.length} questions)`);
    }
  }

  console.log('\n📖 Creating enrollments...');

  // Ensure assignment records exist for assignment-type lessons in enrollment pool.
  console.log('\n📎 Ensuring assignment records exist...');
  const assignmentCoursePool = [
    freeCourse1,
    freeCourse2,
    paidCourse2,
    paidCourse3,
    ...createdExtraCourses,
  ];
  const assignmentCourseIds = [...new Set(assignmentCoursePool.map((c) => c.courseId))];
  const assignmentLessons = await prisma.lesson.findMany({
    where: {
      type: 'assignment',
      module: {
        courseId: {
          in: assignmentCourseIds,
        },
      },
    },
    include: {
      module: { include: { course: true } },
      assignments: true,
    },
  });
  for (const lesson of assignmentLessons) {
    if ((lesson.assignments || []).length > 0) continue;
    await prisma.assignment.create({
      data: {
        lessonId: lesson.lessonId,
        title: `${lesson.title} Submission`,
        instructions: lesson.contentText || `Submit your work for ${lesson.title}.`,
      },
    });
    console.log(`  ✅ Assignment created: ${lesson.title} (${lesson.module.course.title})`);
  }

  // Cross enroll: each student enrolls in ~3 courses (paid-biased) to give FE enough data.
  console.log('\n🧩 Creating enrollments & seeding progress (cross enroll)...');

  const enrollmentPlan = [
    {
      student: student1,
      items: [
        { course: paidCourse2, mode: 'completed' },
        { course: paidCourse3, mode: 'partial' },
        { course: freeCourse1, mode: 'new' },
      ],
    },
    {
      student: student2,
      items: [
        { course: paidCourse3, mode: 'completed' },
        { course: paidCourse2, mode: 'partial' },
        { course: freeCourse2, mode: 'new' },
      ],
    },
    {
      student: student3,
      items: [
        { course: paidCourse2, mode: 'partial' },
        { course: paidCourse3, mode: 'completed' },
        { course: freeCourse1, mode: 'new' },
      ],
    },
  ];

  const allStudents = [student1, student2, student3, ...createdExtraStudents];
  const enrollmentCoursePool = [
    freeCourse1,
    freeCourse2,
    paidCourse2,
    paidCourse3,
    ...createdExtraCourses,
  ];
  const modes = ['completed', 'partial', 'new'];

  // Add many more enrollments with mixed progress for extra students.
  for (let idx = 0; idx < allStudents.length; idx++) {
    const learner = allStudents[idx];
    const planned = [];
    const start = (idx * 2) % enrollmentCoursePool.length;
    const count = 4 + (idx % 3); // 4-6 courses per student
    for (let c = 0; c < count; c++) {
      const course = enrollmentCoursePool[(start + c) % enrollmentCoursePool.length];
      if (!planned.some((p) => p.course.courseId === course.courseId)) {
        planned.push({ course, mode: modes[(idx + c) % modes.length] });
      }
    }
    enrollmentPlan.push({ student: learner, items: planned });
  }

  // Deduplicate student-course pairs if they were already defined above.
  const dedupEnrollmentPlan = enrollmentPlan.map((group) => {
    const seen = new Set();
    const items = group.items.filter((item) => {
      const key = `${group.student.userId}_${item.course.courseId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ...group, items };
  });

  const createdEnrollments = [];
  for (const group of dedupEnrollmentPlan) {
    for (const item of group.items) {
      const enrollment = await prisma.enrollment.upsert({
        where: {
          userId_courseId: {
            userId: group.student.userId,
            courseId: item.course.courseId,
          },
        },
        update: {
          status: 'active',
          progressPercent: 0,
          orderId: null,
          expiryDate: null,
        },
        create: {
          userId: group.student.userId,
          courseId: item.course.courseId,
          status: 'active',
        },
      });
      if (
        !createdEnrollments.some(
          (e) => e.enrollmentId === enrollment.enrollmentId,
        )
      ) {
        createdEnrollments.push({
          enrollmentId: enrollment.enrollmentId,
          courseId: item.course.courseId,
          mode: item.mode,
          userId: group.student.userId,
        });
      }
      console.log(
        `  ✅ ${group.student.email} enrolled in: ${item.course.title} (${item.mode})`,
      );
    }
  }

  // Load course details for seeding progress snapshot.
  const uniqueCourseIds = [...new Set(createdEnrollments.map((e) => e.courseId))];
  const courseDetailsById = {};
  for (const courseId of uniqueCourseIds) {
    const courseFull = await prisma.course.findUnique({
      where: { courseId },
      include: {
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lessons: {
              orderBy: { orderIndex: 'asc' },
              include: {
                lessonResources: true,
                quizzes: true,
                assignments: true,
              },
            },
          },
        },
      },
    });
    if (courseFull) courseDetailsById[courseId] = courseFull;
  }

  async function seedProgressForEnrollment({ enrollmentId, courseId, mode }) {
    const courseFull = courseDetailsById[courseId];
    if (!courseFull) return;

    const lessons = courseFull.modules.flatMap((m) => m.lessons || []);
    const seededNow = new Date();

    if (mode === 'completed') {
      for (const lesson of lessons) {
        if ((lesson.contentText || '').trim()) {
          await markContentViewed(enrollmentId, lesson.lessonId, seededNow);
        }

        if (lesson.mediaUrl) {
          await completePrimaryVideo(enrollmentId, lesson, seededNow);
        }

        for (const r of lesson.lessonResources || []) {
          await completeLessonResource(enrollmentId, r.resourceId, seededNow);
        }

        const quiz = (lesson.quizzes || [])[0];
        if (quiz) {
          const passingScore = Number(quiz.passingScore || 0);
          await seedQuizAttempt(enrollmentId, quiz.quizId, passingScore + 10, seededNow);
        }

        const assignment = (lesson.assignments || [])[0];
        if (assignment) {
          await seedAssignmentSubmission(enrollmentId, assignment.assignmentId, {
            submittedAt: seededNow,
            grade: 8.5,
            feedback: 'Well-structured submission. Good work overall.',
          });
        }
      }
      return;
    }

    if (mode === 'partial') {
      const seedCount = Math.max(1, Math.ceil(lessons.length * 0.6));
      for (let i = 0; i < Math.min(seedCount, lessons.length); i++) {
        const lesson = lessons[i];

        if ((lesson.contentText || '').trim()) {
          // Partial: only content/view state for quiz/assignment lessons (no quizAttempt/assignmentSubmission).
          await markContentViewed(enrollmentId, lesson.lessonId, seededNow);
        }

        const resources = lesson.lessonResources || [];
        const hasResources = resources.length > 0;

        if (lesson.mediaUrl && hasResources) {
          // Partial: complete primary video and only some resources (e.g., 1 out of N).
          await completePrimaryVideo(enrollmentId, lesson, seededNow);
          const toComplete = resources.slice(0, 1);
          for (const r of toComplete) {
            await completeLessonResource(enrollmentId, r.resourceId, seededNow);
          }
        }
        if (lesson.mediaUrl && !hasResources) {
          // Partial variety: complete video for some video lessons to generate non-zero progressPercent.
          if (i % 2 === 0) {
            await completePrimaryVideo(enrollmentId, lesson, seededNow);
          }
        }

        const assignment = (lesson.assignments || [])[0];
        if (assignment && i % 2 === 0) {
          // Partial group keeps pending review state for instructor grading tests.
          await seedAssignmentSubmission(enrollmentId, assignment.assignmentId, {
            submittedAt: seededNow,
            grade: null,
            feedback: null,
          });
        }
      }
      return;
    }

    // mode === 'new'
  }

  for (const e of createdEnrollments) {
    await seedProgressForEnrollment(e);
  }

  // Ensure pending submissions exist for instructor grading tests.
  const partialEnrollments = createdEnrollments.filter((e) => e.mode === 'partial').slice(0, 30);
  for (const e of partialEnrollments) {
    const courseFull = courseDetailsById[e.courseId];
    if (!courseFull) continue;
    const assignmentIds = courseFull.modules.flatMap((m) =>
      (m.lessons || []).flatMap((l) => (l.assignments || []).map((a) => a.assignmentId)),
    );
    if (assignmentIds.length === 0) continue;
    const assignmentId = assignmentIds[0];
    await seedAssignmentSubmission(e.enrollmentId, assignmentId, {
      submittedAt: new Date(),
      grade: null,
      feedback: null,
    });
  }

  // Sync Enrollment.progressPercent from snapshot for all newly-created enrollments.
  for (const e of createdEnrollments) {
    await refreshEnrollmentPercentFromSnapshot(e.enrollmentId, e.courseId);
  }

  console.log('\n✅ Progress seeded for all cross enrollments.\n');

  console.log('\n✨ Seeding completed!\n');
  console.log(
    `💡 IELTS test URL (student@example.com): /student/courses/${paidCourse1.courseId}/learn`,
  );
  console.log('📝 Test Accounts:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin: admin@example.com / password123');
  console.log('Instructors: lecturer@example.com, teacher2@example.com / password123');
  console.log('Students: student@example.com, student2@example.com, student3@example.com / password123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
