const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const path = require('path');
const { randomUUID } = require('crypto');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireReceptionist, requireAdmin, checkAdmin } = require('../middleware/role.middleware');
const { readJSON, writeJSON } = require('../utils/jsonHelper');
const { calculateRoomStats, getRoomTypeSummary, addRooms } = require('../utils/roomHelper');
const { logActivity, getRecentActivities, formatRelativeTime, ACTIVITY_TYPES } = require('../utils/activityHelper');

// Data file paths
const HOTEL_FILE = path.join(__dirname, '../data/hotel.json');
const ROOMS_FILE = path.join(__dirname, '../data/rooms.json');
const USER_FILE = path.join(__dirname, '../data/user.json');
const GUESTS_FILE = path.join(__dirname, '../data/guests.json');
const CLEANING_TASKS_FILE = path.join(__dirname, '../data/cleaningTasks.json');

// Apply authentication and role middleware to ALL receptionist routes
router.use(requireAuth);
router.use(requireReceptionist);

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const rooms = await readJSON(ROOMS_FILE);
    const guests = await readJSON(GUESTS_FILE) || [];
    const stats = calculateRoomStats(rooms);
    
    // Get recent activities
    const activities = await getRecentActivities(hotel?.id, 20);
    const recentActivities = activities.map(a => ({
      type: a.type,
      description: a.description,
      details: a.details,
      time: formatRelativeTime(a.createdAt)
    }));
    
    // Calculate occupancy data for the last 7 days
    const occupancyData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count guests that were occupying a room on this day
      const checkedInOnDay = guests.filter(g => {
        // Get check-in date (just the date portion)
        const checkInDate = g.checkInDate?.split('T')[0];
        
        // Get check-out date - use actual if checked out, otherwise expected
        let checkOutDate;
        if (g.status === 'checked-out' && g.actualCheckOutDate) {
          checkOutDate = g.actualCheckOutDate.split('T')[0];
        } else if (g.expectedCheckOutDate) {
          checkOutDate = g.expectedCheckOutDate.split('T')[0];
        } else {
          // If no checkout date, assume still in
          checkOutDate = '9999-12-31';
        }
        
        // Guest was in the room if: checkIn <= date <= checkOut
        return checkInDate && checkInDate <= dateStr && checkOutDate >= dateStr;
      }).length;
      
      // Calculate occupancy percentage
      const occupancyPercent = stats.totalRooms > 0 
        ? Math.round((checkedInOnDay / stats.totalRooms) * 100) 
        : 0;
      
      occupancyData.push({
        date: dateStr,
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        occupancy: occupancyPercent
      });
    }
    
    res.render('receptionist/dashboard', {
      layout: 'layouts/main',
      title: 'Dashboard',
      hotelName: hotel?.name || 'StaySync',
      userName: req.session.name,
      userInitial: (req.session.name || 'R').charAt(0).toUpperCase(),
      totalRooms: stats.totalRooms,
      roomsReady: stats.availableRooms,
      pendingCleaning: stats.cleaningRooms,
      occupied: stats.occupiedRooms,
      recentActivities,
      occupancyData: JSON.stringify(occupancyData)
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.render('receptionist/dashboard', {
      layout: 'layouts/main',
      title: 'Dashboard',
      hotelName: 'StaySync',
      totalRooms: 0,
      roomsReady: 0,
      pendingCleaning: 0,
      occupied: 0,
      recentActivities: [],
      occupancyData: '[]'
    });
  }
});

