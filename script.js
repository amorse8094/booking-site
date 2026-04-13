/* ------------------------------------------------------------------
   Floral Botanical Medicine · Booking Logic
   ------------------------------------------------------------------
   HOW TO CUSTOMIZE:
   - Edit CONFIG below (email, services, working hours, etc.)
   - Admin URL: add ?admin=1 to the end of your URL
   - Admin password is set in CONFIG.adminPassword
   ------------------------------------------------------------------ */

const CONFIG = {
  // WHERE BOOKING REQUESTS GET SENT (change to your real email)
  ownerEmail: 'hello@floralbotanicalmedicine.com',

  // WORKING HOURS (24h format)
  workingHours: {
    start: 9,   // 9am
    end:   16,  // 4pm
  },

  // WORKING DAYS (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri

  // MINIMUM DAYS NOTICE (clients can't book same-day)
  minDaysNotice: 1,

  // HOW FAR IN ADVANCE CLIENTS CAN BOOK (days)
  maxDaysAhead: 90,

  // SERVICES OFFERED
  services: [
    {
      id: 'initial',
      name: 'Initial Consultation',
      duration: 60, // minutes
      price: 250,
      description: 'A deep, first-time conversation to understand your health story, goals, and create a botanical plan tailored to you.',
    },
    {
      id: 'blood-analysis',
      name: 'Microscope Live Blood Analysis',
      duration: 60,
      price: 350,
      description: 'A powerful diagnostic session using live blood microscopy to reveal insights about your cellular health, nutrition, and overall vitality.',
    },
    {
      id: 'followup',
      name: 'Follow-Up Session',
      duration: 45,
      price: 140,
      description: 'Ongoing support — review progress, adjust protocols, and deepen your healing journey.',
    },
  ],

  // ADMIN PASSWORD (change this — used when accessing ?admin=1)
  adminPassword: 'change-me-please',
};

/* ------------------------------------------------------------------
   STATE
   ------------------------------------------------------------------ */
const state = {
  selectedService: null,
  selectedDate: null,
  selectedTime: null,
  viewMonth: new Date(),
};

/* ------------------------------------------------------------------
   STORAGE HELPERS
   ------------------------------------------------------------------ */
function getBlockedDates() {
  return JSON.parse(localStorage.getItem('fbm_blocked_dates') || '[]');
}
function setBlockedDates(dates) {
  localStorage.setItem('fbm_blocked_dates', JSON.stringify(dates));
}
function isBlocked(dateStr) {
  return getBlockedDates().includes(dateStr);
}
function toggleBlocked(dateStr) {
  const blocked = getBlockedDates();
  const i = blocked.indexOf(dateStr);
  if (i >= 0) blocked.splice(i, 1);
  else blocked.push(dateStr);
  setBlockedDates(blocked);
}
function getBookings() {
  return JSON.parse(localStorage.getItem('fbm_bookings') || '[]');
}
function addBooking(b) {
  const bookings = getBookings();
  bookings.unshift(b);
  localStorage.setItem('fbm_bookings', JSON.stringify(bookings.slice(0, 50)));
}

