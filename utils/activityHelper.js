/**
 * Activity Helper - Manages activity logging for the hotel management system
 * Activities are logged per hotel and can be viewed by all staff
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('./jsonHelper');

const ACTIVITY_FILE = path.join(__dirname, '../data/activity.json');

// Activity types
const ACTIVITY_TYPES = {
  CHECK_IN: 'check-in',
  CHECK_OUT: 'check-out',
  CLEANING_REQUEST: 'cleaning-request',
  CLEANING_ASSIGNED: 'cleaning-assigned',
  CLEANING_STARTED: 'cleaning-started',
  CLEANING_COMPLETE: 'cleaning-complete',
  STATUS_CHANGE: 'status-change',
  ROOM_MAINTENANCE: 'room-maintenance',
  ROOM_AVAILABLE: 'room-available'
};

/**
 * Log a new activity
 * @param {Object} options Activity options
 * @param {string} options.type Activity type (from ACTIVITY_TYPES)
 * @param {string} options.description Short description
 * @param {string} options.details Additional details (e.g., room number, guest name)
 * @param {string} options.userId ID of user who performed the action
 * @param {string} options.userName Name of user who performed the action
 * @param {string} options.hotelId Hotel ID the activity belongs to
 * @returns {Object} The created activity
 */
async function logActivity({ type, description, details, userId, userName, hotelId }) {
  try {
    const activities = await readJSON(ACTIVITY_FILE) || [];
    
    const activity = {
      id: `activity-${uuidv4()}`,
      type,
      description,
      details,
      userId,
      userName,
      hotelId,
      createdAt: new Date().toISOString()
    };
    
    activities.unshift(activity); // Add to beginning of array (most recent first)
    
    // Keep only last 100 activities per hotel to prevent file from growing too large
    const hotelActivities = activities.filter(a => a.hotelId === hotelId);
    const otherActivities = activities.filter(a => a.hotelId !== hotelId);
    const trimmedHotelActivities = hotelActivities.slice(0, 100);
    
    await writeJSON(ACTIVITY_FILE, [...trimmedHotelActivities, ...otherActivities]);
    
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    return null;
  }
}

/**
 * Get recent activities for a hotel
 * @param {string} hotelId Hotel ID
 * @param {number} limit Maximum number of activities to return (default: 10)
 * @returns {Array} Array of activities
 */
async function getRecentActivities(hotelId, limit = 10) {
  try {
    const activities = await readJSON(ACTIVITY_FILE) || [];
    return activities
      .filter(a => a.hotelId === hotelId)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting activities:', error);
    return [];
  }
}

/**
 * Format relative time (e.g., "5 minutes ago", "2 hours ago")
 * @param {string} dateString ISO date string
 * @returns {string} Formatted relative time
 */
function formatRelativeTime(dateString) {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return then.toLocaleDateString();
}

module.exports = {
  ACTIVITY_TYPES,
  logActivity,
  getRecentActivities,
  formatRelativeTime
};