// Check-in page (GET)
router.get('/checkingguests', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const rooms = await readJSON(ROOMS_FILE);
    
    // Get only available rooms
    const availableRooms = rooms
      .filter(r => r.status === 'Available')
      .map(r => ({
        number: r.roomNumber,
        type: r.type,
        price: r.price || 100,
        id: r.id
      }));
    
    // Get unique room types from available rooms
    const roomTypes = [...new Set(availableRooms.map(r => r.type))];
    
    // Group rooms by type with count
    const roomTypeStats = roomTypes.map(type => ({
      name: type,
      count: availableRooms.filter(r => r.type === type).length,
      minPrice: Math.min(...availableRooms.filter(r => r.type === type).map(r => r.price))
    }));
    
    res.render('receptionist/checkingguests', {
      layout: 'layouts/main',
      title: 'Check-In',
      hotelName: hotel?.name || 'StaySync',
      userInitial: (req.session.name || 'R').charAt(0).toUpperCase(),
      availableRooms,
      availableRoomsJSON: JSON.stringify(availableRooms),
      roomTypes,
      roomTypeStats,
      totalAvailable: availableRooms.length,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('Error loading check-in page:', error);
    res.render('receptionist/checkingguests', {
      layout: 'layouts/main',
      title: 'Check-In',
      hotelName: 'StaySync',
      userInitial: 'R',
      availableRooms: [],
      availableRoomsJSON: '[]',
      roomTypes: [],
      roomTypeStats: [],
      totalAvailable: 0,
      error: 'Failed to load available rooms'
    });
  }
});

// Check-in form submission (POST)
router.post('/checkin', async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, idNumber, 
      checkInDate, checkOutDate, roomSelect,
      additionalGuests // JSON string of additional guests
    } = req.body;
    
    // Validate required fields for primary guest
    if (!firstName || !lastName || !email || !phone || !idNumber || !checkInDate || !checkOutDate || !roomSelect) {
      return res.redirect('/receptionist/checkingguests?error=All fields are required');
    }
    
    const hotel = await readJSON(HOTEL_FILE);
    const rooms = await readJSON(ROOMS_FILE);
    const guests = await readJSON(GUESTS_FILE) || [];
    
    // Find the selected room
    const roomIndex = rooms.findIndex(r => r.roomNumber === roomSelect);
    if (roomIndex === -1) {
      return res.redirect('/receptionist/checkingguests?error=Room not found');
    }
    
    if (rooms[roomIndex].status !== 'Available') {
      return res.redirect('/receptionist/checkingguests?error=Room is no longer available');
    }
    
    const guestName = `${firstName} ${lastName}`;
    
    // Parse additional guests if provided
    let parsedAdditionalGuests = [];
    if (additionalGuests) {
      try {
        parsedAdditionalGuests = JSON.parse(additionalGuests);
      } catch (e) {
        console.error('Error parsing additional guests:', e);
      }
    }
    
    // Calculate number of adults and children
    const adults = 1 + parsedAdditionalGuests.filter(g => g.isAdult).length;
    const children = parsedAdditionalGuests.filter(g => !g.isAdult).length;
    
    // Create new guest record
    const newGuest = {
      id: `guest-${randomUUID()}`,
      firstName,
      lastName,
      fullName: guestName,
      email,
      phone,
      idNumber,
      roomId: rooms[roomIndex].id,
      roomNumber: roomSelect,
      roomType: rooms[roomIndex].type,
      roomPrice: rooms[roomIndex].price || 100,
      checkInDate,
      expectedCheckOutDate: checkOutDate,
      actualCheckOutDate: null,
      status: 'checked-in',
      adults,
      children,
      totalGuests: adults + children,
      additionalGuests: parsedAdditionalGuests,
      hotelId: hotel?.id || null,
      checkedInBy: req.session.userId,
      checkedInByName: req.session.name,
      createdAt: new Date().toISOString()
    };
    
    // Update room status
    rooms[roomIndex].status = 'Occupied';
    rooms[roomIndex].guestId = newGuest.id;
    rooms[roomIndex].guestName = guestName;
    rooms[roomIndex].checkInDate = checkInDate;
    rooms[roomIndex].expectedCheckOutDate = checkOutDate;
    rooms[roomIndex].totalGuests = adults + children;
    
    // Save both
    guests.push(newGuest);
    await writeJSON(GUESTS_FILE, guests);
    await writeJSON(ROOMS_FILE, rooms);
    
    // Log activity
    const guestDetails = `${adults} adult${adults !== 1 ? 's' : ''}${children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}`;
    await logActivity({
      type: ACTIVITY_TYPES.CHECK_IN,
      description: 'Guest Check-In',
      details: `Room ${roomSelect} • ${guestName} (${guestDetails})`,
      userId: req.session.userId,
      userName: req.session.name,
      hotelId: hotel?.id || null
    });
    
    res.redirect('/receptionist/checkingguests?success=Guest checked in successfully');
  } catch (error) {
    console.error('Error processing check-in:', error);
    res.redirect('/receptionist/checkingguests?error=Failed to process check-in');
  }
});

