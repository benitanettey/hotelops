const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const path = require('path');
const { readJSON, writeJSON } = require('../utils/jsonHelper');
const { getDashboardPath } = require('../utils/roleHelper');
const { generateRooms } = require('../utils/roomHelper');

const USER_FILE = path.join(__dirname, '../data/user.json');
const RESET_LOGS_FILE = path.join(__dirname, '../data/passwordResetLogs.json');
const HOTEL_FILE = path.join(__dirname, '../data/hotel.json');
const ROOMS_FILE = path.join(__dirname, '../data/rooms.json');

// Security Constants
const RECOVERY_CODES_COUNT = 5;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MIN_PASSWORD_LENGTH = 8;

// ================= SIGNUP =================

/**
 * Show signup page
 */
exports.showSignup = async (req, res) => {
  try {
    // Check if hotel is already configured
    const hotel = await readJSON(HOTEL_FILE);
    const hotelConfigured = hotel && hotel.id !== null;
    
    res.render('auth/signup', {
      title: 'Sign Up - StaySync',
      error: null,
      info: !hotelConfigured ? 'As the first receptionist, you will configure the hotel and become the admin.' : null,
      showHotelConfig: !hotelConfigured // Show hotel config for first receptionist
    });
  } catch (error) {
    console.error('Show signup error:', error);
    res.render('auth/signup', {
      title: 'Sign Up - StaySync',
      error: null,
      info: null,
      showHotelConfig: true
    });
  }
};

/**
 * Process signup form
 */
exports.processSignup = async (req, res) => {
  try {
    const { username, password, confirmPassword, name, role, hotelName, roomTypes } = req.body;
    
    // Check if hotel is already configured
    const hotel = await readJSON(HOTEL_FILE);
    const hotelConfigured = hotel && hotel.id !== null;
    
    // Helper function to render with showHotelConfig
    const renderError = (error) => {
      return res.render('auth/signup', {
        title: 'Sign Up - StaySync',
        error: error,
        info: null,
        showHotelConfig: !hotelConfigured
      });
    };
    
    // Validation
    if (!username || !password || !confirmPassword || !name || !role) {
      return renderError('All fields are required');
    }
    
    // Password match check
    if (password !== confirmPassword) {
      return renderError('Passwords do not match');
    }
    
    // Password strength validation
    if (password.length < MIN_PASSWORD_LENGTH) {
      return renderError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }
    
    // Role validation
    if (!['receptionist', 'housekeeper'].includes(role)) {
      return renderError('Invalid role selected');
    }
    
    // Block housekeeper signup if hotel not configured
    if (!hotelConfigured && role === 'housekeeper') {
      return renderError('A receptionist must set up the hotel first. Please wait for your hotel to be configured.');
    }
    
    // If hotel not configured and role is receptionist, validate hotel config
    if (!hotelConfigured && role === 'receptionist') {
      if (!hotelName || !hotelName.trim()) {
        return renderError('Hotel name is required for first receptionist');
      }
      
      // Validate room types - at least one room type should have count > 0
      const totalRooms = roomTypes ? roomTypes.reduce((sum, rt) => sum + (parseInt(rt.count) || 0), 0) : 0;
      if (totalRooms === 0) {
        return renderError('Please add at least one room to the hotel');
      }
    }
    
    // Check if username already exists
    const users = await readJSON(USER_FILE);
    const existingUser = users.find(u => u.username === username.toLowerCase());
    
    if (existingUser) {
      return renderError('Username already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate recovery codes (XXXX-XXXX format)
    const recoveryCodes = [];
    for (let i = 0; i < RECOVERY_CODES_COUNT; i++) {
      const code = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + 
                   Math.random().toString(36).substring(2, 6).toUpperCase();
      const hashedCode = await bcrypt.hash(code, 10);
      recoveryCodes.push({
        code: code, // Plain text for one-time display
        hashedCode: hashedCode,
        used: false
      });
    }
    
    // Create new user
    const newUser = {
      id: `user-${randomUUID()}`,
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      role: role,
      name: name.trim(),
      isAdmin: !hotelConfigured && role === 'receptionist', // First receptionist is admin
      recoveryCodes: recoveryCodes.map(rc => ({ hashedCode: rc.hashedCode, used: false })),
      createdAt: new Date().toISOString(),
      accountLockedUntil: null,
      failedLoginAttempts: 0
    };
    
    // Add user to array and save
    users.push(newUser);
    await writeJSON(USER_FILE, users);
    
    // If hotel not configured and role is receptionist, set up hotel and rooms
    if (!hotelConfigured && role === 'receptionist') {
      // Create hotel configuration
      const newHotel = {
        id: `hotel-${randomUUID()}`,
        name: hotelName.trim(),
        roomTypes: roomTypes.filter(rt => parseInt(rt.count) > 0).map(rt => ({
          name: rt.name,
          count: parseInt(rt.count)
        })),
        createdBy: newUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await writeJSON(HOTEL_FILE, newHotel);
      
      // Generate rooms
      const rooms = generateRooms(newHotel.roomTypes);
      await writeJSON(ROOMS_FILE, rooms);
    }
    
    // Auto-login after signup
    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    req.session.role = newUser.role;
    req.session.name = newUser.name;
    req.session.isAdmin = newUser.isAdmin || false;
    req.session.isAuthenticated = true;
    
    // Store plain codes in session for one-time display
    req.session.recoveryCodes = recoveryCodes.map(rc => rc.code);
    
    // Redirect to recovery codes display page
    res.redirect('/recovery-codes');
    
  } catch (error) {
    console.error('Signup error:', error);
    res.render('auth/signup', {
      title: 'Sign Up - StaySync',
      error: 'An error occurred during signup. Please try again.'
    });
  }
};

// ================= RECOVERY CODES DISPLAY =================

/**
 * Show recovery codes after signup (one-time view)
 */
exports.showRecoveryCodes = (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect('/login');
  }
  
  const codes = req.session.recoveryCodes;
  
  if (!codes || codes.length === 0) {
    // Codes already viewed, redirect to dashboard
    return res.redirect(getDashboardPath(req.session.role));
  }
  
  res.render('auth/recovery-codes', {
    title: 'Save Your Recovery Codes - StaySync',
    codes: codes,
    username: req.session.username
  });
};

/**
 * Acknowledge recovery codes and proceed to dashboard
 */
exports.acknowledgeRecoveryCodes = (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect('/login');
  }
  
  // Clear codes from session (one-time view)
  delete req.session.recoveryCodes;
  
  // Redirect to dashboard based on role
  res.redirect(getDashboardPath(req.session.role));
};

// ================= LOGIN =================

/**
 * Show login page
 */
exports.showLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Login - StaySync',
    error: null,
    success: req.query.success === 'password-reset' ? 'Password reset successful! Please login with your new password.' : null
  });
};