/* ------------------------------------------------------------------
   DATE HELPERS
   ------------------------------------------------------------------ */
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDate(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
function formatMonth(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function formatTime(hour, min = 0) {
  const period = hour >= 12 ? 'pm' : 'am';
  const h = hour % 12 || 12;
  return `${h}:${String(min).padStart(2, '0')}${period}`;
}

/* ------------------------------------------------------------------
   RENDER SERVICES
   ------------------------------------------------------------------ */
function renderServices() {
  const grid = document.getElementById('service-grid');
  grid.innerHTML = '';
  CONFIG.services.forEach(svc => {
    const card = document.createElement('button');
    card.className = 'service-card';
    card.innerHTML = `
      <span class="duration">${svc.duration} minutes · $${svc.price}</span>
      <h3>${svc.name}</h3>
      <p>${svc.description}</p>
    `;
    card.addEventListener('click', () => {
      state.selectedService = svc;
      showStep('step-date');
      renderCalendar();
    });
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------------
   RENDER CALENDAR (client view)
   ------------------------------------------------------------------ */
function countAvailableSlots(dateStr, serviceDuration) {
  const bookedTimes = getBookedTimesForDate(dateStr);
  const blockedTimes = getBlockedTimesForDate(dateStr);
  const startMinutes = CONFIG.workingHours.start * 60;
  const endMinutes = CONFIG.workingHours.end * 60;
  let available = 0;
  for (let m = startMinutes; m + serviceDuration <= endMinutes; m += serviceDuration) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const label = formatTime(h, min);
    if (!bookedTimes.includes(label) && !blockedTimes.includes(label)) available++;
  }
  return available;
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('month-label');
  if (!grid || !label) return; // Not on client page
  grid.innerHTML = '';

  const year = state.viewMonth.getFullYear();
  const month = state.viewMonth.getMonth();
  label.textContent = formatMonth(state.viewMonth);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();

  const today = new Date();
  today.setHours(0,0,0,0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + CONFIG.minDaysNotice);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + CONFIG.maxDaysAhead);

  // Use a default duration for slot counting (smallest service)
  const minDuration = Math.min(...CONFIG.services.map(s => s.duration));

  // empty pads
  for (let i = 0; i < startPad; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    const key = dateKey(d);
    const cell = document.createElement('button');
    cell.className = 'cal-day';
    cell.textContent = day;

    const isToday = dateKey(d) === dateKey(new Date());
    if (isToday) cell.classList.add('today');

    const isWorkingDay = CONFIG.workingDays.includes(d.getDay());
    const tooEarly = d < minDate;
    const tooLate = d > maxDate;
    const blocked = isBlocked(key);

    // Check if all slots are booked for this date
    const slotsLeft = isWorkingDay && !blocked ? countAvailableSlots(key, minDuration) : 0;
    const fullyBooked = isWorkingDay && !blocked && slotsLeft === 0 && getBookedTimesForDate(key).length > 0;

    if (!isWorkingDay || tooEarly || tooLate) {
      cell.classList.add('disabled');
      cell.disabled = true;
    } else if (blocked || fullyBooked) {
      cell.classList.add('blocked');
      cell.disabled = true;
      if (fullyBooked) cell.title = 'Fully booked';
    } else {
      cell.addEventListener('click', () => {
        state.selectedDate = d;
        document.querySelectorAll('.cal-day.selected').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        showStep('step-time');
        renderTimeSlots();
      });
    }

    grid.appendChild(cell);
  }
}

document.getElementById('prev-month').addEventListener('click', () => {
  state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
  state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() + 1, 1);
  renderCalendar();
});

/* ------------------------------------------------------------------
   BOOKED SLOT HELPERS
   ------------------------------------------------------------------ */
function getBookedTimesForDate(dateStr) {
  // Returns an array of time labels that are already booked for a date
  const bookings = getBookings();
  const booked = [];
  bookings.forEach(b => {
    const d = new Date(b.date);
    if (!isNaN(d) && dateKey(d) === dateStr) {
      booked.push(b.time);
    }
  });
  return booked;
}

/* ------------------------------------------------------------------
   RENDER TIME SLOTS
   ------------------------------------------------------------------ */
function renderTimeSlots() {
  const grid = document.getElementById('time-grid');
  grid.innerHTML = '';

  document.getElementById('selected-date-label').textContent = formatDate(state.selectedDate);

  const duration = state.selectedService.duration;
  const startMinutes = CONFIG.workingHours.start * 60;
  const endMinutes = CONFIG.workingHours.end * 60;
  const bookedTimes = getBookedTimesForDate(dateKey(state.selectedDate));
  const blockedTimes = getBlockedTimesForDate(dateKey(state.selectedDate));

  for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const label = formatTime(h, min);
    const btn = document.createElement('button');
    btn.className = 'time-slot';
    btn.textContent = label;

    if (bookedTimes.includes(label)) {
      btn.classList.add('disabled');
      btn.disabled = true;
      btn.textContent = label + ' · Booked';
    } else if (blockedTimes.includes(label)) {
      btn.classList.add('disabled');
      btn.disabled = true;
      btn.textContent = label + ' · Unavailable';
    } else {
      btn.addEventListener('click', () => {
        state.selectedTime = { hour: h, minute: min, label: label };
        document.querySelectorAll('.time-slot.selected').forEach(s => s.classList.remove('selected'));
        btn.classList.add('selected');
        showStep('step-details');
        renderSummary();
        prefillBookingForm();
      });
    }
    grid.appendChild(btn);
  }
}

/* ------------------------------------------------------------------
   RENDER SUMMARY + FORM
   ------------------------------------------------------------------ */
function renderSummary() {
  const box = document.getElementById('summary-box');
  box.innerHTML = `
    <strong>${state.selectedService.name}</strong> · ${state.selectedService.duration} minutes · <strong>$${state.selectedService.price}</strong><br>
    <strong>${formatDate(state.selectedDate)}</strong> at <strong>${state.selectedTime.label}</strong>
  `;
}

document.getElementById('booking-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const booking = {
    name: data.get('name'),
    email: data.get('email'),
    phone: data.get('phone') || '',
    notes: data.get('notes') || '',
    service: state.selectedService.name,
    duration: state.selectedService.duration,
    price: state.selectedService.price,
    date: formatDate(state.selectedDate),
    time: state.selectedTime.label,
    submittedAt: new Date().toISOString(),
  };

  addBooking(booking);

  // open mail client with pre-filled booking
  const subject = `New Booking Request — ${booking.name} — ${booking.service}`;
  const body = `
Hello,

You have a new appointment request.

— SESSION —
${booking.service} (${booking.duration} minutes) — $${booking.price}

— WHEN —
${booking.date}
${booking.time}

— CLIENT —
Name:  ${booking.name}
Email: ${booking.email}
Phone: ${booking.phone}

— NOTES —
${booking.notes || '(none)'}

Please reply to confirm.

— Sent from the Floral Botanical Medicine booking site
  `.trim();

  const mailto = `mailto:${CONFIG.ownerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;

  // show confirmation
  document.getElementById('done-name').textContent = booking.name;
  document.getElementById('done-details').innerHTML = `
    ${booking.service}<br>
    ${booking.date}<br>
    ${booking.time}
  `;
  showStep('step-done');
  e.target.reset();
});

/* ------------------------------------------------------------------
   STEP NAVIGATION
   ------------------------------------------------------------------ */
function showStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.add('hidden'));
  document.getElementById(stepId).classList.remove('hidden');
  window.scrollTo({ top: document.querySelector('.booking').offsetTop - 80, behavior: 'smooth' });
}

document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => showStep(btn.dataset.back));
});

function resetFlow() {
  state.selectedService = null;
  state.selectedDate = null;
  state.selectedTime = null;
  showStep('step-service');
}

/* ------------------------------------------------------------------
   MEMBER AUTH (localStorage-based accounts)
   ------------------------------------------------------------------ */
function getMembers() {
  return JSON.parse(localStorage.getItem('fbm_members') || '[]');
}
function saveMember(member) {
  const members = getMembers();
  members.push(member);
  localStorage.setItem('fbm_members', JSON.stringify(members));
}
function findMember(email) {
  return getMembers().find(m => m.email.toLowerCase() === email.toLowerCase());
}
function getCurrentMember() {
  const email = sessionStorage.getItem('fbm_current_member');
  return email ? findMember(email) : null;
}
function setCurrentMember(email) {
  sessionStorage.setItem('fbm_current_member', email);
}
function clearCurrentMember() {
  sessionStorage.removeItem('fbm_current_member');
}

// Simple hash for password storage (not cryptographically secure, but
// avoids storing plaintext in localStorage for a static site)
async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isCreator() {
  const m = getCurrentMember();
  return m && m.role === 'creator';
}

function getMemberBookings(email) {
  return getBookings().filter(b => b.email && b.email.toLowerCase() === email.toLowerCase());
}

/* ------------------------------------------------------------------
   BLOCKED TIME SLOTS (per-date, stored separately from full-day blocks)
   ------------------------------------------------------------------ */
function getBlockedTimes() {
  return JSON.parse(localStorage.getItem('fbm_blocked_times') || '{}');
}
function setBlockedTimes(obj) {
  localStorage.setItem('fbm_blocked_times', JSON.stringify(obj));
}
function getBlockedTimesForDate(dateStr) {
  return getBlockedTimes()[dateStr] || [];
}
function addBlockedTime(dateStr, timeLabel) {
  const all = getBlockedTimes();
  if (!all[dateStr]) all[dateStr] = [];
  if (!all[dateStr].includes(timeLabel)) all[dateStr].push(timeLabel);
  setBlockedTimes(all);
}
function removeBlockedTime(dateStr, timeLabel) {
  const all = getBlockedTimes();
  if (!all[dateStr]) return;
  all[dateStr] = all[dateStr].filter(t => t !== timeLabel);
  if (all[dateStr].length === 0) delete all[dateStr];
  setBlockedTimes(all);
}

/* --- Auth UI wiring (only runs on client page) --- */
function initAuth() {
  const overlay      = document.getElementById('auth-overlay');
  const signinTab    = document.getElementById('auth-signin');
  const signupTab    = document.getElementById('auth-signup');
  const signinForm   = document.getElementById('signin-form');
  const signupForm   = document.getElementById('signup-form');
  const signinError  = document.getElementById('signin-error');
  const signupError  = document.getElementById('signup-error');
  const navAuth      = document.getElementById('nav-auth');
  const navMember    = document.getElementById('nav-member');
  const apptsOverlay = document.getElementById('my-appts-overlay');

  if (!overlay) return; // not on client page

  // Show / hide modal helpers
  function openModal(tab) {
    signinTab.classList.add('hidden');
    signupTab.classList.add('hidden');
    tab.classList.remove('hidden');
    signinError.classList.add('hidden');
    signupError.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
  function closeModal() {
    overlay.classList.add('hidden');
  }

  // Admin mode state
  let adminModeActive = false;

  // Nav buttons
  document.getElementById('nav-signin-btn').addEventListener('click', () => openModal(signinTab));
  document.getElementById('nav-signout-btn').addEventListener('click', () => {
    clearCurrentMember();
    adminModeActive = false;
    refreshAuthUI();
  });
  document.getElementById('auth-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Tab switching
  document.getElementById('show-signup').addEventListener('click', () => openModal(signupTab));
  document.getElementById('show-signin').addEventListener('click', () => openModal(signinTab));

  // Sign Up
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.classList.add('hidden');
    const fd = new FormData(signupForm);
    const email = fd.get('email').trim();
    const name  = fd.get('name').trim();
    const phone = fd.get('phone').trim();
    const pw    = fd.get('password');
    const confirm = fd.get('confirm');

    if (pw !== confirm) {
      signupError.textContent = 'Passwords do not match.';
      signupError.classList.remove('hidden');
      return;
    }
    if (findMember(email)) {
      signupError.textContent = 'An account with this email already exists.';
      signupError.classList.remove('hidden');
      return;
    }

    const creatorCode = (fd.get('creator_code') || '').trim();
    let role = 'member';
    if (creatorCode) {
      if (creatorCode === CONFIG.adminPassword) {
        role = 'creator';
      } else {
        signupError.textContent = 'Invalid creator code.';
        signupError.classList.remove('hidden');
        return;
      }
    }

    const hashed = await hashPassword(pw);
    saveMember({ name, email, phone, role, passwordHash: hashed, createdAt: new Date().toISOString() });
    setCurrentMember(email);
    signupForm.reset();
    closeModal();
    refreshAuthUI();
    prefillBookingForm();
  });

  // Sign In
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signinError.classList.add('hidden');
    const fd = new FormData(signinForm);
    const email = fd.get('email').trim();
    const pw    = fd.get('password');
    const member = findMember(email);

    if (!member) {
      signinError.textContent = 'No account found with this email.';
      signinError.classList.remove('hidden');
      return;
    }
    const hashed = await hashPassword(pw);
    if (hashed !== member.passwordHash) {
      signinError.textContent = 'Incorrect password.';
      signinError.classList.remove('hidden');
      return;
    }

    setCurrentMember(email);
    signinForm.reset();
    closeModal();
    refreshAuthUI();
    prefillBookingForm();
  });

  // My Appointments
  document.getElementById('nav-my-appts-btn').addEventListener('click', () => {
    const member = getCurrentMember();
    if (!member) return;
    document.getElementById('member-greeting').innerHTML =
      `Signed in as <strong>${member.name}</strong> (${member.email})`;
    const list = document.getElementById('my-appts-list');
    const appts = getMemberBookings(member.email);
    if (appts.length === 0) {
      list.innerHTML = '<p class="my-appts-empty">You have no appointments yet. Book one above!</p>';
    } else {
      list.innerHTML = appts.map(b => `
        <div class="my-appt-item">
          <div class="when">${b.date} at ${b.time}</div>
          <div class="what">${b.service} · ${b.duration} min · $${b.price}</div>
        </div>
      `).join('');
    }
    apptsOverlay.classList.remove('hidden');
  });
  document.getElementById('appts-close-btn').addEventListener('click', () => {
    apptsOverlay.classList.add('hidden');
  });
  apptsOverlay.addEventListener('click', e => { if (e.target === apptsOverlay) apptsOverlay.classList.add('hidden'); });

  // Refresh header UI
  function refreshAuthUI() {
    const member = getCurrentMember();
    const creatorControls = document.getElementById('nav-creator-controls');
    const creatorPanel = document.getElementById('creator-panel');
    const toggleBtn = document.getElementById('nav-admin-toggle');

    if (member) {
      navAuth.classList.add('hidden');
      navMember.classList.remove('hidden');
      if (member.role === 'creator') {
        creatorControls.classList.remove('hidden');
      } else {
        creatorControls.classList.add('hidden');
        if (creatorPanel) creatorPanel.classList.add('hidden');
      }
    } else {
      navAuth.classList.remove('hidden');
      navMember.classList.add('hidden');
      creatorControls.classList.add('hidden');
      if (creatorPanel) creatorPanel.classList.add('hidden');
      if (toggleBtn) { toggleBtn.textContent = 'Admin Mode'; toggleBtn.classList.remove('active'); }
    }
  }

  // Admin mode toggle
  document.getElementById('nav-admin-toggle').addEventListener('click', () => {
    adminModeActive = !adminModeActive;
    const toggleBtn = document.getElementById('nav-admin-toggle');
    const panel = document.getElementById('creator-panel');
    const clientView = document.getElementById('client-view');
    if (adminModeActive) {
      toggleBtn.textContent = 'Booking Mode';
      toggleBtn.classList.add('active');
      clientView.classList.add('hidden');
      panel.classList.remove('hidden');
      initCreatorPanel();
    } else {
      toggleBtn.textContent = 'Admin Mode';
      toggleBtn.classList.remove('active');
      panel.classList.add('hidden');
      clientView.classList.remove('hidden');
      renderCalendar();
    }
  });

  refreshAuthUI();
}

/* ------------------------------------------------------------------
   CREATOR PANEL LOGIC
   ------------------------------------------------------------------ */
const creatorMonth = { current: new Date() };
let creatorSelectedDateKey = null;

function initCreatorPanel() {
  renderCreatorStats();
  renderCreatorCalendar();
  renderCreatorBookings();
  wireCreatorToolbar();
}

function renderCreatorStats() {
  const bookings = getBookings();
  const blocked = getBlockedDates();
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = bookings.filter(b => { const d = new Date(b.date); return d >= today; });
  const revenue = upcoming.reduce((sum, b) => sum + (b.price || 0), 0);
  const bar = document.getElementById('creator-stats-bar');
  if (!bar) return;
  bar.innerHTML = `
    <div class="stat-card"><div class="number">${bookings.length}</div><div class="label">Total Bookings</div></div>
    <div class="stat-card"><div class="number">${upcoming.length}</div><div class="label">Upcoming</div></div>
    <div class="stat-card"><div class="number">${blocked.length}</div><div class="label">Days Blocked</div></div>
    <div class="stat-card"><div class="number">$${revenue}</div><div class="label">Upcoming Revenue</div></div>
  `;
}

function renderCreatorCalendar() {
  const grid = document.getElementById('creator-calendar-grid');
  const label = document.getElementById('creator-month-label');
  if (!grid || !label) return;
  grid.innerHTML = '';

  const year = creatorMonth.current.getFullYear();
  const month = creatorMonth.current.getMonth();
  label.textContent = formatMonth(creatorMonth.current);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();

  // Build set of dates with bookings
  const bookings = getBookings();
  const bookedDates = new Set();
  bookings.forEach(b => { const d = new Date(b.date); if (!isNaN(d)) bookedDates.add(dateKey(d)); });

  for (let i = 0; i < startPad; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    const key = dateKey(d);
    const cell = document.createElement('button');
    cell.className = 'cal-day';
    cell.textContent = day;

    const isWorkingDay = CONFIG.workingDays.includes(d.getDay());
    const blocked = isBlocked(key);
    const hasBooking = bookedDates.has(key);
    const isToday = dateKey(d) === dateKey(new Date());

    if (isToday) cell.classList.add('today');
    if (!isWorkingDay) cell.classList.add('disabled');
    if (blocked) cell.classList.add('admin-blocked');
    if (hasBooking) cell.classList.add('has-booking');

    if (isWorkingDay) {
      cell.addEventListener('click', () => {
        toggleBlocked(key);
        renderCreatorCalendar();
        renderCreatorStats();
        showCreatorDayDetail(d, key);
      });
      cell.addEventListener('contextmenu', e => {
        e.preventDefault();
        showCreatorDayDetail(d, key);
      });
    }

    grid.appendChild(cell);
  }
}

function showCreatorDayDetail(date, key) {
  creatorSelectedDateKey = key;
  const detail = document.getElementById('creator-day-detail');
  const title = document.getElementById('creator-day-title');
  const list = document.getElementById('creator-day-list');
  const emptyMsg = document.getElementById('creator-day-empty');

  detail.classList.remove('hidden');
  title.textContent = 'Bookings for ' + formatDate(date);

  const dayBookings = getBookings().filter(b => {
    const d = new Date(b.date);
    return !isNaN(d) && dateKey(d) === key;
  });

  list.innerHTML = '';
  if (dayBookings.length === 0) {
    emptyMsg.classList.remove('hidden');
  } else {
    emptyMsg.classList.add('hidden');
    dayBookings.forEach((b, i) => {
      // Find actual index in full bookings array
      const allBookings = getBookings();
      const realIdx = allBookings.findIndex(ab =>
        ab.submittedAt === b.submittedAt && ab.email === b.email && ab.time === b.time
      );
      const item = document.createElement('div');
      item.className = 'day-booking-item';
      item.innerHTML = `
        <span class="time-badge">${b.time}</span>
        <div class="info">
          <strong>${b.name}</strong> — ${b.service}<br>
          ${b.email}${b.phone ? ' · ' + b.phone : ''}
          ${b.notes ? '<br><em>"' + b.notes + '"</em>' : ''}
        </div>
        <div>
          <button class="edit-btn" data-idx="${realIdx}">Edit</button>
          <button class="remove-btn" data-idx="${realIdx}">Remove</button>
        </div>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditBooking(parseInt(btn.dataset.idx)));
    });
    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Remove this booking?')) return;
        const idx = parseInt(btn.dataset.idx);
        const bookings = getBookings();
        bookings.splice(idx, 1);
        localStorage.setItem('fbm_bookings', JSON.stringify(bookings));
        showCreatorDayDetail(date, key);
        renderCreatorCalendar();
        renderCreatorStats();
        renderCreatorBookings();
      });
    });
  }

  // Render blocked time slots UI
  renderBlockedTimesUI(key);
}

