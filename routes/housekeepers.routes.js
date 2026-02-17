const express = require('express');
const router = express.Router();
const path = require('path');
const { readJSON } = require('../utils/jsonHelper');

// Data file paths
const HOTEL_FILE = path.join(__dirname, '../data/hotel.json');
const USER_FILE = path.join(__dirname, '../data/user.json');
const CLEANING_TASKS_FILE = path.join(__dirname, '../data/cleaningTasks.json');

// Housekeepers page (GET)
router.get('/', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const users = await readJSON(USER_FILE) || [];
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];

    // Get only users with role "housekeeper"
    const housekeeperUsers = users.filter(u => u.role === 'housekeeper');

    // Calculate task counts for each housekeeper
    const housekeepers = housekeeperUsers.map(h => {
      const assignedTasks = cleaningTasks.filter(t => 
        t.assignedTo === h.id && t.status !== 'Completed'
      );
      const completedToday = cleaningTasks.filter(t => {
        const today = new Date().toISOString().split('T')[0];
        return t.assignedTo === h.id && 
               t.status === 'Completed' && 
               (t.completedAt?.startsWith(today));
      }).length;
      
      // Total tasks ever completed by this housekeeper
      const totalCompleted = cleaningTasks.filter(t => 
        t.assignedTo === h.id && t.status === 'Completed'
      ).length;
      
      // Format join date
      const joinDate = h.createdAt ? new Date(h.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) : 'Unknown';
      
      return {
        id: h.id,
        name: h.name,
        username: h.username,
        isActive: h.isActive || false,
        taskCount: assignedTasks.length,
        completedToday,
        totalCompleted,
        joinDate,
        currentTask: assignedTasks.find(t => t.status === 'In Progress')?.roomNumber || 
                     assignedTasks.find(t => t.status === 'In Progress')?.location || 
                     null
      };
    });

    // Calculate stats
    const totalStaff = housekeepers.length;
    const activeToday = housekeepers.filter(h => h.isActive).length;
    const today = new Date().toISOString().split('T')[0];
    const tasksCompletedToday = cleaningTasks.filter(t => 
      t.status === 'Completed' && t.completedAt?.startsWith(today)
    ).length;

    // Get recent completed cleanings
    const recentCleanups = cleaningTasks
      .filter(t => t.status === 'Completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt))
      .slice(0, 5)
      .map(t => ({
        room: t.roomNumber || t.location,
        housekeeper: t.assignedToName || 'Unknown',
        type: t.serviceType,
        time: t.completedAt ? new Date(t.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Recently'
      }));

    res.render('receptionist/housekeepers', {
      layout: 'layouts/main',
      title: 'Housekeepers',
      hotelName: hotel?.name || 'StaySync',
      userInitial: (req.session.name || 'R').charAt(0).toUpperCase(),
      stats: {
        totalStaff,
        activeToday,
        tasksCompletedToday
      },
      housekeepers,
      recentCleanups
    });
  } catch (error) {
    console.error('Error loading housekeepers:', error);
    res.render('receptionist/housekeepers', {
      layout: 'layouts/main',
      title: 'Housekeepers',
      hotelName: 'StaySync',
      userInitial: 'R',
      stats: { totalStaff: 0, activeToday: 0, tasksCompletedToday: 0 },
      housekeepers: [],
      recentCleanups: []
    });
  }
});

module.exports = router;
