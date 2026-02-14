# HotelOps Frontend Implementation 

## What I Did

I implemented the **frontend only** for three receptionist pages:
- Dashboard
- Check-In  
- Checkout

All pages are fully responsive, use Tailwind CSS, and follow the design mockups exactly.

---

## Files I Worked On

### 1. `views/layouts/main.hbs`
Main layout template - links CSS and wraps all pages.

### 2. `views/receptionist/dashboard.hbs`
**Features:**
- Sticky navigation with logo, links, notification bell, user avatar
- Welcome section with 3 action buttons
- 4 statistics cards (Total Rooms, Rooms Ready, Pending Cleaning, Occupied)
- Occupancy chart + Recent Activity 
- Property showcase section

**Hardcoded Data (Replace with backend):**
- Statistics: `totalRooms: 50`, `roomsReady: 35`, `pendingCleaning: 8`, `occupied: 7`
- Recent Activity: 5 hardcoded events
- Property images: 3 hardcoded cards

### 3. `views/receptionist/checkingguests.hbs`
**Features:**
- Same navigation
- Hero image with text overlay
- Guest Information form + Available Rooms list

**Hardcoded Data (Replace with backend):**
- Available rooms: 6 hardcoded rooms (101, 102, 201, 202, 301, 302)

**Form Fields:**
`firstName`, `lastName`, `email`, `phone`, `idNumber`, `checkInDate`, `checkOutDate`, `roomSelect`

### 4. `views/receptionist/checkoutguests.hbs`
**Features:**
- Same navigation
- Gradient hero banner
- Table with occupied rooms + checkout buttons
- Search input (needs JavaScript to work)

**Hardcoded Data (Replace with backend):**
- 3 hardcoded occupied rooms

### 5. `tailwind.config.js` + `public/css/input.css`
Tailwind CSS configuration and source file.

**Build CSS command:**
```bash
npx tailwindcss -i ./public/css/input.css -o ./public/css/styles.css --watch
```

### 6. `routes/*.js` (Minimal placeholder code)
Added basic routes in the routes folder so the app runs and pages display. Backend team needs to add real logic.

---

## Backend Integration Guide

### Dashboard - `receptionist.controller.js`

```javascript
router.get('/dashboard', (req, res) => {
  // Read from rooms.json
  const rooms = readJSON('data/rooms.json');
  const totalRooms = rooms.length;
  const roomsReady = rooms.filter(r => r.status === 'Available').length;
  const pendingCleaning = rooms.filter(r => r.status === 'Needs Cleaning').length;
  const occupied = rooms.filter(r => r.status === 'Occupied').length;
  
  // Get recent activity from JSON files
  const recentActivity = getRecentActivity(); // Build this function
  
  res.render('receptionist/dashboard', {
    layout: 'layouts/main',
    title: 'Dashboard',
    totalRooms,
    roomsReady,
    pendingCleaning,
    occupied,
    recentActivity
  });
});
```

**Update template:** Replace hardcoded numbers with `{{totalRooms}}`, `{{roomsReady}}`, etc.

---

### Check-In - GET & POST

**GET - Display form:**
```javascript
router.get('/checkingguests', (req, res) => {
  const rooms = readJSON('data/rooms.json');
  const availableRooms = rooms.filter(r => r.status === 'Available');
  
  res.render('receptionist/checkingguests', {
    layout: 'layouts/main',
    title: 'Check-In',
    availableRooms
  });
});
```

**POST - Process check-in:**
```javascript
router.post('/checkin', (req, res) => {
  const { firstName, lastName, email, phone, idNumber, checkInDate, checkOutDate, roomSelect } = req.body;
  
  // 1. Validate inputs
  // 2. Create guest object with unique ID
  // 3. Save to guests.json
  // 4. Update room status to 'Occupied' in rooms.json
  
  res.redirect('/receptionist/dashboard');
});
```

**Update template:** Loop through `{{#each availableRooms}}` for room list and dropdown.

---

