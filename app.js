const express = require('express');
const session = require('express-session');
const path = require('path');
const hbs = require('hbs');
const fs = require('fs');

const app = express();

// ================= MIDDLEWARE =================

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (MUST be before routes)
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'hotelops-development-secret-change-in-production',
  resave: false,
  saveUninitialized: false, // Changed to false for better security
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' // HTTPS only in production
  }
}));

// ================= VIEW ENGINE =================

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials (if folder exists)
const partialsPath = path.join(__dirname, 'views/partials');
if (fs.existsSync(partialsPath)) {
  hbs.registerPartials(partialsPath);
}

// Custom Handlebars helper
hbs.registerHelper('eq', function (a, b) {
  return a === b;
});

// ================= ROUTES =================

const authRoutes = require('./routes/auth.routes');
const receptionistRoutes = require('./routes/receptionist.routes');
const housekeepingRoutes = require('./routes/housekeeping.routes');
const housekeepersRoutes = require('./routes/housekeepers.routes');

// Auth routes
app.use('/', authRoutes);

// 🔥 IMPORTANT: Specific route must come BEFORE general one
app.use('/receptionist/housekeepers', housekeepersRoutes);

// General receptionist routes
app.use('/receptionist', receptionistRoutes);

// Housekeeping staff routes
app.use('/housekeeping', housekeepingRoutes);

// ================= SERVER =================

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
