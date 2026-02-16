const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { redirectIfAuthenticated } = require('../middleware/auth.middleware');
const { getDashboardPath } = require('../utils/roleHelper');

// ================= ROOT =================
// Redirect based on session
router.get('/', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    // Redirect logged-in users based on role
    return res.redirect(getDashboardPath(req.session.role));
  }
  // Not logged in - redirect to login
  res.redirect('/login');
});

// ================= SIGNUP =================
router.get('/signup', redirectIfAuthenticated, authController.showSignup);
router.post('/signup', redirectIfAuthenticated, authController.processSignup);

// ================= RECOVERY CODES =================
router.get('/recovery-codes', authController.showRecoveryCodes);
router.post('/recovery-codes/continue', authController.acknowledgeRecoveryCodes);

// ================= LOGIN =================
router.get('/login', redirectIfAuthenticated, authController.showLogin);
router.post('/login', redirectIfAuthenticated, authController.processLogin);

// ================= LOGOUT =================
router.get('/logout', authController.logout);

// ================= FORGOT PASSWORD (Recovery Codes) =================
router.get('/forgot-password', redirectIfAuthenticated, authController.showForgotPassword);
router.post('/forgot-password', redirectIfAuthenticated, authController.processForgotPassword);

module.exports = router;