### Checkout - GET & POST

**GET - Display table:**
```javascript
router.get('/checkoutguests', (req, res) => {
  const guests = readJSON('data/guests.json');
  const rooms = readJSON('data/rooms.json');
  
  const occupiedRooms = guests
    .filter(g => g.status === 'Checked In')
    .map(guest => {
      const room = rooms.find(r => r.number === guest.roomNumber);
      return {
        roomNumber: guest.roomNumber,
        guestName: `${guest.firstName} ${guest.lastName}`,
        guestId: guest.id,
        roomType: room.type,
        checkInDate: guest.checkInDate,
        expectedCheckOutDate: guest.checkOutDate
      };
    });
  
  res.render('receptionist/checkoutguests', {
    layout: 'layouts/main',
    title: 'Checkout',
    occupiedRooms
  });
});
```

**POST - Process checkout:**
```javascript
router.post('/checkout', (req, res) => {
  const { guestId, roomNumber } = req.body;
  
  // 1. Update guest status to 'Checked Out' in guests.json
  // 2. Update room status to 'Needs Cleaning' in rooms.json
  // 3. Create cleaning task in cleaningTasks.json
  
  res.redirect('/receptionist/checkoutguests');
});
```

**Update template:** Loop through `{{#each occupiedRooms}}` for table rows.

---

## JSON Structure Examples

### `data/rooms.json`
```json
[
  {
    "number": "101",
    "type": "Single",
    "floor": 1,
    "status": "Available",
    "price": 150
  }
]
```

### `data/guests.json`
```json
[
  {
    "id": "guest-001",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "+1234567890",
    "idNumber": "ABC123",
    "roomNumber": "102",
    "checkInDate": "2026-02-05",
    "checkOutDate": "2026-02-08",
    "status": "Checked In"
  }
]
```

### `data/cleaningTasks.json`
```json
[
  {
    "id": "task-001",
    "roomNumber": "102",
    "status": "Pending",
    "createdAt": "2026-02-14T10:30:00Z",
    "assignedTo": null,
    "completedAt": null
  }
]
```

---

## Navigation Links

All pages share this navigation:
- Dashboard → `/receptionist/dashboard`
- Check-In → `/receptionist/checkingguests`
- Checkout → `/receptionist/checkoutguests`
- Rooms → `/receptionist/rooms` (not implemented)
- Cleaning Requests → `/receptionist/cleaning-requests` (not implemented)
- Housekeepers → `/receptionist/housekeepers` (not implemented)

Active page = bold text.

---

## Design Notes

- **Primary Color:** `#008080` (Teal)
- **Fully Responsive:** Mobile-first, works on all screen sizes
- **Sticky Navigation:** Stays at top when scrolling
- **All comments in code:** Look for `<!-- BACKEND TODO: ... -->` in `.hbs` files

---

## Setup & Run

1. **Install dependencies:**
   ```bash
   npm init
   ```

2. **Build CSS (run in separate terminal):**
   ```bash
   npx tailwindcss -i ./public/css/input.css -o ./public/css/styles.css --watch
   ```

3. **Start server:**
   ```bash
   npm run dev
   ```

4. **Visit:**
   - http://localhost:3001/receptionist/dashboard
   - http://localhost:3001/receptionist/checkingguests
   - http://localhost:3001/receptionist/checkoutguests

---

## Backend Checklist

- [ ] Replace hardcoded statistics on dashboard
- [ ] Replace hardcoded recent activity
- [ ] Replace hardcoded available rooms on check-in page
- [ ] Replace hardcoded occupied rooms on checkout page
- [ ] Implement check-in form processing
- [ ] Implement checkout button processing
- [ ] Add form validation
- [ ] Add error handling
- [ ] Test all functionality

---

## Important

- All `.hbs` files have detailed `<!-- BACKEND TODO -->` comments
- No business logic in views - only display
- Forms ready for POST processing
- Semantic field names match expected data
- No authentication/session handling implemented yet

---

