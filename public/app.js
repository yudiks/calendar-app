(() => {
  // ── State ──────────────────────────────────────────────────────────────────
  const STORE_KEY = 'calendar-events';
  let current = { year: new Date().getFullYear(), month: new Date().getMonth() };
  let editingId = null; // null = new event, string = editing existing

  // ── Persistence ────────────────────────────────────────────────────────────
  function loadEvents() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  }

  function saveEvents(events) {
    localStorage.setItem(STORE_KEY, JSON.stringify(events));
  }

  // ── Grid rendering ─────────────────────────────────────────────────────────
  const grid = document.getElementById('grid');
  const monthTitle = document.getElementById('monthTitle');
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  function renderGrid() {
    const { year, month } = current;
    monthTitle.textContent = `${MONTHS[month]} ${year}`;

    const today = new Date();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const events = loadEvents();

    // Build a map: "YYYY-MM-DD" → [event, …]
    const byDate = {};
    events.forEach(ev => {
      (byDate[ev.date] = byDate[ev.date] || []).push(ev);
    });

    const cells = [];

    // Trailing days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: daysInPrev - i, curMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, curMonth: true });
    }
    // Leading days of next month to fill last row
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let d = 1; d <= 7 - remainder; d++) {
        cells.push({ day: d, curMonth: false });
      }
    }

    grid.innerHTML = '';
    cells.forEach(({ day, curMonth }) => {
      const dateStr = curMonth
        ? toDateStr(year, month, day)
        : null; // don't attach events to padding cells

      const isToday = curMonth
        && today.getFullYear() === year
        && today.getMonth() === month
        && today.getDate() === day;

      const cell = document.createElement('div');
      cell.className = 'day' + (curMonth ? '' : ' other-month') + (isToday ? ' today' : '');

      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = day;
      cell.appendChild(num);

      if (curMonth) {
        // Event badges
        (byDate[dateStr] || []).forEach(ev => {
          const badge = document.createElement('span');
          badge.className = 'event-badge';
          badge.textContent = ev.time ? `${ev.time} ${ev.title}` : ev.title;
          badge.addEventListener('click', e => {
            e.stopPropagation();
            openModal(dateStr, ev);
          });
          cell.appendChild(badge);
        });

        cell.addEventListener('click', () => openModal(dateStr, null));
      }

      grid.appendChild(cell);
    });
  }

  function toDateStr(year, month, day) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  document.getElementById('prev').addEventListener('click', () => {
    if (current.month === 0) { current.month = 11; current.year--; }
    else { current.month--; }
    renderGrid();
  });

  document.getElementById('next').addEventListener('click', () => {
    if (current.month === 11) { current.month = 0; current.year++; }
    else { current.month++; }
    renderGrid();
  });

  // ── Modal ──────────────────────────────────────────────────────────────────
  const backdrop  = document.getElementById('backdrop');
  const modalTitle = document.getElementById('modalTitle');
  const form      = document.getElementById('eventForm');
  const titleInput = document.getElementById('evtTitle');
  const dateInput  = document.getElementById('evtDate');
  const timeInput  = document.getElementById('evtTime');
  const titleErr  = document.getElementById('titleErr');
  const dateErr   = document.getElementById('dateErr');
  const deleteBtn = document.getElementById('deleteBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  function openModal(dateStr, event) {
    editingId = event ? event.id : null;
    modalTitle.textContent = event ? 'Edit Event' : 'Add Event';
    titleInput.value = event ? event.title : '';
    dateInput.value  = event ? event.date  : (dateStr || '');
    timeInput.value  = event ? event.time  : '';
    titleErr.classList.add('hidden');
    dateErr.classList.add('hidden');
    deleteBtn.style.display = event ? '' : 'none';
    backdrop.classList.remove('hidden');
    titleInput.focus();
  }

  function closeModal() {
    backdrop.classList.add('hidden');
    form.reset();
    editingId = null;
  }

  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

  // Keyboard close
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ── Save ───────────────────────────────────────────────────────────────────
  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const date  = dateInput.value;
    let valid = true;

    if (!title) { titleErr.classList.remove('hidden'); valid = false; }
    else         { titleErr.classList.add('hidden'); }

    if (!date)  { dateErr.classList.remove('hidden'); valid = false; }
    else        { dateErr.classList.add('hidden'); }

    if (!valid) return;

    let events = loadEvents();
    if (editingId) {
      events = events.map(ev => ev.id === editingId
        ? { ...ev, title, date, time: timeInput.value }
        : ev);
    } else {
      events.push({ id: crypto.randomUUID(), title, date, time: timeInput.value });
    }
    saveEvents(events);
    closeModal();
    renderGrid();
  });

  // ── Delete ─────────────────────────────────────────────────────────────────
  deleteBtn.addEventListener('click', () => {
    if (!editingId) return;
    const events = loadEvents().filter(ev => ev.id !== editingId);
    saveEvents(events);
    closeModal();
    renderGrid();
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  renderGrid();
})();
