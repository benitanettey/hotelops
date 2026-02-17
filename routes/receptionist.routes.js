const express = require('express');
const router = express.Router();
const { getCheckInPage, handleCheckIn, getCheckOutPage, handleCheckOut } = require('../controllers/receptionist.controller');
const { getAllRooms, getAllGuests, getAllCleaningTasks } = require('../utils/jsonHelper');

// Helper function to calculate time ago
function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
  return Math.floor(seconds / 86400) + ' days ago';
}

// Dashboard
router.get('/dashboard', (req, res) => {
  try {
    const rooms = getAllRooms();
    const guests = getAllGuests();
    const cleaningTasks = getAllCleaningTasks();
    
    const totalRooms = rooms.length;
    const occupied = rooms.filter(r => r.status === 'Occupied').length;
    const roomsReady = rooms.filter(r => r.status === 'Available').length;
    const pendingCleaning = cleaningTasks.filter(t => t.status === 'Pending').length;
    
    // Generate recent activity from guest data
    const recentActivity = guests
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(guest => {
        const timeAgo = getTimeAgo(guest.createdAt);
        if (guest.status === 'checked-in') {
          return {
            type: 'check-in',
            title: 'Guest Check-In',
            details: `Room ${guest.roomNumber} • ${guest.firstName} ${guest.lastName}`,
            time: timeAgo
          };
        } else {
          return {
            type: 'check-out',
            title: 'Guest Check-Out',
            details: `Room ${guest.roomNumber} • ${guest.firstName} ${guest.lastName}`,
            time: timeAgo
          };
        }
      });
    
    // Generate occupancy data for weekly chart (days of week)
    const occupancyData = [
      { day: 'Mon', occupancy: Math.round((occupied / totalRooms) * 100) },
      { day: 'Tue', occupancy: Math.round((occupied / totalRooms) * 100) },
      { day: 'Wed', occupancy: Math.round((occupied / totalRooms) * 100) },
      { day: 'Thu', occupancy: Math.round((occupied / totalRooms) * 100) },
      { day: 'Fri', occupancy: Math.round((occupied / totalRooms) * 100) },
      { day: 'Sat', occupancy: Math.round((occupied / totalRooms) * 100) },
      { day: 'Sun', occupancy: Math.round((occupied / totalRooms) * 100) }
    ];
    
    const successMessage = req.session.successMessage;
    delete req.session.successMessage;
    
    res.render('receptionist/dashboard', {
      layout: 'layouts/main',
      title: 'Dashboard',
      totalRooms,
      roomsReady,
      pendingCleaning,
      occupied,
      recentActivity,
      occupancyData,
      successMessage
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.render('receptionist/dashboard', {
      layout: 'layouts/main',
      title: 'Dashboard',
      totalRooms: 0,
      roomsReady: 0,
      pendingCleaning: 0,
      occupied: 0,
      recentActivity: [],
      occupancyData: []
    });
  }
});

// Check-in page (GET)
router.get('/checkingguests', getCheckInPage);

// Check-in form submission (POST)
router.post('/checkin', handleCheckIn);

// Checkout page (GET)
router.get('/checkoutguests', getCheckOutPage);

// Checkout form submission (POST)
router.post('/checkout', handleCheckOut);

// Cleaning Requests page (GET)
router.get('/cleaning-requests', (req, res) => {
  try {
    const cleaningRequests = getAllCleaningTasks().map(task => ({
      id: task.id,
      roomNumber: task.roomNumber,
      serviceType: task.taskType,
      instructions: task.instructions,
      priority: task.priority,
      status: task.status,
      assignedTo: null,
      time: new Date(task.createdAt).toLocaleString(),
      createdAt: task.createdAt
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('receptionist/cleaning-requests', {
      layout: 'layouts/main',
      title: 'Cleaning Requests',
      cleaningRequests: cleaningRequests,
      totalRequests: cleaningRequests.length
    });
  } catch (error) {
    console.error('Error loading cleaning requests:', error);
    res.render('receptionist/cleaning-requests', {
      layout: 'layouts/main',
      title: 'Cleaning Requests',
      cleaningRequests: [],
      totalRequests: 0
    });
  }
});

// Cleaning Requests form submission (POST)
router.post('/cleaning-requests', (req, res) => {
  try {
    const { roomNumber, serviceType, priority, instructions, locationType } = req.body;
    const { addCleaningTask } = require('../utils/jsonHelper');

    if (!roomNumber || !serviceType || !priority || !locationType) {
      return res.redirect('/receptionist/cleaning-requests');
    }

    // If location type is Room, verify room exists
    if (locationType === 'Room') {
      const rooms = getAllRooms();
      const roomExists = rooms.find(r => r.number === roomNumber);
      
      if (!roomExists) {
        return res.redirect('/receptionist/cleaning-requests');
      }
    }
    
    // roomNumber will contain either the actual room number or the facility name
    // (populated by JavaScript when facility is selected)

    // Add the cleaning task to cleaningTasks.json
    addCleaningTask({
      roomNumber: roomNumber,
      taskType: serviceType,
      priority: priority,
      instructions: instructions || ''
    });

    res.redirect('/receptionist/cleaning-requests');
  } catch (error) {
    console.error('Error creating cleaning request:', error);
    res.redirect('/receptionist/cleaning-requests');
  }
});


// Rooms page (GET)
router.get('/rooms', (req, res) => {
  try {
    const allRooms = getAllRooms();
    const guests = getAllGuests();

    // Enrich rooms with guest details
    const rooms = allRooms.map(room => {
      const guest = guests.find(g => g.id === room.occupiedBy && g.status === 'checked-in');
      return {
        roomNumber: room.number,
        type: room.type,
        floor: room.floor,
        status: room.status,
        guest: guest ? `${guest.firstName} ${guest.lastName}` : null
      };
    });

    // Calculate summary counts
    const totalRooms = rooms.length;
    const availableRooms = rooms.filter(r => r.status === 'Available').length;
    const occupiedRooms = rooms.filter(r => r.status === 'Occupied').length;
    const cleaningRooms = rooms.filter(r => r.status === 'Cleaning').length;
    const maintenanceRooms = rooms.filter(r => r.status === 'Maintenance').length;

    res.render('receptionist/rooms', {
      layout: 'layouts/main',
      title: 'Room Management',
      rooms: rooms,
      totalRooms: totalRooms,
      availableRooms: availableRooms,
      occupiedRooms: occupiedRooms,
      cleaningRooms: cleaningRooms,
      maintenanceRooms: maintenanceRooms
    });
  } catch (error) {
    console.error('Error loading rooms:', error);
    res.render('receptionist/rooms', {
      layout: 'layouts/main',
      title: 'Room Management',
      rooms: [],
      totalRooms: 0,
      availableRooms: 0,
      occupiedRooms: 0,
      cleaningRooms: 0,
      maintenanceRooms: 0
    });
  }
});


module.exports = router;
