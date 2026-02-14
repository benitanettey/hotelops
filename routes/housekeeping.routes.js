//add/manage housekeepers

const express = require('express');
const router = express.Router();

// Placeholder routes for housekeeping
// BACKEND TODO: Implement actual logic in housekeeping.controller.js

// Housekeeping dashboard
router.get('/dashboard', (req, res) => {
  res.send('Housekeeping Dashboard - TODO: Create housekeeping/dashboard.hbs');
});

module.exports = router;