function renderBlockedTimesUI(dateStr) {
  const select = document.getElementById('creator-block-time-select');
  const blockedList = document.getElementById('creator-blocked-times-list');
  if (!select || !blockedList) return;

  const bookedTimes = getBookedTimesForDate(dateStr);
  const blockedTimes = getBlockedTimesForDate(dateStr);
  const startMinutes = CONFIG.workingHours.start * 60;
  const endMinutes = CONFIG.workingHours.end * 60;
  const minDuration = Math.min(...CONFIG.services.map(s => s.duration));

  // Populate select with available times
  select.innerHTML = '';
  for (let m = startMinutes; m + minDuration <= endMinutes; m += minDuration) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const label = formatTime(h, min);
    if (!bookedTimes.includes(label) && !blockedTimes.includes(label)) {
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      select.appendChild(opt);
    }
  }
  if (select.options.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'All slots blocked or booked';
    opt.disabled = true;
    select.appendChild(opt);
  }

  // Show currently blocked times
  blockedList.innerHTML = '';
  if (blockedTimes.length > 0) {
    blockedTimes.forEach(t => {
      const tag = document.createElement('span');
      tag.className = 'blocked-time-tag';
      tag.innerHTML = `${t} <button data-time="${t}" title="Unblock">&times;</button>`;
      blockedList.appendChild(tag);
    });
    blockedList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        removeBlockedTime(dateStr, btn.dataset.time);
        renderBlockedTimesUI(dateStr);
      });
    });
  }
}

