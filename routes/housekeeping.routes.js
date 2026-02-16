// add/manage housekeepers

const express = require('express');
const router = express.Router();

// ================= HOUSEKEEPING DASHBOARD =================
router.get('/dashboard', (req, res) => {

  // ================= FRONTEND PLACEHOLDER DATA =================

  const housekeeper = {
    name: "Maria Gonzalez",
    status: "Active"
  };

  const tasks = [
    {
      room: "102",
      status: "In Progress",
      notes: "Extra towels needed",
      time: "09:00 AM"
    },
    {
      room: "105",
      status: "Pending",
      notes: "Deep clean required",
      time: "09:15 AM"
    },
    {
      room: "108",
      status: "Pending",
      notes: "Replace amenities",
      time: "09:30 AM"
    },
    {
      room: "210",
      status: "Completed",
      notes: "Standard cleaning",
      time: "08:15 AM"
    }
  ];

  // ================= COMPUTED STATS =================

  const pending = tasks.filter(t => t.status === "Pending").length;
  const inProgress = tasks.filter(t => t.status === "In Progress").length;
  const completed = tasks.filter(t => t.status === "Completed").length;

  const progress = Math.round((completed / tasks.length) * 100);

  // ================= RENDER DASHBOARD =================

  res.render('housekeeping/dashboard', {
    layout: 'layouts/main',
    title: 'Housekeeping Dashboard',
    housekeeper,
    tasks,
    stats: {
      pending,
      inProgress,
      completed,
      progress
    }
  });

});

module.exports = router;
