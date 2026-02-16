/**
 * Role-Based Access Control Middleware
 * Restricts access to routes based on user role
 */

const { getDashboardPath } = require('../utils/roleHelper');

/**
 * Require user to have receptionist role
 * Redirects to appropriate dashboard if wrong role
 */
function requireReceptionist(req, res, next) {
  // First check if authenticated
  if (!req.session || !req.session.isAuthenticated) {
    return res.redirect('/login');
  }
  
  // Check if user is receptionist or admin (admin can access all)
  if (req.session.role === 'receptionist' || req.session.role === 'admin') {
    return next();
  }
  
  // Wrong role - redirect to their appropriate dashboard
  res.redirect(getDashboardPath(req.session.role));
}

/**
 * Require user to have housekeeper role
 * Redirects to appropriate dashboard if wrong role
 */
function requireHousekeeper(req, res, next) {
  // First check if authenticated
  if (!req.session || !req.session.isAuthenticated) {
    return res.redirect('/login');
  }
  
  // Check if user is housekeeper
  if (req.session.role === 'housekeeper') {
    return next();
  }
  
  // Wrong role - redirect to their appropriate dashboard
  res.redirect(getDashboardPath(req.session.role));
}

/**
 * Require user to have admin role
 * Redirects to appropriate dashboard if wrong role
 */
function requireAdmin(req, res, next) {
  // First check if authenticated
  if (!req.session || !req.session.isAuthenticated) {
    return res.redirect('/login');
  }
  
  // Check if user is admin
  if (req.session.role === 'admin') {
    return next();
  }
  
  // Wrong role - redirect to their appropriate dashboard
  res.redirect(getDashboardPath(req.session.role));
}

module.exports = {
  requireReceptionist,
  requireHousekeeper,
  requireAdmin
};