const {
  getAllRooms,
  getAvailableRooms,
  addGuest,
  updateRoom,
  getGuestById,
  checkoutGuest,
  addCleaningTask,
  getAllGuests,
  getGuestInRoom
} = require('../utils/jsonHelper');

/**
 * Display check-in page with available rooms
 */
function getCheckInPage(req, res) {
  try {
    const availableRooms = getAvailableRooms();
    
    res.render('receptionist/checkingguests', {
      layout: 'layouts/main',
      title: 'Check-In',
      availableRooms: availableRooms
    });
  } catch (error) {
    console.error('Error loading check-in page:', error);
    res.status(500).render('error', { message: 'Error loading check-in page' });
  }
}

/**
 * Handle guest check-in
 * 1. Validate form data
 * 2. Create guest record in guests.json
 * 3. Mark room as Occupied and link to guest
 */
function handleCheckIn(req, res) {
  try {
    const { firstName, lastName, email, phone, idNumber, checkInDate, checkOutDate, roomSelect } = req.body;
    
    // Validation
    if (!firstName || !lastName || !email || !phone || !idNumber || !checkInDate || !checkOutDate || !roomSelect) {
      return res.status(400).render('receptionist/checkingguests', {
        layout: 'layouts/main',
        title: 'Check-In',
        availableRooms: getAvailableRooms(),
        error: 'All fields are required'
      });
    }
    
    // Check if room is available
    const rooms = getAllRooms();
    const room = rooms.find(r => r.number === roomSelect);
    
    if (!room || room.status !== 'Available') {
      return res.status(400).render('receptionist/checkingguests', {
        layout: 'layouts/main',
        title: 'Check-In',
        availableRooms: getAvailableRooms(),
        error: 'Selected room is not available'
      });
    }
    
    // Create guest record
    const guest = addGuest({
      firstName,
      lastName,
      email,
      phone,
      idNumber,
      checkInDate,
      checkOutDate,
      roomNumber: roomSelect,
      status: 'checked-in'
    });
    
    // Update room status to Occupied
    updateRoom(roomSelect, {
      status: 'Occupied',
      occupiedBy: guest.id,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate
    });
    
    // Redirect to dashboard with success message
    req.session.successMessage = `Guest ${firstName} ${lastName} checked in to Room ${roomSelect}`;
    res.redirect('/receptionist/dashboard');
    
  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).render('receptionist/checkingguests', {
      layout: 'layouts/main',
      title: 'Check-In',
      availableRooms: getAvailableRooms(),
      error: 'Error processing check-in'
    });
  }
}

/**
 * Display checkout page with occupied rooms
 */
function getCheckOutPage(req, res) {
  try {
    const guests = getAllGuests();
    const rooms = getAllRooms();
    
    // Get checked-in guests with their room details
    const occupiedRooms = guests
      .filter(guest => guest.status === 'checked-in')
      .map(guest => {
        const room = rooms.find(r => r.number === guest.roomNumber);
        return {
          guestId: guest.id,
          roomNumber: guest.roomNumber,
          roomType: room?.type || 'Unknown',
          guestName: `${guest.firstName} ${guest.lastName}`,
          checkInDate: guest.checkInDate,
          expectedCheckOutDate: guest.checkOutDate,
          amountDue: room ? room.price * calculateDays(guest.checkInDate, guest.checkOutDate) : 0
        };
      });
    
    res.render('receptionist/checkoutguests', {
      layout: 'layouts/main',
      title: 'Checkout',
      occupiedRooms: occupiedRooms
    });
  } catch (error) {
    console.error('Error loading checkout page:', error);
    res.status(500).render('error', { message: 'Error loading checkout page' });
  }
}

/**
 * Handle guest checkout
 * 1. Update guest status to checked-out
 * 2. Mark room as Needs Cleaning (Cleaning)
 * 3. Create automatic cleaning task for housekeepers
 */
function handleCheckOut(req, res) {
  try {
    const { guestId, roomNumber } = req.body;
    
    if (!guestId || !roomNumber) {
      return res.status(400).redirect('/receptionist/checkoutguests');
    }
    
    // Get guest details
    const guest = getGuestById(guestId);
    if (!guest) {
      return res.status(404).redirect('/receptionist/checkoutguests');
    }
    
    // Checkout guest
    checkoutGuest(guestId);
    
    // Update room status to Cleaning and clear occupancy
    updateRoom(roomNumber, {
      status: 'Cleaning',
      occupiedBy: null,
      checkInDate: null,
      checkOutDate: null
    });
    
    // Create cleaning task for housekeepers
    addCleaningTask({
      roomNumber: roomNumber,
      taskType: 'Checkout Cleaning',
      priority: 'High',
      instructions: `Clean room after guest checkout`
    });
    
    // Redirect with success message
    req.session.successMessage = `Guest ${guest.firstName} ${guest.lastName} checked out from Room ${roomNumber}. Cleaning task created.`;
    res.redirect('/receptionist/checkoutguests');
    
  } catch (error) {
    console.error('Error during checkout:', error);
    res.status(500).redirect('/receptionist/checkoutguests');
  }
}

/**
 * Calculate number of days between two dates
 */
function calculateDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays || 1;
}

module.exports = {
  getCheckInPage,
  handleCheckIn,
  getCheckOutPage,
  handleCheckOut
};