// Checkout page (GET)
router.get('/checkoutguests', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const rooms = await readJSON(ROOMS_FILE);
    const guests = await readJSON(GUESTS_FILE) || [];
    
    // Get occupied rooms with guest details
    const occupiedRooms = rooms
      .filter(r => r.status === 'Occupied' && r.guestId)
      .map(r => {
        const guest = guests.find(g => g.id === r.guestId);
        // Calculate nights stayed and amount due
        const checkIn = new Date(r.checkInDate);
        const expectedCheckOut = new Date(r.expectedCheckOutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Calculate expected nights
        const expectedNights = Math.ceil((expectedCheckOut - checkIn) / (1000 * 60 * 60 * 24));
        
        // Calculate actual nights until today (if checking out early/late)
        const actualNights = Math.max(1, Math.ceil((today - checkIn) / (1000 * 60 * 60 * 24)));
        
        const pricePerNight = r.price || 100;
        const expectedAmount = expectedNights * pricePerNight;
        const actualAmount = actualNights * pricePerNight;
        
        // Determine if early or late checkout
        const isEarly = actualNights < expectedNights;
        const isLate = actualNights > expectedNights;
        
        // Build guests list for display
        const allGuests = [];
        if (guest) {
          allGuests.push({
            fullName: guest.fullName,
            email: guest.email,
            phone: guest.phone,
            idNumber: guest.idNumber,
            isPrimary: true,
            isAdult: true
          });
          if (guest.additionalGuests && guest.additionalGuests.length > 0) {
            guest.additionalGuests.forEach(ag => {
              allGuests.push({
                fullName: ag.fullName || `${ag.firstName || ''} ${ag.lastName || ''}`.trim(),
                email: ag.email || '',
                phone: ag.phone || '',
                idNumber: ag.idNumber || '',
                isPrimary: false,
                isAdult: ag.isAdult !== false
              });
            });
          }
        }
        
        // Build display name with ellipsis if multiple guests
        let guestDisplayName = r.guestName || 'Unknown Guest';
        if (allGuests.length > 1) {
          guestDisplayName = `${allGuests[0].fullName} +${allGuests.length - 1} more`;
        }
        
        return {
          roomNumber: r.roomNumber,
          roomId: r.id,
          guestName: r.guestName || 'Unknown Guest',
          guestDisplayName,
          guestId: r.guestId,
          roomType: r.type,
          checkInDate: r.checkInDate,
          expectedCheckOutDate: r.expectedCheckOutDate,
          expectedNights,
          actualNights,
          pricePerNight,
          expectedAmount,
          actualAmount,
          isEarly,
          isLate,
          totalGuests: r.totalGuests || 1,
          allGuests,
          allGuestsJSON: JSON.stringify(allGuests)
        };
      });
    
    res.render('receptionist/checkoutguests', {
      layout: 'layouts/main',
      title: 'Checkout',
      hotelName: hotel?.name || 'StaySync',
      userInitial: (req.session.name || 'R').charAt(0).toUpperCase(),
      occupiedRooms,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    console.error('Error loading checkout page:', error);
    res.render('receptionist/checkoutguests', {
      layout: 'layouts/main',
      title: 'Checkout',
      hotelName: 'StaySync',
      userInitial: 'R',
      occupiedRooms: [],
      error: 'Failed to load occupied rooms'
    });
  }
});

// Checkout form submission (POST)
router.post('/checkout', async (req, res) => {
  try {
    const { guestId, roomNumber } = req.body;
    
    if (!guestId || !roomNumber) {
      return res.redirect('/receptionist/checkoutguests?error=Invalid checkout request');
    }
    
    const hotel = await readJSON(HOTEL_FILE);
    const rooms = await readJSON(ROOMS_FILE);
    const guests = await readJSON(GUESTS_FILE) || [];
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];
    const users = await readJSON(USER_FILE) || [];
    
    // Find the room and guest
    const roomIndex = rooms.findIndex(r => r.roomNumber === roomNumber);
    const guestIndex = guests.findIndex(g => g.id === guestId);
    
    if (roomIndex === -1) {
      return res.redirect('/receptionist/checkoutguests?error=Room not found');
    }
    
    const guestName = rooms[roomIndex].guestName || 'Guest';
    
    // Update guest status
    if (guestIndex !== -1) {
      guests[guestIndex].status = 'checked-out';
      guests[guestIndex].actualCheckOutDate = new Date().toISOString();
      guests[guestIndex].checkedOutBy = req.session.userId;
      guests[guestIndex].checkedOutByName = req.session.name;
    }
    
    // Update room status to Cleaning
    rooms[roomIndex].status = 'Cleaning';
    rooms[roomIndex].guestId = null;
    rooms[roomIndex].guestName = null;
    rooms[roomIndex].checkInDate = null;
    rooms[roomIndex].expectedCheckOutDate = null;
    
    // Auto-assign to active housekeeper with lowest workload
    const activeHousekeepers = users.filter(u => u.role === 'housekeeper' && u.isActive);
    let assignedHousekeeper = null;
    
    if (activeHousekeepers.length > 0) {
      const housekeeperWorkloads = activeHousekeepers.map(h => {
        const pendingTasks = cleaningTasks.filter(t => 
          t.assignedTo === h.id && t.status !== 'Completed'
        ).length;
        return { housekeeper: h, pendingTasks };
      });
      
      // Sort by pending tasks (ascending) and pick the first one
      housekeeperWorkloads.sort((a, b) => a.pendingTasks - b.pendingTasks);
      assignedHousekeeper = housekeeperWorkloads[0].housekeeper;
    }
    
    // Create cleaning task with auto-assignment
    const cleaningTask = {
      id: `task-${randomUUID()}`,
      roomId: rooms[roomIndex].id,
      roomNumber,
      serviceType: 'Checkout Cleaning',
      priority: 'High',
      status: 'Pending',
      instructions: 'Full room cleaning after checkout',
      assignedTo: assignedHousekeeper?.id || null,
      assignedToName: assignedHousekeeper?.name || null,
      assignedAt: assignedHousekeeper ? new Date().toISOString() : null,
      createdBy: req.session.userId,
      createdByName: req.session.name,
      hotelId: hotel?.id || null,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    cleaningTasks.push(cleaningTask);
    
    // Save all changes
    await writeJSON(ROOMS_FILE, rooms);
    await writeJSON(GUESTS_FILE, guests);
    await writeJSON(CLEANING_TASKS_FILE, cleaningTasks);
    
    // Log checkout activity
    await logActivity({
      type: ACTIVITY_TYPES.CHECK_OUT,
      description: 'Guest Check-Out',
      details: `Room ${roomNumber} • ${guestName}`,
      userId: req.session.userId,
      userName: req.session.name,
      hotelId: hotel?.id || null
    });
    
    // Log cleaning assignment activity if a housekeeper was assigned
    if (assignedHousekeeper) {
      await logActivity({
        type: ACTIVITY_TYPES.CLEANING_ASSIGNED,
        description: 'Cleaning Assigned',
        details: `Room ${roomNumber} • ${assignedHousekeeper.name}`,
        userId: req.session.userId,
        userName: req.session.name,
        hotelId: hotel?.id || null
      });
    }
    
    res.redirect('/receptionist/checkoutguests?success=Guest checked out successfully');
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.redirect('/receptionist/checkoutguests?error=Failed to process checkout');
  }
});

// Cleaning Requests page (GET)
router.get('/cleaning-requests', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];
    
    // Map cleaning tasks to display format
    const cleaningRequests = cleaningTasks.map(task => ({
      id: task.id,
      roomNumber: task.roomNumber || null,
      location: task.location || null,
      serviceType: task.serviceType,
      instructions: task.instructions || '',
      priority: task.priority,
      status: task.status,
      assignedTo: task.assignedTo ? {
        name: task.assignedToName || 'Unknown',
        initials: (task.assignedToName || 'U').split(' ').map(n => n[0]).join('')
      } : null,
      time: task.createdAt ? new Date(task.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown'
    }));
    
    // Count only active (non-completed) requests
    const activeRequests = cleaningTasks.filter(t => t.status !== 'Completed').length;

    res.render('receptionist/cleaning-requests', {
      layout: 'layouts/main',
      title: 'Cleaning Requests',
      hotelName: hotel?.name || 'StaySync',
      userInitial: (req.session.name || 'R').charAt(0).toUpperCase(),
      cleaningRequests,
      activeRequests
    });
  } catch (error) {
    console.error('Error loading cleaning requests:', error);
    res.render('receptionist/cleaning-requests', {
      layout: 'layouts/main',
      title: 'Cleaning Requests',
      hotelName: 'StaySync',
      userInitial: 'R',
      cleaningRequests: [],
      totalRequests: 0
    });
  }
});

