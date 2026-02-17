const { getAllRooms, updateRoom, getRoomByNumber } = require('../utils/jsonHelper');
const { getCleaningTasks, updateCleaningTask } = require('../utils/jsonHelper');

exports.getDashboard = async (req, res) => {
  try {
    const cleaningTasks = await getCleaningTasks();
    const rooms = await getAllRooms();
    
    res.render('housekeeping/dashboard', {
      cleaningTasks: cleaningTasks,
      totalTasks: cleaningTasks.length,
      completedTasks: cleaningTasks.filter(t => t.status === 'Completed').length,
      pendingTasks: cleaningTasks.filter(t => t.status === 'Pending').length,
      rooms: rooms
    });
  } catch (error) {
    console.error('Error loading housekeeping dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
};

exports.markRoomCleaned = async (req, res) => {
  try {
    const { roomNumber, taskId } = req.body;

    if (!roomNumber || !taskId) {
      return res.status(400).json({ error: 'Room number and task ID required' });
    }

    // Update cleaning task status
    await updateCleaningTask(taskId, { status: 'Completed', completedDate: new Date().toISOString() });

    // Update room status back to Available
    await updateRoom(roomNumber, {
      status: 'Available',
      occupiedBy: null,
      checkInDate: null,
      checkOutDate: null
    });

    return res.json({ success: true, message: 'Room marked as cleaned and available' });
  } catch (error) {
    console.error('Error marking room as cleaned:', error);
    return res.status(500).json({ error: 'Failed to mark room as cleaned' });
  }
};
