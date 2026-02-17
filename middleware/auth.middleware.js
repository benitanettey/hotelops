/**
 * Authentication Middleware
 * Checks if user is logged in (has active session)
 */

const { getDashboardPath } = require('../utils/roleHelper');

/**
 * Require user to be authenticated
 * Redirects to login page if not authenticated
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    // User is logged in, proceed to next middleware/route
    return next();
  }
  
  // Not authenticated - redirect to login
  res.redirect('/login');
}

/**
 * Redirect authenticated users away from auth pages
 * (e.g., logged-in users shouldn't see login/signup pages)
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    // User is already logged in - redirect based on role
    return res.redirect(getDashboardPath(req.session.role));
  }
  
  // Not authenticated - proceed to login/signup page
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuthenticated
};