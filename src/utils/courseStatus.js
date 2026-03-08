/**
 * Course Status Transition Validation Utilities
 * Validates status transitions according to the course lifecycle flow
 */

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS = {
  in_progress: ['published'],
  published: ['archived'],
  archived: [], // Archived courses cannot transition (final state)
};

/**
 * Validates if a status transition is allowed
 * @param {string} fromStatus - Current status
 * @param {string} toStatus - Target status
 * @returns {boolean} - True if transition is valid
 */
const isValidStatusTransition = (fromStatus, toStatus) => {
  if (!fromStatus || !toStatus) {
    return false;
  }

  const allowedTransitions = VALID_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
};

/**
 * Checks if a course meets the minimum requirements for submission
 * @param {Object} course - Course object with modules and lessons
 * @returns {Object} - { canSubmit: boolean, reason?: string }
 */
const canSubmit = (course) => {
  if (!course) {
    return { canSubmit: false, reason: 'Course not found' };
  }

  if (course.status !== 'in_progress') {
    return { canSubmit: false, reason: 'Only in-progress courses can be published' };
  }

  // Check if course has at least one module
  if (!course.modules || course.modules.length === 0) {
    return { canSubmit: false, reason: 'Course must have at least one module' };
  }

  // Check if course has at least one lesson across all modules
  const totalLessons = course.modules.reduce((count, module) => {
    return count + (module.lessons ? module.lessons.length : 0);
  }, 0);

  if (totalLessons === 0) {
    return { canSubmit: false, reason: 'Course must have at least one lesson' };
  }

  // Check if course has basic information
  if (!course.title || course.title.trim() === '') {
    return { canSubmit: false, reason: 'Course must have a title' };
  }

  if (!course.description || course.description.trim() === '') {
    return { canSubmit: false, reason: 'Course must have a description' };
  }

  return { canSubmit: true };
};

/**
 * Gets the next valid statuses for a given current status
 * @param {string} currentStatus - Current course status
 * @returns {string[]} - Array of valid next statuses
 */
const getNextValidStatuses = (currentStatus) => {
  return VALID_TRANSITIONS[currentStatus] || [];
};

module.exports = {
  isValidStatusTransition,
  canSubmit,
  getNextValidStatuses,
  VALID_TRANSITIONS,
};
