// Housekeeping routes - for cleaners/housekeepers

const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireHousekeeper } = require('../middleware/role.middleware');
const { readJSON, writeJSON } = require('../utils/jsonHelper');
const { logActivity, ACTIVITY_TYPES } = require('../utils/activityHelper');

// Data file paths
const HOTEL_FILE = path.join(__dirname, '../data/hotel.json');
const USER_FILE = path.join(__dirname, '../data/user.json');
const CLEANING_TASKS_FILE = path.join(__dirname, '../data/cleaningTasks.json');
const ROOMS_FILE = path.join(__dirname, '../data/rooms.json');

// Apply authentication and role middleware to ALL housekeeping routes
router.use(requireAuth);
router.use(requireHousekeeper);

// ================= HOUSEKEEPING DASHBOARD =================
router.get('/dashboard', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const users = await readJSON(USER_FILE);
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];
    
    // Get current housekeeper
    const housekeeper = users.find(u => u.id === req.session.userId);
    
    if (!housekeeper) {
      return res.redirect('/login');
    }
    
    // Filter tasks assigned to this housekeeper (exclude completed)
    const myActiveTasks = cleaningTasks.filter(t => 
      t.assignedTo === req.session.userId && t.status !== 'Completed'
    );
    
    const myTasks = myActiveTasks
      .sort((a, b) => {
        // Sort: In Progress first, then Pending
        const order = { 'In Progress': 0, 'Pending': 1 };
        return (order[a.status] || 2) - (order[b.status] || 2);
      })
      .map(t => ({
        id: t.id,
        roomNumber: t.roomNumber || t.location,
        location: t.location || (t.roomNumber ? `Room ${t.roomNumber}` : 'Unknown'),
        serviceType: t.serviceType,
        priority: t.priority,
        status: t.status.toLowerCase().replace(' ', '-'),
        notes: t.instructions || '',
        assignedAt: t.assignedAt ? new Date(t.assignedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Recently',
        isCustomLocation: !!t.location && !t.roomNumber
      }));
    
    // Calculate stats
    const pending = myActiveTasks.filter(t => t.status === 'Pending').length;
    const inProgress = myActiveTasks.filter(t => t.status === 'In Progress').length;
    
    // Completed today - check completedAt field
    const today = new Date().toISOString().split('T')[0];
    const completed = cleaningTasks.filter(t => 
      t.assignedTo === req.session.userId && 
      t.status === 'Completed' && 
      t.completedAt?.startsWith(today)
    ).length;
    
    res.render('housekeeping/dashboard', {
      layout: 'layouts/main',
      title: 'Housekeeping Dashboard',
      hotelName: hotel?.name || 'StaySync',
      userInitial: housekeeper.name?.charAt(0)?.toUpperCase() || 'H',
      housekeeper: {
        name: housekeeper.name,
        isActive: housekeeper.isActive || false
      },
      tasks: myTasks,
      stats: {
        pending,
        inProgress,
        completed
      }
    });
  } catch (error) {
    console.error('Error loading housekeeping dashboard:', error);
    res.render('housekeeping/dashboard', {
      layout: 'layouts/main',
      title: 'Housekeeping Dashboard',
      hotelName: 'StaySync',
      housekeeper: { name: 'Unknown', isActive: false },
      tasks: [],
      stats: { pending: 0, inProgress: 0, completed: 0 }
    });
  }
});

// Toggle active status (POST)
router.post('/toggle-status', async (req, res) => {
  try {
    const users = await readJSON(USER_FILE);
    const hotel = await readJSON(HOTEL_FILE);
    
    const userIndex = users.findIndex(u => u.id === req.session.userId);
    
    if (userIndex === -1) {
      return res.redirect('/housekeeping/dashboard');
    }
    
    // Toggle active status
    const newStatus = !users[userIndex].isActive;
    users[userIndex].isActive = newStatus;
    users[userIndex].lastStatusChange = new Date().toISOString();
    
    await writeJSON(USER_FILE, users);
    
    // Log activity
    await logActivity({
      type: ACTIVITY_TYPES.STATUS_CHANGE,
      description: newStatus ? 'Housekeeper Online' : 'Housekeeper Offline',
      details: `${users[userIndex].name} is now ${newStatus ? 'active' : 'offline'}`,
      userId: req.session.userId,
      userName: req.session.name,
      hotelId: hotel?.id || null
    });
    
    res.redirect('/housekeeping/dashboard');
  } catch (error) {
    console.error('Error toggling status:', error);
    res.redirect('/housekeeping/dashboard');
  }
});