// Cleaning Requests form submission (POST)
router.post('/cleaning-requests', async (req, res) => {
  try {
    const { roomNumber, location, priority, instructions } = req.body;
    const users = await readJSON(USER_FILE);
    const cleaningTasks = await readJSON(CLEANING_TASKS_FILE) || [];
    const hotel = await readJSON(HOTEL_FILE);
    
    // Get active housekeepers
    const activeHousekeepers = users.filter(u => u.role === 'housekeeper' && u.isActive);
    
    // Find housekeeper with lowest workload (fewest pending tasks)
    let assignedHousekeeper = null;
    if (activeHousekeepers.length > 0) {
      const housekeeperWorkloads = activeHousekeepers.map(h => {
        const pendingTasks = cleaningTasks.filter(t => 
          t.assignedTo === h.id && t.status !== 'Completed'
        ).length;
        return { housekeeper: h, pendingTasks };
      });
      
      // Sort by pending tasks (ascending) and pick the first one
      housekeeperWorkloads.sort((a, b) => a.pendingTasks - b.pendingTasks);
      assignedHousekeeper = housekeeperWorkloads[0].housekeeper;
    }
    
    // Create new cleaning task
    const newTask = {
      id: randomUUID(),
      roomNumber: roomNumber || null,
      location: location || null,
      serviceType: 'Standard Cleaning',
      priority: priority || 'Low',
      status: 'Pending',
      instructions: instructions || '',
      assignedTo: assignedHousekeeper?.id || null,
      assignedToName: assignedHousekeeper?.name || null,
      assignedAt: assignedHousekeeper ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      createdBy: req.session.userId,
      createdByName: req.session.name
    };
    
    cleaningTasks.push(newTask);
    await writeJSON(CLEANING_TASKS_FILE, cleaningTasks);
    
    // Log activity
    const locationDisplay = roomNumber ? `Room ${roomNumber}` : location;
    await logActivity({
      type: ACTIVITY_TYPES.CLEANING_ASSIGNED,
      description: 'Cleaning Request Created',
      details: `${locationDisplay} • ${assignedHousekeeper ? `Assigned to ${assignedHousekeeper.name}` : 'Unassigned'}`,
      userId: req.session.userId,
      userName: req.session.name,
      hotelId: hotel?.id || null
    });
    
    res.redirect('/receptionist/cleaning-requests');
  } catch (error) {
    console.error('Error creating cleaning request:', error);
    res.redirect('/receptionist/cleaning-requests');
  }
});


