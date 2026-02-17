const fs = require('fs');
const path = require('path');

/**
 * Read a JSON file and return parsed data
 * @param {string} filename - Name of the JSON file in data folder
 * @returns {Array|Object} - Parsed JSON data
 */
function readJsonFile(filename) {
  try {
    const filePath = path.join(__dirname, `../data/${filename}`);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return filename.includes('guest') || filename.includes('task') ? [] : {};
  }
}

/**
 * Write data to a JSON file
 * @param {string} filename - Name of the JSON file in data folder
 * @param {Array|Object} data - Data to write
 * @returns {boolean} - Success status
 */
function writeJsonFile(filename, data) {
  try {
    const filePath = path.join(__dirname, `../data/${filename}`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error.message);
    return false;
  }
}

/**
 * Get all guests from guests.json
 * @returns {Array} - Array of guest objects
 */
function getAllGuests() {
  return readJsonFile('guests.json');
}

/**
 * Add a new guest to guests.json
 * @param {Object} guest - Guest object with firstName, lastName, email, phone, idNumber, checkInDate, checkOutDate, roomNumber
 * @returns {Object} - The created guest with generated ID and timestamps
 */
function addGuest(guest) {
  const guests = getAllGuests();
  const guestId = `guest-${Date.now()}`;
  const newGuest = {
    id: guestId,
    ...guest,
    createdAt: new Date().toISOString()
  };
  guests.push(newGuest);
  writeJsonFile('guests.json', guests);
  return newGuest;
}

/**
 * Get all rooms from rooms.json
 * @returns {Array} - Array of room objects
 */
function getAllRooms() {
  return readJsonFile('rooms.json');
}

/**
 * Get available rooms
 * @returns {Array} - Array of available rooms
 */
function getAvailableRooms() {
  const rooms = getAllRooms();
  return rooms.filter(room => room.status === 'Available');
}

/**
 * Update room status
 * @param {string} roomNumber - Room number
 * @param {Object} updates - Updates to apply (status, occupiedBy, checkInDate, checkOutDate)
 * @returns {boolean} - Success status
 */
function updateRoom(roomNumber, updates) {
  const rooms = getAllRooms();
  const roomIndex = rooms.findIndex(r => r.number === roomNumber);
  
  if (roomIndex === -1) {
    console.error(`Room ${roomNumber} not found`);
    return false;
  }
  
  rooms[roomIndex] = { ...rooms[roomIndex], ...updates };
  return writeJsonFile('rooms.json', rooms);
}

/**
 * Get all cleaning tasks
 * @returns {Array} - Array of cleaning task objects
 */
function getAllCleaningTasks() {
  return readJsonFile('cleaningTasks.json');
}

/**
 * Add a new cleaning task
 * @param {Object} task - Task object with roomNumber, taskType, priority, status
 * @returns {Object} - The created task with generated ID and timestamps
 */
function addCleaningTask(task) {
  const tasks = getAllCleaningTasks();
  const taskId = `task-${Date.now()}`;
  const newTask = {
    id: taskId,
    ...task,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };
  tasks.push(newTask);
  writeJsonFile('cleaningTasks.json', tasks);
  return newTask;
}

/**
 * Get guest by ID
 * @param {string} guestId - Guest ID
 * @returns {Object|null} - Guest object or null if not found
 */
function getGuestById(guestId) {
  const guests = getAllGuests();
  return guests.find(g => g.id === guestId) || null;
}

/**
 * Get guests currently in a room
 * @param {string} roomNumber - Room number
 * @returns {Object|null} - Guest object or null if no guest in room
 */
function getGuestInRoom(roomNumber) {
  const guests = getAllGuests();
  return guests.find(g => g.roomNumber === roomNumber && g.status !== 'checked-out') || null;
}

/**
 * Update guest checkout
 * @param {string} guestId - Guest ID
 * @returns {boolean} - Success status
 */
function checkoutGuest(guestId) {
  const guests = getAllGuests();
  const guestIndex = guests.findIndex(g => g.id === guestId);
  
  if (guestIndex === -1) {
    console.error(`Guest ${guestId} not found`);
    return false;
  }
  
  guests[guestIndex].status = 'checked-out';
  guests[guestIndex].actualCheckOutDate = new Date().toISOString();
  return writeJsonFile('guests.json', guests);
}

/**
 * Update a cleaning task
 * @param {string} taskId - Task ID
 * @param {Object} updates - Updates to apply (status, completedDate, etc.)
 * @returns {boolean} - Success status
 */
function updateCleaningTask(taskId, updates) {
  const tasks = getAllCleaningTasks();
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) {
    console.error(`Task ${taskId} not found`);
    return false;
  }
  
  tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
  return writeJsonFile('cleaningTasks.json', tasks);
}

/**
 * Get cleaning tasks (alias for getAllCleaningTasks for consistency)
 * @returns {Array} - Array of cleaning task objects
 */
function getCleaningTasks() {
  return getAllCleaningTasks();
}

/**
 * Get room by number
 * @param {string} roomNumber - Room number
 * @returns {Object|null} - Room object or null if not found
 */
function getRoomByNumber(roomNumber) {
  const rooms = getAllRooms();
  return rooms.find(r => r.number === roomNumber) || null;
}

module.exports = {
  readJsonFile,
  writeJsonFile,
  getAllGuests,
  addGuest,
  getAllRooms,
  getAvailableRooms,
  updateRoom,
  getAllCleaningTasks,
  getCleaningTasks,
  addCleaningTask,
  updateCleaningTask,
  getGuestById,
  getGuestInRoom,
  checkoutGuest,
  getRoomByNumber
};
