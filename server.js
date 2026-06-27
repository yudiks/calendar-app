const express = require('express');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Redis } = require('@upstash/redis');

const app = express();
const PORT = process.env.PORT || 3000;

const AVAIL_KEY = 'calendar:availability';
const BOOKINGS_KEY = 'calendar:bookings';
const DEFAULT_AVAILABILITY = { weekdays: [1,2,3,4,5], startTime: '09:00', endTime: '17:00', slotDuration: 30 };

// Redis is only available in production (env vars set by Vercel/Upstash integration).
// In local dev without env vars, fall back to in-memory maps so the server still starts.
let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// In-memory fallback for local dev (resets on restart)
const localStore = { availability: { ...DEFAULT_AVAILABILITY }, bookings: [] };

async function getAvailability() {
  if (!redis) return localStore.availability;
  const val = await redis.get(AVAIL_KEY);
  return val || DEFAULT_AVAILABILITY;
}

async function setAvailability(data) {
  if (!redis) { localStore.availability = data; return; }
  await redis.set(AVAIL_KEY, data);
}

async function getBookings() {
  if (!redis) return localStore.bookings;
  const val = await redis.get(BOOKINGS_KEY);
  return val || [];
}

async function setBookings(bookings) {
  if (!redis) { localStore.bookings = bookings; return; }
  await redis.set(BOOKINGS_KEY, bookings);
}

// --- Email helper ---
async function sendBookingEmail(booking) {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !user || !pass) { console.log('Email not configured'); return; }
  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: user,
    to: process.env.EMAIL_TO || 'yudiks@gmail.com',
    subject: `New booking: ${booking.name} on ${booking.date} at ${booking.time}`,
    text: `Name: ${booking.name}\nEmail: ${booking.email}\nDate: ${booking.date}\nTime: ${booking.time}`,
  });
}

app.use(express.json());

// GET /api/availability
app.get('/api/availability', async (req, res) => {
  try { res.json(await getAvailability()); }
  catch { res.status(500).json({ error: 'Failed to read availability' }); }
});

// POST /api/availability
app.post('/api/availability', async (req, res) => {
  try {
    const { weekdays, startTime, endTime, slotDuration } = req.body;
    if (!weekdays || !startTime || !endTime || !slotDuration)
      return res.status(400).json({ error: 'Missing required fields' });
    await setAvailability({ weekdays, startTime, endTime, slotDuration });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed to write availability' }); }
});

// GET /api/slots?date=YYYY-MM-DD
app.get('/api/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Missing date parameter' });

    const avail = await getAvailability();
    const bookings = await getBookings();

    const jsDay = new Date(date + 'T00:00:00').getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    if (!avail.weekdays.includes(isoDay)) return res.json([]);

    const [startH, startM] = avail.startTime.split(':').map(Number);
    const [endH, endM] = avail.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const bookedTimes = new Set(bookings.filter(b => b.date === date).map(b => b.time));

    const slots = [];
    for (let m = startMinutes; m < endMinutes; m += avail.slotDuration) {
      const time = `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
      slots.push({ time, available: !bookedTimes.has(time) });
    }
    res.json(slots);
  } catch { res.status(500).json({ error: 'Failed to compute slots' }); }
});

// POST /api/book
app.post('/api/book', async (req, res) => {
  try {
    const { name, email, date, time } = req.body;
    if (!name || !email || !date || !time)
      return res.status(400).json({ error: 'Missing required fields: name, email, date, time' });

    const bookings = await getBookings();
    if (bookings.find(b => b.date === date && b.time === time))
      return res.status(409).json({ error: 'Slot already booked' });

    const booking = { id: crypto.randomUUID(), name, email, date, time, createdAt: new Date().toISOString() };
    await setBookings([...bookings, booking]);
    sendBookingEmail(booking).catch(err => console.error('Email error:', err));
    res.json({ ok: true, id: booking.id });
  } catch { res.status(500).json({ error: 'Failed to create booking' }); }
});

// GET /api/bookings
app.get('/api/bookings', async (req, res) => {
  try { res.json(await getBookings()); }
  catch { res.status(500).json({ error: 'Failed to read bookings' }); }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Calendar app running at http://localhost:${PORT}`));