// Rooms page (GET)
router.get('/rooms', async (req, res) => {
  try {
    // Read rooms from JSON file
    const rooms = await readJSON(ROOMS_FILE);
    const hotel = await readJSON(HOTEL_FILE);
    const guests = await readJSON(GUESTS_FILE) || [];
    
    // Calculate summary counts
    const stats = calculateRoomStats(rooms);

    res.render('receptionist/rooms', {
      layout: 'layouts/main',
      title: 'Room Management',
      hotelName: hotel?.name || 'StaySync',
      userInitial: (req.session.name || 'R').charAt(0).toUpperCase(),
      rooms: rooms.map(r => {
        // Find guest for this room
        const guest = guests.find(g => g.id === r.guestId && g.status === 'checked-in');
        let guestDisplay = null;
        
        if (guest) {
          // Build list of all guest names
          const allNames = [guest.fullName];
          if (guest.additionalGuests && guest.additionalGuests.length > 0) {
            guest.additionalGuests.forEach(ag => {
              if (ag.fullName) allNames.push(ag.fullName);
            });
          }
          guestDisplay = allNames.join(', ');
        }
        
        return {
          roomNumber: r.roomNumber,
          type: r.type,
          status: r.status,
          guest: guestDisplay || r.guestName || null,
          guestId: r.guestId || null
        };
      }),
      totalRooms: stats.totalRooms,
      availableRooms: stats.availableRooms,
      occupiedRooms: stats.occupiedRooms,
      cleaningRooms: stats.cleaningRooms,
      maintenanceRooms: stats.maintenanceRooms
    });
  } catch (error) {
    console.error('Error loading rooms:', error);
    res.render('receptionist/rooms', {
      layout: 'layouts/main',
      title: 'Room Management',
      hotelName: 'StaySync',
      rooms: [],
      totalRooms: 0,
      availableRooms: 0,
      occupiedRooms: 0,
      cleaningRooms: 0,
      maintenanceRooms: 0
    });
  }
});


