// add/manage housekeepers

const express = require('express');
const router = express.Router();
const { getAllCleaningTasks, getAllRooms } = require('../utils/jsonHelper');
const housekeepingController = require('../controllers/housekeeping.controller');

// ================= HOUSEKEEPING DASHBOARD =================
router.get('/dashboard', (req, res) => {

  try {
    // Get all cleaning tasks from JSON
    const allTasks = getAllCleaningTasks();

    // Transform tasks to match view structure
    const tasks = allTasks
      .map(task => ({
        id: task.id,
        room: task.roomNumber,
        roomNumber: task.roomNumber,
        taskType: task.taskType,
        priority: task.priority,
        status: task.status,
        notes: task.instructions,
        time: new Date(task.createdAt).toLocaleTimeString(),
        createdAt: task.createdAt
      }))
      .sort((a, b) => {
        // Pending first, then by date
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

    // ================= COMPUTED STATS =================
    const pending = tasks.filter(t => t.status === "Pending").length;
    const inProgress = tasks.filter(t => t.status === "In Progress").length;
    const completed = tasks.filter(t => t.status === "Completed").length;
    const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    // ================= HOUSEKEEPER INFO =================
    const housekeeper = {
      name: "Housekeeping Team",
      status: "Active"
    };

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
  } catch (error) {
    console.error('Error loading housekeeping dashboard:', error);
    res.render('housekeeping/dashboard', {
      layout: 'layouts/main',
      title: 'Housekeeping Dashboard',
      housekeeper: { name: "Housekeeping Team", status: "Active" },
      tasks: [],
      stats: {
        pending: 0,
        inProgress: 0,
        completed: 0,
        progress: 0
      }
    });
  }

});

// ================= MARK ROOM AS CLEANED =================
router.post('/mark-cleaned', housekeepingController.markRoomCleaned);

module.exports = router;