// Wire the "Block Time" button
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'creator-block-time-btn') {
    const select = document.getElementById('creator-block-time-select');
    if (!select || !select.value || !creatorSelectedDateKey) return;
    addBlockedTime(creatorSelectedDateKey, select.value);
    renderBlockedTimesUI(creatorSelectedDateKey);
  }
});

/* --- Edit Booking Modal --- */
function openEditBooking(idx) {
  const bookings = getBookings();
  const b = bookings[idx];
  if (!b) return;

  const overlay = document.getElementById('edit-booking-overlay');
  const form = document.getElementById('edit-booking-form');
  overlay.classList.remove('hidden');

  form.querySelector('[name="idx"]').value = idx;
  form.querySelector('[name="name"]').value = b.name || '';
  form.querySelector('[name="email"]').value = b.email || '';
  form.querySelector('[name="phone"]').value = b.phone || '';
  form.querySelector('[name="notes"]').value = b.notes || '';

  // Populate service select
  const serviceSelect = form.querySelector('[name="service"]');
  serviceSelect.innerHTML = '';
  CONFIG.services.forEach(svc => {
    const opt = document.createElement('option');
    opt.value = svc.name;
    opt.textContent = `${svc.name} (${svc.duration} min · $${svc.price})`;
    if (svc.name === b.service) opt.selected = true;
    serviceSelect.appendChild(opt);
  });

  // Parse date
  const parsedDate = new Date(b.date);
  if (!isNaN(parsedDate)) {
    form.querySelector('[name="date"]').value = dateKey(parsedDate);
  }

  // Parse time — convert "2:00pm" to "14:00"
  const timeInput = form.querySelector('[name="time"]');
  if (b.time) {
    const match = b.time.match(/^(\d+):(\d+)(am|pm)$/i);
    if (match) {
      let h = parseInt(match[1]);
      const min = match[2];
      const period = match[3].toLowerCase();
      if (period === 'pm' && h !== 12) h += 12;
      if (period === 'am' && h === 12) h = 0;
      timeInput.value = `${String(h).padStart(2,'0')}:${min}`;
    }
  }
}

