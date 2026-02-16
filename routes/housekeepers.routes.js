const express = require('express');
const router = express.Router();

// Housekeepers page (GET)
router.get('/', (req, res) => {

  // BACKEND TODO:
  // 1. Read housekeepers from housekeepers.json
  // 2. Read cleaningTasks.json to calculate completed tasks
  // 3. Compute stats dynamically:
  //    - totalStaff
  //    - activeShift (onShift === true)
  //    - tasksCompleted (status === 'Completed')
  //    - overloaded (workload > 80)
  // 4. Fetch latest completed cleanings
  // 5. Sort recentCleanups by latest first

  const housekeepers = [
    { name: "Maria Gonzalez", location: "Floor 3 & 4", workload: 85, onShift: true },
    { name: "John Smith", location: "Ground Floor", workload: 50, onShift: true },
    { name: "Sarah Connor", location: "Pool & Spa", workload: 15, onShift: false }
  ];

  const recentCleanups = [
    { room: "402 Executive Suite", housekeeper: "Maria Gonzalez", type: "Standard", time: "10:45 AM (Today)" },
    { room: "105 Deluxe Twin", housekeeper: "John Smith", type: "Deep Clean", time: "09:12 AM (Today)" }
  ];

  const totalStaff = housekeepers.length;
  const activeShift = housekeepers.filter(h => h.onShift).length;
  const overloaded = housekeepers.filter(h => h.workload > 80).length;
  const tasksCompleted = 45;

  res.render('receptionist/housekeepers', {
    layout: 'layouts/main',
    title: 'Housekeepers',
    stats: {
      totalStaff,
      activeShift,
      tasksCompleted,
      overloaded
    },
    housekeepers,
    recentCleanups
  });

});

module.exports = router;
