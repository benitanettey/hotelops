const express = require('express');
const router = express.Router();
const { getAllCleaningTasks } = require('../utils/jsonHelper');

// Housekeepers page (GET)
router.get('/', (req, res) => {
  try {
    // Get all cleaning tasks to calculate stats
    const allTasks = getAllCleaningTasks();
    
    // Calculate stats from actual cleaning tasks
    const tasksCompleted = allTasks.filter(t => t.status === 'Completed').length;
    const tasksPending = allTasks.filter(t => t.status === 'Pending').length;
    const tasksInProgress = allTasks.filter(t => t.status === 'In Progress').length;
    
    // Get recent cleanings (completed tasks)
    const recentCleanups = allTasks
      .filter(t => t.status === 'Completed')
      .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
      .slice(0, 6)
      .map(task => ({
        room: task.roomNumber,
        housekeeper: 'Housekeeping Team',
        type: task.taskType,
        time: new Date(task.completedDate).toLocaleString(),
        priority: task.priority
      }));
    
    // Sample housekeepers for display (static, since housekeepers.json is empty)
    // In a real system, this would come from housekeepers.json
    const housekeepers = [
      { 
        name: "Housekeeping Team", 
        location: "All Floors", 
        workload: tasksPending > 0 ? Math.min(100, (tasksPending / 10) * 100) : 0, 
        onShift: true,
        tasksCompleted: tasksCompleted
      }
    ];
    
    const totalStaff = housekeepers.length;
    const activeShift = housekeepers.filter(h => h.onShift).length;
    const overloaded = housekeepers.filter(h => h.workload > 80).length;

    res.render('receptionist/housekeepers', {
      layout: 'layouts/main',
      title: 'Housekeepers',
      stats: {
        totalStaff,
        activeShift,
        tasksCompleted,
        overloaded,
        tasksPending,
        tasksInProgress
      },
      housekeepers,
      recentCleanups
    });
  } catch (error) {
    console.error('Error loading housekeepers page:', error);
    res.render('receptionist/housekeepers', {
      layout: 'layouts/main',
      title: 'Housekeepers',
      stats: {
        totalStaff: 0,
        activeShift: 0,
        tasksCompleted: 0,
        overloaded: 0,
        tasksPending: 0,
        tasksInProgress: 0
      },
      housekeepers: [],
      recentCleanups: []
    });
  }
});

module.exports = router;