// Close edit modal
document.getElementById('edit-booking-close').addEventListener('click', () => {
  document.getElementById('edit-booking-overlay').classList.add('hidden');
});
document.getElementById('edit-booking-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('edit-booking-overlay')) {
    document.getElementById('edit-booking-overlay').classList.add('hidden');
  }
});

// Save edited booking
document.getElementById('edit-booking-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const idx = parseInt(form.querySelector('[name="idx"]').value);
  const bookings = getBookings();
  if (!bookings[idx]) return;

  const serviceName = form.querySelector('[name="service"]').value;
  const svc = CONFIG.services.find(s => s.name === serviceName) || {};

  // Parse date back to display format
  const dateVal = form.querySelector('[name="date"]').value;
  const dateObj = new Date(dateVal + 'T12:00:00');
  const displayDate = formatDate(dateObj);

  // Parse time back to display format
  const timeVal = form.querySelector('[name="time"]').value;
  const [hh, mm] = timeVal.split(':').map(Number);
  const displayTime = formatTime(hh, mm);

  bookings[idx] = {
    ...bookings[idx],
    name: form.querySelector('[name="name"]').value,
    email: form.querySelector('[name="email"]').value,
    phone: form.querySelector('[name="phone"]').value || '',
    notes: form.querySelector('[name="notes"]').value || '',
    service: serviceName,
    duration: svc.duration || bookings[idx].duration,
    price: svc.price || bookings[idx].price,
    date: displayDate,
    time: displayTime,
  };

  localStorage.setItem('fbm_bookings', JSON.stringify(bookings));
  document.getElementById('edit-booking-overlay').classList.add('hidden');

  // Refresh all creator views
  renderCreatorCalendar();
  renderCreatorStats();
  renderCreatorBookings();
  // Re-show day detail if it was open
  if (creatorSelectedDateKey) {
    const d = new Date(dateVal + 'T12:00:00');
    showCreatorDayDetail(d, dateKey(d));
  }
});

/* --- Creator All Bookings List --- */
function renderCreatorBookings() {
  const list = document.getElementById('creator-bookings-list');
  if (!list) return;
  const bookings = getBookings();
  if (bookings.length === 0) {
    list.innerHTML = '<p class="note">No booking requests yet.</p>';
    return;
  }
  list.innerHTML = '';
  bookings.forEach((b, i) => {
    const item = document.createElement('div');
    item.className = 'booking-item';
    item.innerHTML = `
      <div>
        <div class="when">${b.date} · ${b.time}</div>
        <div class="who"><strong>${b.name}</strong> — ${b.service} · $${b.price || '—'}</div>
        <div style="font-size:0.85rem;color:var(--ink-soft);margin-top:.3rem;">
          ${b.email}${b.phone ? ' · ' + b.phone : ''}
        </div>
        ${b.notes ? '<div style="font-size:0.85rem;margin-top:.4rem;font-style:italic;">"' + b.notes + '"</div>' : ''}
      </div>
      <div style="display:flex;gap:.5rem;align-items:flex-start;">
        <button class="edit-btn" data-idx="${i}" style="background:none;border:none;color:var(--deep-sage);cursor:pointer;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.2em;">Edit</button>
        <button class="delete" data-idx="${i}">Remove</button>
      </div>
    `;
    list.appendChild(item);
  });
  list.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditBooking(parseInt(btn.dataset.idx)));
  });
  list.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Remove this booking?')) return;
      const idx = parseInt(btn.dataset.idx);
      const bookings = getBookings();
      bookings.splice(idx, 1);
      localStorage.setItem('fbm_bookings', JSON.stringify(bookings));
      renderCreatorBookings();
      renderCreatorCalendar();
      renderCreatorStats();
    });
  });
}

