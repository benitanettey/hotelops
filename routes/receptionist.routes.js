const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const { requireReceptionist } = require('../middleware/role.middleware');

// Apply authentication and role middleware to ALL receptionist routes
router.use(requireAuth);
router.use(requireReceptionist);

// Dashboard
router.get('/dashboard', (req, res) => {
  res.render('receptionist/dashboard', {
    layout: 'layouts/main',
    title: 'Dashboard',
    totalRooms: 50,
    roomsReady: 35,
    pendingCleaning: 8,
    occupied: 7
  });
});

// Check-in page (GET)
router.get('/checkingguests', (req, res) => {
  res.render('receptionist/checkingguests', {
    layout: 'layouts/main',
    title: 'Check-In',
    availableRooms: [
      { number: '101', type: 'Standard', price: 150 },
      { number: '102', type: 'Standard', price: 150 },
      { number: '201', type: 'Deluxe', price: 200 }
    ]
  });
});

// Check-in form submission (POST)
router.post('/checkin', (req, res) => {
  console.log('Check-in form submitted:', req.body);
  res.redirect('/receptionist/dashboard');
});

// Checkout page (GET)
router.get('/checkoutguests', (req, res) => {
  res.render('receptionist/checkoutguests', {
    layout: 'layouts/main',
    title: 'Checkout',
    occupiedRooms: [
      {
        roomNumber: '102',
        guestName: 'John Smith',
        guestId: 'guest-001',
        roomType: 'Single',
        checkInDate: '2026-02-05',
        expectedCheckOutDate: '2026-02-08',
        amountDue: 450
      },
      {
        roomNumber: '202',
        guestName: 'Jane Doe',
        guestId: 'guest-002',
        roomType: 'Double',
        checkInDate: '2026-02-04',
        expectedCheckOutDate: '2026-02-08',
        amountDue: 600
      },
      {
        roomNumber: '303',
        guestName: 'Bob Johnson',
        guestId: 'guest-003',
        roomType: 'Suite',
        checkInDate: '2026-02-06',
        expectedCheckOutDate: '2026-02-09',
        amountDue: 1200
      }
    ]
  });
});

// Checkout form submission (POST)
router.post('/checkout', (req, res) => {
  console.log('Checkout form submitted:', req.body);
  res.redirect('/receptionist/checkoutguests');
});

// Cleaning Requests page (GET)
router.get('/cleaning-requests', (req, res) => {
  // BACKEND TODO: Read from cleaningTasks.json and housekeepers.json
  const cleaningRequests = [
    {
      roomNumber: '102',
      serviceType: 'Daily Cleaning',
      instructions: 'Extra towels needed',
      priority: 'Medium',
      status: 'In Progress',
      assignedTo: {
        name: 'Maria Garcia',
        initials: 'MG'
      },
      time: '09:00 AM'
    },
    {
      roomNumber: '203',
      serviceType: 'Checkout Cleaning',
      instructions: 'Guest out at 11 AM',
      priority: 'High',
      status: 'Pending',
      assignedTo: null,
      time: '08:30 AM'
    },
    {
      roomNumber: '301',
      serviceType: 'Deep Cleaning',
      instructions: 'Scheduled maintenance',
      priority: 'Low',
      status: 'Pending',
      assignedTo: null,
      time: '07:15 AM'
    },
    {
      roomNumber: '105',
      serviceType: 'Turndown Service',
      instructions: 'VIP Guest',
      priority: 'Medium',
      status: 'Completed',
      assignedTo: {
        name: 'John Smith',
        initials: 'JS'
      },
      time: 'Yesterday'
    }
  ];

  res.render('receptionist/cleaning-requests', {
    layout: 'layouts/main',
    title: 'Cleaning Requests',
    cleaningRequests: cleaningRequests,
    totalRequests: 4
  });
});

// Cleaning Requests form submission (POST)
router.post('/cleaning-requests', (req, res) => {
  const { roomNumber, serviceType, priority, instructions } = req.body;

  // BACKEND TODO: 
  // 1. Validate inputs
  // 2. Create new cleaning task object with unique ID
  // 3. Save to cleaningTasks.json
  // 4. Redirect back to cleaning requests page

  console.log('New cleaning request:', { roomNumber, serviceType, priority, instructions });
  res.redirect('/receptionist/cleaning-requests');
});


// Rooms page (GET)
router.get('/rooms', (req, res) => {

  // BACKEND TODO:
  // 1. Read rooms from rooms.json
  // 2. Add filtering logic (status, type, search)
  // 3. Calculate summary counts dynamically

  const rooms = [
    { roomNumber: '101', type: 'Standard', floor: 1, status: 'Available', guest: null },
    { roomNumber: '102', type: 'Standard', floor: 1, status: 'Occupied', guest: 'John Smith' },
    { roomNumber: '201', type: 'Premium', floor: 2, status: 'Cleaning', guest: null },
    { roomNumber: '202', type: 'Premium', floor: 2, status: 'Maintenance', guest: null },
    { roomNumber: '301', type: 'Standard', floor: 3, status: 'Available', guest: null },
    { roomNumber: '302', type: 'Premium', floor: 3, status: 'Occupied', guest: 'Jane Doe' }
  ];

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
});


module.exports = router;