// ================= SETTINGS ROUTES =================

// Settings page (GET)
router.get('/settings', async (req, res) => {
  try {
    const hotel = await readJSON(HOTEL_FILE);
    const rooms = await readJSON(ROOMS_FILE);
    const users = await readJSON(USER_FILE);
    
    const user = users.find(u => u.id === req.session.userId);
    const remainingCodes = user?.recoveryCodes?.filter(rc => !rc.used).length || 0;
    const roomTypeSummary = getRoomTypeSummary(rooms);
    
    res.render('receptionist/settings', {
      layout: 'layouts/main',
      title: 'Settings',
      hotelName: hotel?.name || 'StaySync',
      userName: user?.name || req.session.name,
      username: req.session.username,
      userInitial: (req.session.name || 'R').charAt(0).toUpperCase(),
      isAdmin: req.session.isAdmin || false,
      roomTypeSummary: roomTypeSummary,
      totalRooms: rooms.length,
      remainingCodes: remainingCodes,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.redirect('/receptionist/dashboard');
  }
});

// Update profile (POST)
router.post('/settings/profile', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.redirect('/receptionist/settings?error=Name is required');
    }
    
    const users = await readJSON(USER_FILE);
    const userIndex = users.findIndex(u => u.id === req.session.userId);
    
    if (userIndex === -1) {
      return res.redirect('/receptionist/settings?error=User not found');
    }
    
    users[userIndex].name = name.trim();
    await writeJSON(USER_FILE, users);
    
    // Update session
    req.session.name = name.trim();
    
    res.redirect('/receptionist/settings?success=Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.redirect('/receptionist/settings?error=Failed to update profile');
  }
});