/* --- Creator Toolbar Wiring --- */
let creatorToolbarWired = false;
function wireCreatorToolbar() {
  if (creatorToolbarWired) return;
  creatorToolbarWired = true;

  document.getElementById('creator-prev-month').addEventListener('click', () => {
    creatorMonth.current = new Date(creatorMonth.current.getFullYear(), creatorMonth.current.getMonth() - 1, 1);
    renderCreatorCalendar();
  });
  document.getElementById('creator-next-month').addEventListener('click', () => {
    creatorMonth.current = new Date(creatorMonth.current.getFullYear(), creatorMonth.current.getMonth() + 1, 1);
    renderCreatorCalendar();
  });
  document.getElementById('creator-clear-blocked').addEventListener('click', () => {
    if (confirm('Clear ALL blocked dates and times?')) {
      setBlockedDates([]);
      setBlockedTimes({});
      renderCreatorCalendar();
      renderCreatorStats();
    }
  });
  document.getElementById('creator-export').addEventListener('click', () => {
    const data = {
      blockedDates: getBlockedDates(),
      blockedTimes: getBlockedTimes(),
      bookings: getBookings(),
      members: getMembers().map(m => ({ name: m.name, email: m.email, role: m.role, createdAt: m.createdAt })),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'fbm-data-' + dateKey(new Date()) + '.json';
    link.href = URL.createObjectURL(blob);
    link.click();
  });
}

// Pre-fill booking form with member details
function prefillBookingForm() {
  const member = getCurrentMember();
  if (!member) return;
  const form = document.getElementById('booking-form');
  if (!form) return;
  const nameInput  = form.querySelector('input[name="name"]');
  const emailInput = form.querySelector('input[name="email"]');
  const phoneInput = form.querySelector('input[name="phone"]');
  if (nameInput  && !nameInput.value)  nameInput.value  = member.name;
  if (emailInput && !emailInput.value) emailInput.value = member.email;
  if (phoneInput && !phoneInput.value && member.phone) phoneInput.value = member.phone;
}

/* ------------------------------------------------------------------
   ADMIN VIEW (moved to admin.html — shared functions remain here)
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------
   INIT
   ------------------------------------------------------------------ */
function init() {
  // If on admin page, skip client init
  if (!document.getElementById('client-view')) return;

  // Legacy: redirect ?admin=1 to admin.html
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1') {
    window.location.href = 'admin.html';
    return;
  }

  renderServices();
  initAuth();
}

init();

/* ==================================================================
   CHATBOT — rule-based, free, trained on your FAQ
   ==================================================================
   HOW TO EDIT: add/edit entries in CHATBOT_KNOWLEDGE below.
   Each entry has:
     - keywords: array of words to match (lowercase). If ANY keyword
       appears in the visitor's question, this answer is returned.
     - response:  what the bot says.
   Entries are checked top-to-bottom — put MORE specific entries FIRST.
   ================================================================== */

