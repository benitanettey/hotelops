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
 * Require user to have admin privileges
 * Note: Admin is a receptionist with isAdmin=true, not a separate role
 * Redirects to appropriate dashboard if not admin
 */
function requireAdmin(req, res, next) {
  // First check if authenticated
  if (!req.session || !req.session.isAuthenticated) {
    return res.redirect('/login');
  }
  
  // Check if user is admin (has isAdmin flag)
  if (req.session.isAdmin === true) {
    return next();
  }
  
  // Not admin - redirect with error message in query param
  // For AJAX/API calls, return JSON error
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(403).json({ error: 'Only admin receptionist can perform this action' });
  }
  
  // For page requests, redirect to dashboard with error
  res.redirect(getDashboardPath(req.session.role) + '?error=admin_required');
}

/**
 * Check admin for specific actions but allow page access
 * Use this to show pages but disable certain features for non-admins
 */
function checkAdmin(req, res, next) {
  req.isAdmin = req.session && req.session.isAdmin === true;
  next();
}

module.exports = {
  requireReceptionist,
  requireHousekeeper,
  requireAdmin,
  checkAdmin
};