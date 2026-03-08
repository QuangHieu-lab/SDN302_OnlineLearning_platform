/**
 * Analytics Service
 * Handles dashboard statistics and chart data aggregation
 */

const prisma = require('../../utils/prisma');

/**
 * Get overview statistics for admin dashboard
 * @returns {Promise<Object>} Stats summary
 */
async function getStatsSummary() {
  const [
    totalUsers,
    totalStudents,
    totalInstructors,
    totalCourses,
    publishedCourses,
    pendingCourses,
    totalEnrollments,
    revenueData,
    todayOrders,
  ] = await Promise.all([
    // Total users
    prisma.user.count(),
    
    // Students count
    prisma.userRole.count({
      where: { role: { roleName: 'student' } },
    }),
    
    // Instructors count
    prisma.userRole.count({
      where: { role: { roleName: 'instructor' } },
    }),
    
    // Total courses
    prisma.course.count(),
    
    // Published courses
    prisma.course.count({
      where: { status: 'published' },
    }),
    
    // In-progress courses (not yet published)
    prisma.course.count({
      where: { status: 'in_progress' },
    }),
    
    // Total enrollments
    prisma.enrollment.count(),
    
    // Total revenue from successful transactions
    prisma.transaction.aggregate({
      where: { status: 'success' },
      _sum: { amount: true },
    }),
    
    // Today's orders
    prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      students: totalStudents,
      instructors: totalInstructors,
    },
    courses: {
      total: totalCourses,
      published: publishedCourses,
      pendingReview: pendingCourses,
    },
    enrollments: totalEnrollments,
    revenue: {
      total: revenueData._sum.amount || 0,
    },
    todayOrders,
  };
}

/**
 * Get revenue data grouped by period
 * @param {Object} params - Query parameters
 * @param {Date} params.startDate - Start date
 * @param {Date} params.endDate - End date
 * @param {string} params.groupBy - Group by: 'day', 'week', 'month'
 * @returns {Promise<Array>} Revenue data points
 */
async function getRevenueByPeriod({ startDate, endDate, groupBy = 'day' }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Use raw query for date grouping
  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'week':
      dateFormat = '%Y-%u';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const results = await prisma.$queryRaw`
    SELECT 
      DATE_FORMAT(created_at, ${dateFormat}) as period,
      SUM(amount) as revenue,
      COUNT(*) as orderCount
    FROM transactions
    WHERE status = 'success'
      AND created_at >= ${start}
      AND created_at <= ${end}
    GROUP BY DATE_FORMAT(created_at, ${dateFormat})
    ORDER BY period ASC
  `;

  return results.map(row => ({
    period: row.period,
    revenue: Number(row.revenue) || 0,
    orderCount: Number(row.orderCount) || 0,
  }));
}

/**
 * Get user growth data grouped by period
 * @param {Object} params - Query parameters
 * @param {Date} params.startDate - Start date
 * @param {Date} params.endDate - End date
 * @param {string} params.groupBy - Group by: 'day', 'week', 'month'
 * @returns {Promise<Array>} User growth data points
 */
async function getUserGrowthByPeriod({ startDate, endDate, groupBy = 'day' }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'week':
      dateFormat = '%Y-%u';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const results = await prisma.$queryRaw`
    SELECT 
      DATE_FORMAT(created_at, ${dateFormat}) as period,
      COUNT(*) as newUsers
    FROM users
    WHERE created_at >= ${start}
      AND created_at <= ${end}
    GROUP BY DATE_FORMAT(created_at, ${dateFormat})
    ORDER BY period ASC
  `;

  return results.map(row => ({
    period: row.period,
    newUsers: Number(row.newUsers) || 0,
  }));
}

/**
 * Get enrollment data grouped by period
 * @param {Object} params - Query parameters
 * @param {Date} params.startDate - Start date
 * @param {Date} params.endDate - End date
 * @param {string} params.groupBy - Group by: 'day', 'week', 'month'
 * @returns {Promise<Array>} Enrollment data points
 */