const CHATBOT_KNOWLEDGE = [
  {
    keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon'],
    response: "Hello! I'm here to help answer questions about Floral Botanical Medicine. You can ask me about services, pricing, booking, what to expect, and more. What would you like to know?"
  },
  {
    keywords: ['live blood', 'microscope', 'microscopy', 'blood analysis', 'blood work', 'what is blood', 'darkfield', 'dark field'],
    response: "Microscope Live Blood Analysis is a 60-minute session ($350) using high-powered darkfield microscopy to examine a single drop of your living blood — in real time, while the cells are still alive and moving.\n\nUnlike standard blood tests that destroy the sample, live blood analysis lets us see:\n\n• Red blood cell shape, size, and vitality\n• Rouleaux (cells stacking like coins — a sign of poor hydration, mineral deficiency, or pH imbalance)\n• White blood cell activity and immune response\n• Signs of oxidative stress and free radical damage\n• Fibrin and early clotting patterns\n• Crystal formations (uric acid, cholesterol)\n• Indicators of nutritional deficiency\n• Microbial activity and terrain imbalance\n\nThis is one of the most powerful tools I use alongside botanical medicine — it puts you in direct relationship with your own terrain. You see what standard labs cannot show."
  },
  {
    keywords: ['rouleaux', 'stacking', 'sticky blood', 'coins', 'blood cells stacking'],
    response: "Rouleaux is when your red blood cells stack together like a roll of coins instead of flowing freely. Under the darkfield microscope, healthy red blood cells should be round, separate, and bouncing gently off each other.\n\nWhen I see rouleaux in a client's blood, it often points to:\n• Dehydration\n• Mineral deficiency (especially magnesium and zinc)\n• pH imbalance or excess acidity\n• Poor circulation\n• High-protein or high-sugar diet stress\n\nThe good news: rouleaux often resolves quickly with proper hydration, mineral support, and dietary adjustments. Many clients see visible improvement in a follow-up session."
  },
  {
    keywords: ['what can you see', 'what does it show', 'what do you look for', 'what will i learn', 'findings'],
    response: "During a Live Blood Analysis session, here's what I look for under the microscope:\n\n• Red blood cells — shape, size, color, spacing, and movement tell the story of oxygen delivery and mineral status\n• White blood cells — their number, activity, and behavior reveal immune health\n• Platelets — clumping patterns can indicate inflammation or circulatory stress\n• Fibrin — excess fibrin suggests the body is in a chronic inflammatory or clotting state\n• Crystal formations — uric acid crystals, cholesterol plaques, or calcium deposits\n• Microbial terrain — signs of yeast, bacteria, or parasitic activity\n• Free radical damage — 'spicule' cells or damaged membranes show oxidative stress\n• Plasma quality — the liquid portion tells us about hydration, liver function, and toxicity\n\nI photograph everything and walk you through each finding. Most clients say it's the most eye-opening health experience they've ever had."
  },
  {
    keywords: ['terrain', 'terrain theory', 'germ theory', 'bechamp', 'environment'],
    response: "Terrain theory is the foundation of my practice. It's the idea that the internal environment of the body — the terrain — determines whether disease can take hold, not the germ itself.\n\nAntoine Béchamp taught this alongside Pasteur, but history chose Pasteur's germ theory. Live blood microscopy brings terrain theory to life — literally. Under the microscope, you can see the state of your terrain: how your cells move, what's floating in your plasma, whether your immune system is active or sluggish.\n\nA clean, well-mineralized, properly hydrated terrain doesn't host disease. That's the whole premise of what we do here."
  },
  {
    keywords: ['dr botha', 'okker botha', 'botha'],
    response: "Dr. Okker Botha is one of the most respected voices in live blood analysis education. His presentations have helped thousands of practitioners understand what darkfield microscopy reveals about the blood — from rouleaux and fibrin networks to microbial terrain indicators.\n\nHis work reinforces what we practice here: the blood is a living mirror of the body's internal environment. When you look at living blood under a microscope, you see the terrain in real time. That's why live blood analysis is one of the most powerful tools in my practice."
  },
  {
    keywords: ['oxidative', 'free radical', 'stress', 'damage', 'antioxidant'],
    response: "Under the darkfield microscope, oxidative stress shows up clearly — red blood cells develop tiny projections called spicules (echinocytes), or their membranes look rough and irregular instead of smooth and round.\n\nThis tells me the body is under free radical attack and doesn't have enough antioxidant protection. Common causes include:\n• Poor diet (processed foods, excess sugar)\n• Environmental toxins and heavy metals\n• Chronic stress and poor sleep\n• EMF exposure\n• Insufficient intake of vitamin C, E, selenium, or glutathione precursors\n\nWe address this through targeted botanical protocols, mineral support, and lifestyle changes. Many clients see improvement within weeks."
  },
  {
    keywords: ['fibrin', 'clotting', 'thick blood', 'circulation'],
    response: "Fibrin is a protein involved in blood clotting. Under the microscope, healthy blood has minimal fibrin — just thin, occasional threads. When I see thick fibrin networks webbing across the sample, it suggests:\n\n• Chronic inflammation\n• Liver congestion\n• Poor circulation\n• The body is in a state of ongoing repair or damage\n\nExcess fibrin can make the blood thick and sluggish, which means oxygen and nutrients aren't reaching tissues efficiently. We support this with anti-inflammatory herbs, liver-supportive protocols, and enzymes like nattokinase or serrapeptase."
  },
  {
    keywords: ['hydration', 'water', 'dehydrated', 'drink'],
    response: "Hydration is one of the first things I assess under the microscope. Dehydrated blood looks dramatically different from well-hydrated blood — the red cells clump together, the plasma looks dense, and everything moves sluggishly.\n\nProper hydration means more than drinking water. It means:\n• Drinking structured or mineralized water\n• Adding trace minerals or a pinch of sea salt\n• Avoiding dehydrating substances (excess caffeine, alcohol)\n• Eating water-rich whole foods\n\nMany clients see visible improvement in their blood within days of improving their hydration and mineral intake. It's often the simplest and most powerful first step."
  },
  {
    keywords: ['crystal', 'uric acid', 'cholesterol', 'plaque'],
    response: "Crystal formations in live blood can reveal several things:\n\n• Uric acid crystals — sharp, needle-like shapes that suggest the body isn't clearing metabolic waste efficiently. Often linked to high-protein diets, poor kidney function, or gout risk.\n• Cholesterol plaques — layered, plate-like formations that indicate lipid metabolism issues.\n• Calcium deposits — can appear when calcium isn't being properly directed to bones and teeth.\n\nAll of these are terrain indicators — they show that something in the body's filtration, diet, or mineral balance needs attention. We address the root cause, not just the symptom."
  },
  {
    keywords: ['does it hurt', 'needle', 'prick', 'finger', 'sample', 'how much blood'],
    response: "The blood draw is incredibly simple — just a tiny finger prick, similar to a blood sugar test. We only need a single drop of blood, placed on a glass slide under a coverslip.\n\nThere's no vein draw, no tubes, no lab. The sample goes straight under the darkfield microscope and we examine it together in real time. Most clients say the prick is barely noticeable — and the experience of seeing their own living blood is unforgettable."
  },
  {
    keywords: ['initial', 'first appointment', 'first visit', 'first time', 'new client', 'new patient'],
    response: "An Initial Consultation is 60 minutes ($250) and is your first step. We'll go deep into your health history, goals, symptoms, and lifestyle to create a botanical plan tailored to you. Come prepared to talk about yourself — everything from sleep and stress to diet and emotions is fair game."
  },
  {
    keywords: ['follow up', 'follow-up', 'followup', 'next appointment', 'subsequent'],
    response: "A Follow-Up Session is 45 minutes ($140) and is for returning clients. We review how you're doing, adjust any protocols, and continue deepening your healing journey."
  },
  {
    keywords: ['price', 'prices', 'cost', 'costs', 'how much', 'fee', 'fees', 'pricing', 'rates'],
    response: "Here are my current rates:\n\n• Initial Consultation (60 min) — $250\n• Microscope Live Blood Analysis (60 min) — $350\n• Follow-Up Session (45 min) — $140"
  },
  {
    keywords: ['book', 'booking', 'schedule', 'appointment', 'reserve', 'make an appointment'],
    response: "You can book an appointment right on this page! Just scroll up, choose a session, pick a date on the calendar, select a time, and fill out your details. I'll receive your request and reach out to confirm."
  },
  {
    keywords: ['hours', 'open', 'when are you', 'availability', 'days', 'working hours'],
    response: "I see clients Monday through Friday, 9am to 4pm Eastern. You can see my real-time availability on the booking calendar above."
  },
  {
    keywords: ['insurance', 'hsa', 'fsa', 'covered', 'coverage'],
    response: "I don't currently bill insurance directly, but I can provide you with a receipt (superbill) that you can submit to your insurance or HSA/FSA account for potential reimbursement. Please check with your provider first to confirm what they cover."
  },
  {
    keywords: ['prepare', 'preparation', 'before appointment', 'bring', 'what to bring', 'ready'],
    response: "For a regular consultation: come well-hydrated, bring any recent labs or health records, and a list of current supplements or medications.\n\nFor Live Blood Analysis: please arrive well-hydrated and avoid heavy meals for 2-3 hours beforehand for the clearest reading."
  },
  {
    keywords: ['cancel', 'cancellation', 'reschedule', 'change appointment'],
    response: "I ask for at least 24 hours notice for any cancellations or reschedules so I can offer the time to another client. You can email me directly to cancel or reschedule."
  },
  {
    keywords: ['how many sessions', 'how long', 'how often', 'how many appointments', 'length of treatment'],
    response: "Healing is a lifelong marathon, not a quick fix. Most clients see meaningful progress within 3-6 sessions over several months, but it truly depends on your unique situation and goals. We'll create a plan together during your initial consultation."
  },
  {
    keywords: ['botanical', 'herbs', 'herbal', 'plants', 'plant medicine', 'herbalism'],
    response: "Botanical medicine is the practice of using plants and their preparations to support health and healing. I work with teas, tinctures, powders, flower essences, and other plant-based remedies drawn from traditional herbalism and modern research, tailored to your individual needs."
  },
  {
    keywords: ['location', 'where', 'address', 'office', 'directions', 'based'],
    response: "Please visit floralbotanicalmedicine.com or email me directly for location and directions. Some sessions may also be offered virtually — ask me during booking!"
  },
  {
    keywords: ['virtual', 'online', 'zoom', 'remote', 'phone', 'video'],
    response: "Some sessions can be conducted virtually via video call. Live Blood Analysis must be done in person since we need a physical sample. Please note in your booking request if you'd prefer a virtual session."
  },
  {
    keywords: ['contact', 'email', 'reach', 'get in touch', 'phone number'],
    response: "The best way to reach me is through the booking form on this page, or you can visit floralbotanicalmedicine.com for additional contact information."
  },
  {
    keywords: ['safe', 'safety', 'side effects', 'interactions', 'medications'],
    response: "Botanical medicine, when practiced properly, is generally very safe. However, some herbs can interact with medications. I always review your current medications during your initial consultation to ensure everything I recommend is safe for you. Please bring a full list of anything you're currently taking."
  },
  {
    keywords: ['pregnant', 'pregnancy', 'nursing', 'breastfeeding', 'baby'],
    response: "Botanical medicine can be wonderfully supportive during pregnancy and nursing, but there are specific considerations and some herbs to avoid. I welcome pregnant and nursing clients — please mention this when you book so I can prepare accordingly."
  },
  {
    keywords: ['thank', 'thanks', 'appreciate', 'grateful'],
    response: "You're so welcome. I'm happy to help anytime. When you're ready, you can book an appointment right here on the page. 🌿"
  },
];

