/**
 * Role-based redirection helper
 * Returns the appropriate dashboard path for a given user role
 * @param {string} role - User role ('receptionist', 'housekeeper', 'admin')
 * @returns {string} Dashboard path
 */
function getDashboardPath(role) {
  if (role === 'receptionist' || role === 'admin') {
    return '/receptionist/dashboard';
  } else if (role === 'housekeeper') {
    return '/housekeeping/dashboard';
  }
  return '/login'; // Fallback for unknown roles
}

module.exports = {
  getDashboardPath
};