/**
 * Process login form
 */
exports.processLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validation
    if (!username || !password) {
      return res.render('auth/login', {
        title: 'Login - StaySync',
        error: 'Username and password are required',
        success: null
      });
    }
    
    // Find user
    const users = await readJSON(USER_FILE);
    const user = users.find(u => u.username === username.toLowerCase());
    
    if (!user) {
      return res.render('auth/login', {
        title: 'Login - StaySync',
        error: 'Invalid username or password',
        success: null
      });
    }
    
    // Check if account is locked
    if (user.accountLockedUntil) {
      const lockTime = new Date(user.accountLockedUntil);
      if (new Date() < lockTime) {
        const minutes = Math.ceil((lockTime - new Date()) / 60000);
        return res.render('auth/login', {
          title: 'Login - StaySync',
          error: `Account locked. Try again in ${minutes} minute(s).`,
          success: null
        });
      } else {
        // Unlock account
        user.accountLockedUntil = null;
        user.failedLoginAttempts = 0;
      }
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      // Increment failed attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      // Lock account after max failed attempts
      if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.accountLockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS).toISOString();
        await writeJSON(USER_FILE, users);
        
        return res.render('auth/login', {
          title: 'Login - StaySync',
          error: `Too many failed attempts. Account locked for ${ACCOUNT_LOCK_DURATION_MS / 60000} minutes.`,
          success: null
        });
      }
      
      await writeJSON(USER_FILE, users);
      
      return res.render('auth/login', {
        title: 'Login - StaySync',
        error: `Invalid username or password. ${MAX_FAILED_LOGIN_ATTEMPTS - user.failedLoginAttempts} attempt(s) remaining.`,
        success: null
      });
    }
    
    // Reset failed attempts on successful login
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    await writeJSON(USER_FILE, users);
    
    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.name = user.name;
    req.session.isAdmin = user.isAdmin || false;
    req.session.isAuthenticated = true;
    
    // Redirect based on role
    res.redirect(getDashboardPath(user.role));
    
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      title: 'Login - StaySync',
      error: 'An error occurred during login. Please try again.',
      success: null
    });
  }
};