async function getEnrollmentsByPeriod({ startDate, endDate, groupBy = 'day' }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = '%Y-%m';
      break;
    case 'week':
      dateFormat = '%Y-%u';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const results = await prisma.$queryRaw`
    SELECT 
      DATE_FORMAT(enrolled_at, ${dateFormat}) as period,
      COUNT(*) as enrollments
    FROM enrollments
    WHERE enrolled_at >= ${start}
      AND enrolled_at <= ${end}
    GROUP BY DATE_FORMAT(enrolled_at, ${dateFormat})
    ORDER BY period ASC
  `;

  return results.map(row => ({
    period: row.period,
    enrollments: Number(row.enrollments) || 0,
  }));
}

/**
 * Get top courses by revenue or enrollments
 * @param {Object} params - Query parameters
 * @param {string} params.sortBy - 'revenue' or 'enrollments'
 * @param {number} params.limit - Number of courses to return
 * @returns {Promise<Array>} Top courses
 */
async function getTopCourses({ sortBy = 'enrollments', limit = 10 }) {
  if (sortBy === 'revenue') {
    const results = await prisma.$queryRaw`
      SELECT 
        c.course_id as courseId,
        c.title,
        c.price,
        u.full_name as instructorName,
        COUNT(DISTINCT e.enrollment_id) as totalEnrollments,
        COALESCE(SUM(od.price), 0) as totalRevenue
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN enrollments e ON c.course_id = e.course_id
      LEFT JOIN order_details od ON c.course_id = od.course_id
      LEFT JOIN orders o ON od.order_id = o.order_id AND o.status = 'completed'
      WHERE c.status = 'published'
      GROUP BY c.course_id, c.title, c.price, u.full_name
      ORDER BY totalRevenue DESC
      LIMIT ${limit}
    `;

    return results.map(row => ({
      courseId: row.courseId,
      title: row.title,
      price: Number(row.price) || 0,
      instructorName: row.instructorName,
      totalEnrollments: Number(row.totalEnrollments) || 0,
      totalRevenue: Number(row.totalRevenue) || 0,
    }));
  }

  // Sort by enrollments
  const courses = await prisma.course.findMany({
    where: { status: 'published' },
    select: {
      courseId: true,
      title: true,
      price: true,
      totalStudents: true,
      instructor: {
        select: { fullName: true },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { totalStudents: 'desc' },
    take: limit,
  });

  return courses.map(c => ({
    courseId: c.courseId,
    title: c.title,
    price: Number(c.price) || 0,
    instructorName: c.instructor.fullName,
    totalEnrollments: c._count.enrollments,
  }));
}

/**
 * Get recent activity for dashboard
 * @param {number} limit - Number of items to return
 * @returns {Promise<Object>} Recent activities
 */
async function getRecentActivity(limit = 5) {
  const [recentOrders, recentEnrollments, recentUsers] = await Promise.all([
    prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, email: true } },
        orderDetails: {
          include: {
            course: { select: { title: true } },
          },
        },
      },
    }),
    
    prisma.enrollment.findMany({
      take: limit,
      orderBy: { enrolledAt: 'desc' },
      include: {
        user: { select: { fullName: true } },
        course: { select: { title: true } },
      },
    }),
    
    prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        userId: true,
        fullName: true,
        email: true,
        createdAt: true,
        userRoles: {
          include: { role: true },
        },
      },
    }),
  ]);

  return {
    recentOrders: recentOrders.map(o => ({
      orderId: o.orderId,
      userName: o.user.fullName,
      userEmail: o.user.email,
      totalAmount: o.totalAmount,
      status: o.status,
      courses: o.orderDetails.map(d => d.course.title),
      createdAt: o.createdAt,
    })),
    recentEnrollments: recentEnrollments.map(e => ({
      enrollmentId: e.enrollmentId,
      userName: e.user.fullName,
      courseTitle: e.course.title,
      enrolledAt: e.enrolledAt,
    })),
    recentUsers: recentUsers.map(u => ({
      userId: u.userId,
      fullName: u.fullName,
      email: u.email,
      roles: u.userRoles.map(ur => ur.role.roleName),
      createdAt: u.createdAt,
    })),
  };
}

module.exports = {
  getStatsSummary,
  getRevenueByPeriod,
  getUserGrowthByPeriod,
  getEnrollmentsByPeriod,
  getTopCourses,
  getRecentActivity,
};
