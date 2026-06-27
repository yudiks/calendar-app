(() => {
  // ── State ──────────────────────────────────────────────────────────────────
  const STORE_KEY = 'calendar-events';
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DAYS_SHORT = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const ALLOWED_COLORS = new Set(['#4285f4','#0b8043','#e67c73','#f6bf26','#8e24aa']);

  const _now = new Date();
  let current = { year: _now.getFullYear(), month: _now.getMonth() };
  let editingId = null; // null = new event; string UUID = editing existing
  let googleEvents = []; // events fetched from Google Calendar API

  // ── Persistence ────────────────────────────────────────────────────────────

  /** @returns {Array<{id:string, title:string, date:string, time:string, color:string}>} */
  function loadEvents() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY));
      if (!Array.isArray(raw)) return [];
      return raw.filter(ev =>
        ev && typeof ev.id === 'string' && typeof ev.title === 'string' && typeof ev.date === 'string'
      );
    } catch { return []; }
  }

  /** @param {ReturnType<typeof loadEvents>} events */
  function saveEvents(events) {
    localStorage.setItem(STORE_KEY, JSON.stringify(events));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Formats a calendar date as an ISO date string (YYYY-MM-DD).
   * @param {number} y - Full year
   * @param {number} m - 0-based month
   * @param {number} d - Day of month
   * @returns {string}
   */
  function toDateStr(y, m, d) {
    return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  /**
   * Returns the ISO 8601 week number for a given date (weeks start on Monday).
   * @param {Date} date
   * @returns {number}
   */
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Builds the flat array of day cells for a month grid (Monday-first).
   * Pads the start and end with days from adjacent months to fill complete weeks.
   * @param {number} year
   * @param {number} month - 0-based
   * @returns {Array<{date: Date, curMonth: boolean}>}
   */
  function buildCells(year, month) {
    const firstDate = new Date(year, month, 1);
    const firstDow = (firstDate.getDay() + 6) % 7; // Mon=0…Sun=6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      cells.push({ date: new Date(year, month - 1, daysInPrev - i), curMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), curMonth: true });
    }
    const rem = cells.length % 7;
    if (rem !== 0) {
      for (let d = 1; d <= 7 - rem; d++) {
        cells.push({ date: new Date(year, month + 1, d), curMonth: false });
      }
    }
    return cells;
  }

  // ── Logo date ──────────────────────────────────────────────────────────────
  document.getElementById('logoDate').textContent = new Date().getDate();

  // ── Main grid render ───────────────────────────────────────────────────────
  const gridHeader = document.getElementById('gridHeader');
  const gridBody   = document.getElementById('gridBody');
  const monthTitle = document.getElementById('monthTitle');

  /**
   * Re-renders the full month grid and header from the current `current` state.
   * Reads events from localStorage on each call so the view stays in sync after saves.
   */
  function renderGrid() {
    const { year, month } = current;
    monthTitle.textContent = `${MONTHS[month]} ${year}`;

    const today = new Date(); today.setHours(0,0,0,0);
    const events = [...loadEvents(), ...googleEvents];
    const byDate = {};
    events.forEach(ev => { (byDate[ev.date] = byDate[ev.date] || []).push(ev); });

    const cells = buildCells(year, month);

    // Header row: spacer + 7 columns showing day name and the date of the first-row cell
    gridHeader.innerHTML = '';
    const spacer = document.createElement('div');
    spacer.className = 'gh-spacer';
    gridHeader.appendChild(spacer);

    DAYS_SHORT.forEach((name, i) => {
      const cellDate = cells[i].date;
      const isToday = cellDate.getTime() === today.getTime();
      const col = document.createElement('div');
      col.className = 'gh-day';
      const nameEl = document.createElement('div');
      nameEl.className = 'gh-day-name';
      nameEl.textContent = name;
      const numEl = document.createElement('div');
      numEl.className = 'gh-day-num' + (isToday ? ' today-num' : '');
      numEl.textContent = cellDate.getDate();
      col.appendChild(nameEl);
      col.appendChild(numEl);
      gridHeader.appendChild(col);
    });

    // Week rows
    gridBody.innerHTML = '';
    for (let w = 0; w < cells.length / 7; w++) {
      const week = cells.slice(w * 7, w * 7 + 7);
      const row = document.createElement('div');
      row.className = 'grid-week';

      const wn = document.createElement('div');
      wn.className = 'week-num';
      wn.textContent = isoWeek(week[0].date);
      row.appendChild(wn);

      week.forEach(({ date, curMonth }) => {
        const ds = toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
        const isToday = date.getTime() === today.getTime();

        const cell = document.createElement('div');
        cell.className = 'day-cell' + (curMonth ? '' : ' other-month');
        cell.addEventListener('click', () => openModal(ds, null));

        const num = document.createElement('div');
        num.className = 'day-cell-num' + (isToday ? ' today' : '');
        num.textContent = date.getDate();
        num.addEventListener('click', e => { e.stopPropagation(); openModal(ds, null); });
        cell.appendChild(num);

        (byDate[ds] || []).forEach(ev => {
          const pill = document.createElement('div');
          pill.className = 'event-pill';

          const dot = document.createElement('span');
          dot.className = 'event-dot';
          dot.style.background = ALLOWED_COLORS.has(ev.color) ? ev.color : '#4285f4';

          const label = document.createElement('span');
          label.className = 'event-pill-label';
          label.textContent = ev.time ? `${ev.time} ${ev.title}` : ev.title;

          pill.appendChild(dot);
          pill.appendChild(label);
          pill.addEventListener('click', e => { e.stopPropagation(); openModal(ds, ev); });
          cell.appendChild(pill);
        });

        row.appendChild(cell);
      });
      gridBody.appendChild(row);
    }
  }

  // ── Mini calendar ──────────────────────────────────────────────────────────
  const miniMonthTitle = document.getElementById('miniMonthTitle');
  const miniDays       = document.getElementById('miniDays');
  // Mini calendar has its own navigation state, independent of the main grid.
  let mini = { ...current };

  /**
   * Re-renders the sidebar mini calendar for the `mini` month.
   * Clicking a day jumps both the main grid and mini calendar to that month.
   */
  function renderMini() {
    const { year, month } = mini;
    miniMonthTitle.textContent = `${MONTHS[month]} ${year}`;
    const today = new Date(); today.setHours(0,0,0,0);
    const cells = buildCells(year, month);
    miniDays.innerHTML = '';
    cells.forEach(({ date, curMonth }) => {
      const isToday = date.getTime() === today.getTime();
      const el = document.createElement('div');
      el.className = 'mini-day' + (isToday ? ' today' : '') + (!curMonth ? ' other' : '');
      el.textContent = date.getDate();
      el.addEventListener('click', () => {
        current = { year: date.getFullYear(), month: date.getMonth() };
        mini = { ...current };
        renderGrid(); renderMini();
      });
      miniDays.appendChild(el);
    });
  }

  document.getElementById('miniPrev').addEventListener('click', () => {
    if (mini.month === 0) { mini.month = 11; mini.year--; } else mini.month--;
    renderMini();
  });
  document.getElementById('miniNext').addEventListener('click', () => {
    if (mini.month === 11) { mini.month = 0; mini.year++; } else mini.month++;
    renderMini();
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  document.getElementById('prev').addEventListener('click', () => {
    if (current.month === 0) { current.month = 11; current.year--; } else current.month--;
    mini = { ...current }; renderGrid(); renderMini(); fetchGoogleEvents();
  });
  document.getElementById('next').addEventListener('click', () => {
    if (current.month === 11) { current.month = 0; current.year++; } else current.month++;
    mini = { ...current }; renderGrid(); renderMini(); fetchGoogleEvents();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    const t = new Date();
    current = { year: t.getFullYear(), month: t.getMonth() };
    mini = { ...current }; renderGrid(); renderMini(); fetchGoogleEvents();
  });

  // ── Modal ──────────────────────────────────────────────────────────────────
  const backdrop   = document.getElementById('backdrop');
  const form       = document.getElementById('eventForm');
  const titleInput = document.getElementById('evtTitle');
  const dateInput  = document.getElementById('evtDate');
  const timeInput  = document.getElementById('evtTime');
  const colorSel   = document.getElementById('evtColor');
  const titleErr   = document.getElementById('titleErr');
  const dateErr    = document.getElementById('dateErr');
  const deleteBtn  = document.getElementById('deleteBtn');

  /**
   * Opens the event modal, pre-filled for either a new event or an existing one.
   * @param {string} dateStr - ISO date string for the clicked day (YYYY-MM-DD)
   * @param {object|null} event - Existing event object to edit, or null to create new
   */
  function openModal(dateStr, event) {
    editingId = event ? event.id : null;
    titleInput.value = event ? event.title : '';
    dateInput.value  = event ? event.date  : (dateStr || '');
    timeInput.value  = event ? (event.time || '') : '';
    colorSel.value   = event ? (event.color || '#4285f4') : '#4285f4';
    titleErr.classList.add('hidden');
    dateErr.classList.add('hidden');
    deleteBtn.classList.toggle('hidden', !event);
    backdrop.classList.remove('hidden');
    setTimeout(() => titleInput.focus(), 50);
  }

  /** Closes the modal and resets form state. */
  function closeModal() {
    backdrop.classList.add('hidden');
    form.reset();
    editingId = null;
  }

  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('cancelBtn2').addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  document.getElementById('createBtn').addEventListener('click', () => {
    const t = new Date();
    openModal(toDateStr(t.getFullYear(), t.getMonth(), t.getDate()), null);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const date  = dateInput.value;
    let valid = true;
    if (!title) { titleErr.classList.remove('hidden'); valid = false; }
    else          titleErr.classList.add('hidden');
    if (!date)  { dateErr.classList.remove('hidden'); valid = false; }
    else          dateErr.classList.add('hidden');
    if (!valid) return;

    let events = loadEvents();
    if (editingId) {
      events = events.map(ev => ev.id === editingId
        ? { ...ev, title, date, time: timeInput.value, color: colorSel.value }
        : ev);
    } else {
      events.push({ id: crypto.randomUUID(), title, date, time: timeInput.value, color: colorSel.value });
    }
    saveEvents(events);
    closeModal();
    renderGrid();
  });

  deleteBtn.addEventListener('click', () => {
    if (!editingId) return;
    saveEvents(loadEvents().filter(ev => ev.id !== editingId));
    closeModal();
    renderGrid();
  });

  // ── Auth & Google Calendar ─────────────────────────────────────────────────

  /**
   * Updates the topbar-right area to show the logged-in user's avatar, name, and a sign-out button.
   * @param {{name:string, email:string, picture:string}} me
   */
  function renderUserTopbar(me) {
    const topbarRight = document.querySelector('.topbar-right');

    const userInfo = document.createElement('div');
    userInfo.style.cssText = 'display:flex;align-items:center;gap:8px;margin-left:8px;';

    const avatar = document.createElement('img');
    avatar.src = me.picture || '';
    avatar.alt = me.name || me.email;
    avatar.title = me.name || me.email;
    avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;';
    avatar.onerror = () => {
      // Fallback: replace with initials circle
      const initials = document.createElement('div');
      const letter = (me.name || me.email || '?')[0].toUpperCase();
      initials.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#4285f4;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:500;flex-shrink:0;';
      initials.textContent = letter;
      avatar.replaceWith(initials);
    };

    const nameEl = document.createElement('span');
    nameEl.textContent = me.name || me.email;
    nameEl.style.cssText = 'font-size:13px;color:#3c4043;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const signOutBtn = document.createElement('button');
    signOutBtn.textContent = 'Sign out';
    signOutBtn.className = 'icon-btn';
    signOutBtn.style.cssText = 'font-size:12px;padding:4px 10px;border:1px solid #dadce0;border-radius:4px;color:#3c4043;white-space:nowrap;';
    signOutBtn.addEventListener('click', async () => {
      await fetch('/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });

    userInfo.appendChild(avatar);
    userInfo.appendChild(nameEl);
    userInfo.appendChild(signOutBtn);
    topbarRight.appendChild(userInfo);
  }

  /**
   * Fetches Google Calendar events for the current month and re-renders the grid.
   */
  async function fetchGoogleEvents() {
    try {
      const res = await fetch(`/api/google-events?year=${current.year}&month=${current.month + 1}`);
      if (res.ok) googleEvents = await res.json();
      else googleEvents = [];
    } catch { googleEvents = []; }
    renderGrid();
  }

  /**
   * Checks auth status on boot. Redirects to /login.html if not authenticated.
   * On success, renders the topbar user info and fetches Google Calendar events.
   */
  async function boot() {
    const meRes = await fetch('/api/me');
    if (meRes.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    const me = await meRes.json();
    renderUserTopbar(me);
    renderGrid();
    renderMini();
    fetchGoogleEvents();
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  boot();
})();