// Start a task (POST)
router.post('/start/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];
    const hotel = await readJSON(HOTEL_FILE);
    
    const taskIndex = cleaningTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.redirect('/housekeeping/dashboard');
    }
    
    // Update task status
    cleaningTasks[taskIndex].status = 'In Progress';
    cleaningTasks[taskIndex].startedAt = new Date().toISOString();
    
    await writeJSON(CLEANING_TASKS_FILE, cleaningTasks);
    
    // Log activity
    const task = cleaningTasks[taskIndex];
    await logActivity({
      type: ACTIVITY_TYPES.CLEANING_STARTED,
      description: 'Cleaning Started',
      details: `${task.roomNumber || task.location} • ${req.session.name}`,
      userId: req.session.userId,
      userName: req.session.name,
      hotelId: hotel?.id || null
    });
    
    res.redirect('/housekeeping/dashboard');
  } catch (error) {
    console.error('Error starting task:', error);
    res.redirect('/housekeeping/dashboard');
  }
});

// Complete a task (POST)
router.post('/complete/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];
    const hotel = await readJSON(HOTEL_FILE);
    const rooms = await readJSON(ROOMS_FILE);
    
    const taskIndex = cleaningTasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return res.redirect('/housekeeping/dashboard');
    }
    
    const task = cleaningTasks[taskIndex];
    
    // Update task status
    cleaningTasks[taskIndex].status = 'Completed';
    cleaningTasks[taskIndex].completedAt = new Date().toISOString();
    
    await writeJSON(CLEANING_TASKS_FILE, cleaningTasks);
    
    // If it's a room cleaning, update room status to Available
    if (task.roomNumber) {
      const roomIndex = rooms.findIndex(r => r.roomNumber === task.roomNumber);
      if (roomIndex !== -1 && rooms[roomIndex].status === 'Cleaning') {
        rooms[roomIndex].status = 'Available';
        await writeJSON(ROOMS_FILE, rooms);
      }
    }
    
    // Log activity
    await logActivity({
      type: ACTIVITY_TYPES.CLEANING_COMPLETE,
      description: 'Cleaning Completed',
      details: `${task.roomNumber || task.location} • ${req.session.name}`,
      userId: req.session.userId,
      userName: req.session.name,
      hotelId: hotel?.id || null
    });
    
    res.redirect('/housekeeping/dashboard');
  } catch (error) {
    console.error('Error completing task:', error);
    res.redirect('/housekeeping/dashboard');
  }
});

// ================= SETTINGS PAGE =================
router.get('/settings', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const users = await readJSON(USER_FILE);
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];
    
    // Get current housekeeper
    const housekeeper = users.find(u => u.id === req.session.userId);
    
    if (!housekeeper) {
      return res.redirect('/login');
    }
    
    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const totalCompleted = cleaningTasks.filter(t => 
      t.assignedTo === req.session.userId && t.status === 'Completed'
    ).length;
    const completedToday = cleaningTasks.filter(t => 
      t.assignedTo === req.session.userId && 
      t.status === 'Completed' && 
      t.completedAt?.startsWith(today)
    ).length;
    
    // Format join date
    const joinDate = housekeeper.createdAt 
      ? new Date(housekeeper.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'Unknown';
    
    res.render('housekeeping/settings', {
      layout: 'layouts/main',
      title: 'Settings',
      hotelName: hotel?.name || 'StaySync',
      success: req.query.success,
      error: req.query.error,
      housekeeper: {
        name: housekeeper.name,
        username: housekeeper.username,
        isActive: housekeeper.isActive || false,
        joinDate,
        totalCompleted,
        completedToday
      }
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.redirect('/housekeeping/dashboard');
  }
});

// Update profile (POST)
router.post('/settings/profile', async (req, res) => {
  try {
    const { name } = req.body;
    const users = await readJSON(USER_FILE);
    
    const userIndex = users.findIndex(u => u.id === req.session.userId);
    
    if (userIndex === -1) {
      return res.redirect('/housekeeping/settings?error=User not found');
    }
    
    // Update name
    users[userIndex].name = name.trim();
    await writeJSON(USER_FILE, users);
    
    // Update session
    req.session.name = name.trim();
    
    res.redirect('/housekeeping/settings?success=Profile updated');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.redirect('/housekeeping/settings?error=Failed to update profile');
  }
});

module.exports = router;
