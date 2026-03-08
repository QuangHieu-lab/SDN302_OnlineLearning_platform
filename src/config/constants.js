/**
 * Centralized constants and config getters for backend.
 * Production requires JWT_SECRET; dev falls back to 'secret' (server.js already enforces in production).
 */

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';
const REFRESH_FROM_PAYMENT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const COOKIE_MAX_AGE_DAYS = 7;

// Course defaults (match Prisma enums / schema)
const DEFAULT_COURSE_CATEGORY = 'Communication';
const DEFAULT_COURSE_LEVEL_TARGET = 'A1';

// Enrollment / progress status (match Prisma enum values)
const ENROLLMENT_STATUS_ACTIVE = 'active';
const ENROLLMENT_STATUS_COMPLETED = 'completed';
const PROGRESS_STATUS_COMPLETED = 'completed';
const PROGRESS_STATUS_IN_PROGRESS = 'in_progress';
const PROGRESS_STATUS_NOT_STARTED = 'not_started';

// Quiz defaults
const DEFAULT_PASSING_SCORE = 60;
const DEFAULT_TIME_LIMIT_MINUTES = 0;

// Upload limits
const VIDEO_MAX_BYTES = 500 * 1024 * 1024; // 500MB
const RESOURCE_MAX_BYTES = 20 * 1024 * 1024; // 20MB

// VNPay order expire (minutes → ms)
const VNPAY_ORDER_EXPIRE_MS = 15 * 60 * 1000;

// Certificate grade thresholds (letter grade)
const GRADE_A_MIN = 90;
const GRADE_B_MIN = 80;

// Allowed values for validation (match Prisma enums)
const COURSE_CATEGORIES = ['IELTS', 'TOEIC', 'Communication', 'Grammar', 'Business', 'Kids'];
const USER_LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const COURSE_STATUSES = ['in_progress', 'published', 'archived'];

function getJwtSecret() {
  return process.env.JWT_SECRET || 'secret';
}

module.exports = {
  BCRYPT_ROUNDS,
  JWT_EXPIRES_IN,
  REFRESH_FROM_PAYMENT_WINDOW_MS,
  COOKIE_MAX_AGE_DAYS,
  DEFAULT_COURSE_CATEGORY,
  DEFAULT_COURSE_LEVEL_TARGET,
  ENROLLMENT_STATUS_ACTIVE,
  ENROLLMENT_STATUS_COMPLETED,
  PROGRESS_STATUS_COMPLETED,
  PROGRESS_STATUS_IN_PROGRESS,
  PROGRESS_STATUS_NOT_STARTED,
  DEFAULT_PASSING_SCORE,
  DEFAULT_TIME_LIMIT_MINUTES,
  VIDEO_MAX_BYTES,
  RESOURCE_MAX_BYTES,
  VNPAY_ORDER_EXPIRE_MS,
  GRADE_A_MIN,
  GRADE_B_MIN,
  COURSE_CATEGORIES,
  USER_LEVELS,
  COURSE_STATUSES,
  getJwtSecret,
};