// Update hotel name (POST) - Admin only
router.post('/settings/hotel', requireAdmin, async (req, res) => {
  try {
    const { hotelName } = req.body;
    
    if (!hotelName || !hotelName.trim()) {
      return res.redirect('/receptionist/settings?error=Hotel name is required');
    }
    
    const hotel = await readJSON(HOTEL_FILE);
    hotel.name = hotelName.trim();
    hotel.updatedAt = new Date().toISOString();
    
    await writeJSON(HOTEL_FILE, hotel);
    
    res.redirect('/receptionist/settings?success=Hotel name updated successfully');
  } catch (error) {
    console.error('Error updating hotel:', error);
    res.redirect('/receptionist/settings?error=Failed to update hotel name');
  }
});

// Add rooms (POST) - Admin only
router.post('/settings/add-rooms', requireAdmin, async (req, res) => {
  try {
    const { roomTypes } = req.body;
    
    // Calculate total new rooms
    const totalNewRooms = roomTypes ? roomTypes.reduce((sum, rt) => sum + (parseInt(rt.count) || 0), 0) : 0;
    
    if (totalNewRooms === 0) {
      return res.redirect('/receptionist/settings?error=Please specify at least one room to add');
    }
    
    // Read existing rooms and add new ones
    const existingRooms = await readJSON(ROOMS_FILE);
    const newRooms = addRooms(existingRooms, roomTypes.filter(rt => parseInt(rt.count) > 0));
    
    await writeJSON(ROOMS_FILE, newRooms);
    
    // Update hotel config with new room type counts
    const hotel = await readJSON(HOTEL_FILE);
    const roomTypeSummary = getRoomTypeSummary(newRooms);
    hotel.roomTypes = roomTypeSummary;
    hotel.updatedAt = new Date().toISOString();
    await writeJSON(HOTEL_FILE, hotel);
    
    res.redirect(`/receptionist/settings?success=Successfully added ${totalNewRooms} new room(s)`);
  } catch (error) {
    console.error('Error adding rooms:', error);
    res.redirect('/receptionist/settings?error=Failed to add rooms');
  }
});

// Adjust existing rooms (POST) - Admin only
router.post('/settings/adjust-rooms', requireAdmin, async (req, res) => {
  try {
    const { roomTypes } = req.body;
    
    if (!roomTypes || !Array.isArray(roomTypes)) {
      return res.redirect('/receptionist/settings?error=Invalid room data');
    }
    
    const existingRooms = await readJSON(ROOMS_FILE);
    const hotel = await readJSON(HOTEL_FILE);
    
    let updatedRooms = [...existingRooms];
    let totalAdded = 0;
    let totalRemoved = 0;
    
    for (const rt of roomTypes) {
      const typeName = rt.name;
      const newCount = parseInt(rt.count) || 0;
      
      // Get current rooms of this type
      const currentTypeRooms = updatedRooms.filter(r => r.type === typeName);
      const currentCount = currentTypeRooms.length;
      
      if (newCount > currentCount) {
        // Add more rooms of this type
        const toAdd = newCount - currentCount;
        const newRoomsOfType = addRooms(updatedRooms, [{ name: typeName, count: toAdd }]);
        updatedRooms = newRoomsOfType;
        totalAdded += toAdd;
      } else if (newCount < currentCount) {
        // Remove rooms of this type (only if not occupied)
        const toRemove = currentCount - newCount;
        const availableToRemove = currentTypeRooms
          .filter(r => r.status === 'Available')
          .slice(0, toRemove);
        
        const idsToRemove = new Set(availableToRemove.map(r => r.id));
        updatedRooms = updatedRooms.filter(r => !idsToRemove.has(r.id));
        totalRemoved += availableToRemove.length;
      }
    }
    
    await writeJSON(ROOMS_FILE, updatedRooms);
    
    // Update hotel config
    const roomTypeSummary = getRoomTypeSummary(updatedRooms);
    hotel.roomTypes = roomTypeSummary;
    hotel.updatedAt = new Date().toISOString();
    await writeJSON(HOTEL_FILE, hotel);
    
    let message = 'Room counts updated';
    if (totalAdded > 0) message += `, ${totalAdded} added`;
    if (totalRemoved > 0) message += `, ${totalRemoved} removed`;
    
    res.redirect(`/receptionist/settings?success=${encodeURIComponent(message)}`);
  } catch (error) {
    console.error('Error adjusting rooms:', error);
    res.redirect('/receptionist/settings?error=Failed to adjust room counts');
  }
});

