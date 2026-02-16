const express = require('express');
const router = express.Router();

// ================= ROOT =================
// Default entry point → Receptionist Dashboard
router.get('/', (req, res) => {
  res.redirect('/receptionist/dashboard');
});


// ================= HOUSEKEEPING ENTRY =================
// Direct access to housekeeping dashboard (temporary frontend access)
router.get('/housekeeping', (req, res) => {
  res.redirect('/housekeeping/dashboard');
});


// ================= LOGOUT =================
// No session logic yet (frontend only)
router.get('/logout', (req, res) => {
  res.redirect('/');
});


module.exports = router;
