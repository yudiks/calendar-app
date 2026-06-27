const express = require('express');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Redis } = require('@upstash/redis');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

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

// --- Google OAuth helpers ---
function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
  );
}

function getSession(req) {
  try {
    const token = req.cookies && req.cookies.session;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  } catch { return null; }
}

app.use(express.json());
app.use(cookieParser());

// --- Auth routes (registered before /api routes) ---

// GET /auth/google — redirects user to Google consent screen
app.get('/auth/google', (req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  res.redirect(url);
});

// GET /auth/callback — exchanges code for tokens, sets session cookie, redirects to /
app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html?error=no_code');
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    // Fetch user profile
    const people = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await people.userinfo.get();
    const session = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      name: profile.name,
      email: profile.email,
      picture: profile.picture,
    };
    const token = jwt.sign(session, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
    res.cookie('session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/login.html?error=auth_failed');
  }
});

// POST /auth/logout — clears session cookie
app.post('/auth/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

// GET /api/me — returns current user info (401 if not logged in)
app.get('/api/me', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ name: session.name, email: session.email, picture: session.picture });
});

// GET /api/google-events?year=YYYY&month=MM — fetches Google Calendar events for the given month
app.get('/api/google-events', async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const timeMin = new Date(year, month - 1, 1).toISOString();
    const timeMax = new Date(year, month, 1).toISOString();
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ access_token: session.accessToken, refresh_token: session.refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });
    // Map to our event shape
    const events = (data.items || []).map(ev => {
      const start = ev.start.dateTime || ev.start.date;
      const date = start.slice(0, 10);
      const time = ev.start.dateTime ? start.slice(11, 16) : '';
      return { id: ev.id, title: ev.summary || '(No title)', date, time, color: '#4285f4', source: 'google' };
    });
    res.json(events);
  } catch (err) {
    console.error('Google Calendar error:', err);
    res.status(500).json({ error: 'Failed to fetch Google Calendar events' });
  }
});

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
