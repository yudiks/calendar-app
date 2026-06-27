// Serves the static calendar app from /public on PORT (default 3000).
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const AVAILABILITY_FILE = path.join(__dirname, 'data', 'availability.json');
const BOOKINGS_FILE = path.join(__dirname, 'data', 'bookings.json');

// Parse JSON bodies
app.use(express.json());

// --- Email helper ---
async function sendBookingEmail(booking) {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    console.log('Email not configured');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port || '587', 10),
    auth: { user, pass },
  });

  const to = process.env.EMAIL_TO || 'yudiks@gmail.com';
  await transporter.sendMail({
    from: user,
    to,
    subject: `New booking: ${booking.name} on ${booking.date} at ${booking.time}`,
    text: `Name: ${booking.name}\nEmail: ${booking.email}\nDate: ${booking.date}\nTime: ${booking.time}`,
  });
}

// --- API routes (before static middleware) ---

// GET /api/availability
app.get('/api/availability', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(AVAILABILITY_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read availability' });
  }
});

// POST /api/availability
app.post('/api/availability', (req, res) => {
  try {
    const { weekdays, startTime, endTime, slotDuration } = req.body;
    if (!weekdays || !startTime || !endTime || !slotDuration) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    fs.writeFileSync(AVAILABILITY_FILE, JSON.stringify({ weekdays, startTime, endTime, slotDuration }));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write availability' });
  }
});

// GET /api/slots?date=YYYY-MM-DD
app.get('/api/slots', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Missing date parameter' });

    const avail = JSON.parse(fs.readFileSync(AVAILABILITY_FILE, 'utf8'));
    const bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));

    // JS getDay: 0=Sun,1=Mon...6=Sat; convert to 1=Mon...7=Sun
    const jsDay = new Date(date + 'T00:00:00').getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (!avail.weekdays.includes(isoDay)) {
      return res.json([]);
    }

    // Build slots
    const slots = [];
    const [startH, startM] = avail.startTime.split(':').map(Number);
    const [endH, endM] = avail.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const bookedTimes = new Set(bookings.filter(b => b.date === date).map(b => b.time));

    for (let m = startMinutes; m < endMinutes; m += avail.slotDuration) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const time = `${hh}:${mm}`;
      slots.push({ time, available: !bookedTimes.has(time) });
    }

    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute slots' });
  }
});

// POST /api/book
app.post('/api/book', async (req, res) => {
  try {
    const { name, email, date, time } = req.body;
    if (!name || !email || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields: name, email, date, time' });
    }

    const bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
    const conflict = bookings.find(b => b.date === date && b.time === time);
    if (conflict) {
      return res.status(409).json({ error: 'Slot already booked' });
    }

    const booking = {
      id: crypto.randomUUID(),
      name,
      email,
      date,
      time,
      createdAt: new Date().toISOString(),
    };

    bookings.push(booking);
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));

    sendBookingEmail(booking).catch(err => console.error('Email error:', err));

    res.json({ ok: true, id: booking.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// GET /api/bookings
app.get('/api/bookings', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read bookings' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Calendar app running at http://localhost:${PORT}`);
});
