const express = require('express');
const router = express.Router();

// Dashboard
router.get('/dashboard', (req, res) => {
  res.render('receptionist/dashboard', {
    layout: 'layouts/main',  // ← ADD THIS
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
    layout: 'layouts/main',  // ← ADD THIS
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
    layout: 'layouts/main',  // ← ADD THIS
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

// Placeholder routes for other pages
router.get('/rooms', (req, res) => {
  res.send('Rooms page - TODO: Create rooms.hbs');
});

router.get('/cleaning-requests', (req, res) => {
  res.send('Cleaning Requests page - TODO: Create cleaning-requests.hbs');
});

router.get('/housekeepers', (req, res) => {
  res.send('Housekeepers page - TODO: Create housekeepers.hbs');
});

module.exports = router;