// Update room pricing (POST) - Admin only
router.post('/settings/pricing', requireAdmin, async (req, res) => {
  try {
    const { pricing } = req.body;
    
    if (!pricing || !Array.isArray(pricing)) {
      return res.redirect('/receptionist/settings?error=Invalid pricing data');
    }
    
    const rooms = await readJSON(ROOMS_FILE);
    const hotel = await readJSON(HOTEL_FILE);
    
    // Update each room's price based on its type
    pricing.forEach(p => {
      const typeName = p.name;
      const newPrice = parseInt(p.price) || 100;
      
      rooms.forEach(room => {
        if (room.type === typeName) {
          room.price = newPrice;
        }
      });
    });
    
    await writeJSON(ROOMS_FILE, rooms);
    
    // Update hotel config
    const roomTypeSummary = getRoomTypeSummary(rooms);
    hotel.roomTypes = roomTypeSummary;
    hotel.updatedAt = new Date().toISOString();
    await writeJSON(HOTEL_FILE, hotel);
    
    res.redirect('/receptionist/settings?success=Room pricing updated successfully');
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.redirect('/receptionist/settings?error=Failed to update pricing');
  }
});

// Regenerate recovery codes (POST)
router.post('/settings/regenerate-codes', async (req, res) => {
  try {
    const users = await readJSON(USER_FILE);
    const userIndex = users.findIndex(u => u.id === req.session.userId);
    
    if (userIndex === -1) {
      return res.redirect('/receptionist/settings?error=User not found');
    }
    
    // Generate new recovery codes
    const recoveryCodes = [];
    for (let i = 0; i < 5; i++) {
      const code = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                   Math.random().toString(36).substring(2, 6).toUpperCase();
      const hashedCode = await bcrypt.hash(code, 10);
      recoveryCodes.push({
        code: code,
        hashedCode: hashedCode,
        used: false
      });
    }
    
    // Update user with new codes
    users[userIndex].recoveryCodes = recoveryCodes.map(rc => ({ hashedCode: rc.hashedCode, used: false }));
    await writeJSON(USER_FILE, users);
    
    // Store plain codes in session for display
    req.session.newRecoveryCodes = recoveryCodes.map(rc => rc.code);
    
    res.redirect('/receptionist/settings/new-codes');
  } catch (error) {
    console.error('Error regenerating codes:', error);
    res.redirect('/receptionist/settings?error=Failed to regenerate codes');
  }
});

// Show new recovery codes (GET)
router.get('/settings/new-codes', async (req, res) => {
  const codes = req.session.newRecoveryCodes;
  
  if (!codes || codes.length === 0) {
    return res.redirect('/receptionist/settings');
  }
  
  // Clear codes from session after displaying
  delete req.session.newRecoveryCodes;
  
  const hotel = await readJSON(HOTEL_FILE);
  
  res.render('auth/recovery-codes', {
    title: 'New Recovery Codes - StaySync',
    codes: codes,
    username: req.session.username,
    hotelName: hotel?.name || 'StaySync',
    isRegeneration: true
  });
});


module.exports = router;
