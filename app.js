const express = require('express');
const session = require('express-session');
const path = require('path');
const hbs = require('hbs');

const app = express();

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: 'hotelopssecret',
  resave: false,
  saveUninitialized: true
}));

// View engine setup
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Optional: register partials
hbs.registerPartials(path.join(__dirname, 'views/partials'));

// Routes
const authRoutes = require('./routes/auth.routes');
const receptionistRoutes = require('./routes/receptionist.routes');
const housekeepingRoutes = require('./routes/housekeeping.routes');

app.use('/', authRoutes);
app.use('/receptionist', receptionistRoutes);
app.use('/housekeeping', housekeepingRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
