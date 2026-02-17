/**
 * Room Helper Utility
 * Handles room generation and management logic
 */
const { v4: uuidv4 } = require('uuid');

/**
 * Generate rooms based on room type configuration
 * @param {Array} roomTypes - Array of {name: string, count: number}
 * @returns {Array} Array of room objects
 */
function generateRooms(roomTypes) {
  const rooms = [];
  let floor = 1;
  let roomsOnFloor = 0;
  const maxRoomsPerFloor = 10;

  roomTypes.forEach(type => {
    const count = parseInt(type.count) || 0;
    
    for (let i = 0; i < count; i++) {
      // Move to next floor if current floor is full
      if (roomsOnFloor >= maxRoomsPerFloor) {
        floor++;
        roomsOnFloor = 0;
      }

      // Generate room number: floor + 2-digit room number (e.g., 101, 102, 201)
      const roomNumberOnFloor = (roomsOnFloor + 1).toString().padStart(2, '0');
      const roomNumber = `${floor}${roomNumberOnFloor}`;

      rooms.push({
        id: `room-${uuidv4()}`,
        roomNumber: roomNumber,
        type: type.name,
        floor: floor,
        status: 'Available', // Available, Occupied, Cleaning, Maintenance
        guestId: null,
        guestName: null,
        checkInDate: null,
        expectedCheckOutDate: null,
        price: getRoomPrice(type.name),
        createdAt: new Date().toISOString()
      });

      roomsOnFloor++;
    }
  });

  return rooms;
}

/**
 * Get room price based on type
 * @param {string} typeName - Room type name
 * @returns {number} Price per night
 */
function getRoomPrice(typeName) {
  const prices = {
    'Standard': 150,
    'Deluxe': 250,
    'Suite': 400
  };
  return prices[typeName] || 150;
}

/**
 * Get room status color class
 * @param {string} status - Room status
 * @returns {string} Tailwind CSS class
 */
function getRoomStatusClass(status) {
  const classes = {
    'Available': 'bg-green-100 text-green-700',
    'Occupied': 'bg-blue-100 text-blue-700',
    'Cleaning': 'bg-orange-100 text-orange-700',
    'Maintenance': 'bg-red-100 text-red-700'
  };
  return classes[status] || 'bg-gray-100 text-gray-700';
}

/**
 * Calculate room statistics
 * @param {Array} rooms - Array of room objects
 * @returns {Object} Statistics object
 */
function calculateRoomStats(rooms) {
  return {
    totalRooms: rooms.length,
    availableRooms: rooms.filter(r => r.status === 'Available').length,
    occupiedRooms: rooms.filter(r => r.status === 'Occupied').length,
    cleaningRooms: rooms.filter(r => r.status === 'Cleaning').length,
    maintenanceRooms: rooms.filter(r => r.status === 'Maintenance').length
  };
}

/**
 * Get room types summary from rooms array
 * @param {Array} rooms - Array of room objects
 * @returns {Array} Array of {name, count, price} objects
 */
function getRoomTypeSummary(rooms) {
  const typeData = {};
  
  rooms.forEach(room => {
    if (!typeData[room.type]) {
      typeData[room.type] = { count: 0, price: room.price || 100 };
    }
    typeData[room.type].count++;
    // Use the first room's price as the type price (they should all be the same)
    if (room.price) {
      typeData[room.type].price = room.price;
    }
  });

  return Object.entries(typeData).map(([name, data]) => ({ 
    name, 
    count: data.count, 
    price: data.price 
  }));
}

/**
 * Add new rooms to existing rooms array
 * @param {Array} existingRooms - Current rooms
 * @param {Array} newRoomTypes - New room types to add
 * @returns {Array} Combined rooms array
 */
function addRooms(existingRooms, newRoomTypes) {
  // Find the highest floor and room number
  let maxFloor = 1;
  let maxRoomOnFloor = {};

  existingRooms.forEach(room => {
    const floor = room.floor;
    if (floor > maxFloor) maxFloor = floor;
    
    if (!maxRoomOnFloor[floor]) maxRoomOnFloor[floor] = 0;
    const roomNum = parseInt(room.roomNumber.slice(-2));
    if (roomNum > maxRoomOnFloor[floor]) maxRoomOnFloor[floor] = roomNum;
  });

  const newRooms = [];
  let currentFloor = maxFloor;
  let roomsOnFloor = maxRoomOnFloor[currentFloor] || 0;
  const maxRoomsPerFloor = 10;

  newRoomTypes.forEach(type => {
    const count = parseInt(type.count) || 0;
    
    for (let i = 0; i < count; i++) {
      if (roomsOnFloor >= maxRoomsPerFloor) {
        currentFloor++;
        roomsOnFloor = 0;
      }

      roomsOnFloor++;
      const roomNumberOnFloor = roomsOnFloor.toString().padStart(2, '0');
      const roomNumber = `${currentFloor}${roomNumberOnFloor}`;

      newRooms.push({
        id: `room-${uuidv4()}`,
        roomNumber: roomNumber,
        type: type.name,
        floor: currentFloor,
        status: 'Available',
        guestId: null,
        guestName: null,
        checkInDate: null,
        expectedCheckOutDate: null,
        price: getRoomPrice(type.name),
        createdAt: new Date().toISOString()
      });
    }
  });

  return [...existingRooms, ...newRooms];
}

module.exports = {
  generateRooms,
  getRoomPrice,
  getRoomStatusClass,
  calculateRoomStats,
  getRoomTypeSummary,
  addRooms
};