// ================= LOGOUT =================

/**
 * Logout user and destroy session
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
};

// ================= FORGOT PASSWORD (Recovery Codes) =================

/**
 * Show forgot password page
 */
exports.showForgotPassword = (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Reset Password - StaySync',
    error: null,
    success: null
  });
};

/**
 * Process forgot password with recovery code
 */
exports.processForgotPassword = async (req, res) => {
  try {
    const { username, recoveryCode, newPassword, confirmPassword } = req.body;
    
    // Validation
    if (!username || !recoveryCode || !newPassword || !confirmPassword) {
      return res.render('auth/forgot-password', {
        title: 'Reset Password - StaySync',
        error: 'All fields are required',
        success: null
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.render('auth/forgot-password', {
        title: 'Reset Password - StaySync',
        error: 'Passwords do not match',
        success: null
      });
    }
    
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.render('auth/forgot-password', {
        title: 'Reset Password - StaySync',
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
        success: null
      });
    }
    
    // Find user
    const users = await readJSON(USER_FILE);
    const userIndex = users.findIndex(u => u.username === username.toLowerCase().trim());
    
    if (userIndex === -1) {
      return res.render('auth/forgot-password', {
        title: 'Reset Password - StaySync',
        error: 'Invalid username or recovery code',
        success: null
      });
    }
    
    const user = users[userIndex];
    
    // Check if user has recovery codes
    if (!user.recoveryCodes || user.recoveryCodes.length === 0) {
      return res.render('auth/forgot-password', {
        title: 'Reset Password - StaySync',
        error: 'No recovery codes available for this account',
        success: null
      });
    }
    
    // Verify recovery code (check against all unused codes)
    let codeFound = false;
    let codeIndex = -1;
    
    for (let i = 0; i < user.recoveryCodes.length; i++) {
      const rc = user.recoveryCodes[i];
      if (!rc.used) {
        const isMatch = await bcrypt.compare(recoveryCode.toUpperCase(), rc.hashedCode);
        if (isMatch) {
          codeFound = true;
          codeIndex = i;
          break;
        }
      }
    }
    
    if (!codeFound) {
      return res.render('auth/forgot-password', {
        title: 'Reset Password - StaySync',
        error: 'Invalid or already used recovery code',
        success: null
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user password and mark code as used
    users[userIndex].password = hashedPassword;
    users[userIndex].recoveryCodes[codeIndex].used = true;
    users[userIndex].failedLoginAttempts = 0;
    users[userIndex].accountLockedUntil = null;
    
    await writeJSON(USER_FILE, users);
    
    // Log password reset
    try {
      const logs = await readJSON(RESET_LOGS_FILE);
      logs.push({
        id: `log-${randomUUID()}`,
        timestamp: new Date().toISOString(),
        targetUser: {
          userId: user.id,
          username: user.username,
          role: user.role,
          name: user.name
        },
        action: 'Self-Service Password Reset',
        method: 'Recovery Code',
        remainingCodes: user.recoveryCodes.filter(rc => !rc.used).length
      });
      await writeJSON(RESET_LOGS_FILE, logs);
    } catch (error) {
      console.error('Error logging password reset:', error);
    }
    
    // Check remaining codes
    const remainingCodes = user.recoveryCodes.filter(rc => !rc.used).length;
    let successMessage = 'Password reset successful! Please login with your new password.';
    
    if (remainingCodes === 0) {
      successMessage += ' Warning: All recovery codes have been used.';
    } else if (remainingCodes <= 2) {
      successMessage += ` Warning: Only ${remainingCodes} recovery code(s) remaining.`;
    }
    
    res.render('auth/forgot-password', {
      title: 'Reset Password - StaySync',
      error: null,
      success: successMessage
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('auth/forgot-password', {
      title: 'Reset Password - StaySync',
      error: 'An error occurred. Please try again.',
      success: null
    });
  }
};