const CHATBOT_FALLBACK = "That's a great question — I don't have a canned answer for that one. The best way to get a thoughtful response is to book an Initial Consultation above, or email directly through floralbotanicalmedicine.com. Is there anything else I can help with?";

const CHATBOT_GREETING = "Hello! 🌿 I'm the Floral Botanical Medicine assistant. Ask me anything about services, pricing, booking, or what to expect. Or tap one of the suggestions below.";

const QUICK_REPLIES = [
  'What is live blood analysis?',
  'What can you see in my blood?',
  'What are your prices?',
  'Does the finger prick hurt?',
  'How do I book?',
  'What is terrain theory?',
];

/* ---------- CHATBOT LOGIC ---------- */
const chatToggle   = document.getElementById('chat-toggle');
const chatWindow   = document.getElementById('chat-window');
const chatClose    = document.getElementById('chat-close');
const chatMessages = document.getElementById('chat-messages');
const chatForm     = document.getElementById('chat-form');
const chatInput    = document.getElementById('chat-input');
const quickReplies = document.getElementById('chat-quick-replies');

let chatInitialized = false;

function openChat() {
  chatWindow.classList.remove('hidden');
  chatToggle.classList.add('hidden');
  if (!chatInitialized) {
    chatInitialized = true;
    setTimeout(() => {
      addBotMessage(CHATBOT_GREETING);
      renderQuickReplies();
    }, 300);
  }
  setTimeout(() => chatInput.focus(), 400);
}
function closeChat() {
  chatWindow.classList.add('hidden');
  chatToggle.classList.remove('hidden');
}
chatToggle.addEventListener('click', openChat);
chatClose.addEventListener('click', closeChat);

function addUserMessage(text) {
  const el = document.createElement('div');
  el.className = 'chat-message user';
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function addBotMessage(text) {
  const el = document.createElement('div');
  el.className = 'chat-message bot';
  // preserve line breaks
  el.innerHTML = text.replace(/\n/g, '<br>');
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function showTyping() {
  const el = document.createElement('div');
  el.className = 'chat-message typing';
  el.id = 'typing-indicator';
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function renderQuickReplies() {
  quickReplies.innerHTML = '';
  QUICK_REPLIES.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'quick-reply';
    btn.textContent = q;
    btn.addEventListener('click', () => {
      handleUserInput(q);
    });
    quickReplies.appendChild(btn);
  });
}

function findResponse(input) {
  const text = input.toLowerCase();
  for (const entry of CHATBOT_KNOWLEDGE) {
    for (const kw of entry.keywords) {
      if (text.includes(kw)) return entry.response;
    }
  }
  return CHATBOT_FALLBACK;
}

function handleUserInput(text) {
  if (!text.trim()) return;
  addUserMessage(text);
  chatInput.value = '';
  quickReplies.innerHTML = ''; // hide suggestions once user engages

  showTyping();
  setTimeout(() => {
    hideTyping();
    const response = findResponse(text);
    addBotMessage(response);
    // re-show suggestions after a bit for re-engagement
    setTimeout(renderQuickReplies, 600);
  }, 700 + Math.random() * 500); // realistic typing delay
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleUserInput(chatInput.value);
});
