const express = require('express');
const router = express.Router();

// Redirect root to dashboard
router.get('/', (req, res) => {
  res.redirect('/receptionist/dashboard');
});

router.get('/login', (req, res) => {
  res.send('Login page - TODO: Create login.hbs');
});

router.get('/logout', (req, res) => {
  res.redirect('/');
});

module.exports = router;