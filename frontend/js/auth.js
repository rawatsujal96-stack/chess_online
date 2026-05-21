/* =====================================================
   auth.js — Authentication & Session Management
   ===================================================== */

const API_BASE = 'http://localhost:3000/api';

/* ── Session Helpers ── */
function getSession() {
  try { return JSON.parse(localStorage.getItem('chess_session')) || null; }
  catch { return null; }
}

function setSession(data) {
  localStorage.setItem('chess_session', JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem('chess_session');
}

function isLoggedIn() {
  const s = getSession();
  return s && s.token && s.username;
}

function getUsername() {
  const s = getSession();
  return s ? s.username : null;
}

function getToken() {
  const s = getSession();
  return s ? s.token : null;
}

/* ── Update Nav based on session ── */
function updateNav() {
  const nav = document.getElementById('navLinks');
  if (!nav) return;
  if (isLoggedIn()) {
    nav.innerHTML = `
      <a href="../index.html">Home</a>
      <a href="multiplayer.html">Multiplayer</a>
      <span style="opacity:0.6;font-size:0.82rem;text-transform:uppercase;letter-spacing:.5px;">${getUsername()}</span>
      <a href="#" onclick="logout()">Logout</a>
    `;
  } else {
    nav.innerHTML = `
      <a href="../index.html">Home</a>
      <a href="login.html">Login</a>
      <a href="register.html">Register</a>
    `;
  }
}

/* ── Toast ── */
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/* ── Login ── */
async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errEl = document.getElementById('loginError');

  if (!username || !password) {
    showLoginError('Please enter username and password.'); return;
  }

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setSession({ token: data.token, username: data.username, isGuest: false });
      showToast('Logged in!');
      setTimeout(() => window.location.href = 'multiplayer.html', 800);
    } else {
      showLoginError(data.message || 'Login failed.');
    }
  } catch (e) {
    // Fallback offline login simulation
    if (username.length >= 2 && password.length >= 1) {
      setSession({ token: 'offline_' + Date.now(), username, isGuest: false });
      showToast('Logged in (offline mode)!');
      setTimeout(() => window.location.href = 'multiplayer.html', 800);
    } else {
      showLoginError('Server unavailable. Try guest login.');
    }
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

/* ── Register ── */
async function doRegister() {
  const username = document.getElementById('username').value.trim();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirm  = document.getElementById('confirm').value;

  let valid = true;
  clearRegErrors();

  if (username.length < 3) { showFieldErr('usernameErr', 'At least 3 characters.'); valid = false; }
  if (!email.includes('@')) { showFieldErr('emailErr', 'Valid email required.'); valid = false; }
  if (password.length < 6) { showFieldErr('passwordErr', 'At least 6 characters.'); valid = false; }
  if (password !== confirm) { showFieldErr('confirmErr', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setSession({ token: data.token, username: data.username, isGuest: false });
      showToast('Account created!');
      setTimeout(() => window.location.href = 'multiplayer.html', 800);
    } else {
      const el = document.getElementById('regError');
      if (el) { el.textContent = data.message || 'Registration failed.'; el.style.display = 'block'; }
    }
  } catch (e) {
    // Offline fallback
    setSession({ token: 'offline_' + Date.now(), username, isGuest: false });
    showToast('Account created (offline mode)!');
    setTimeout(() => window.location.href = 'multiplayer.html', 800);
  }
}

function showFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); el.style.display = 'block'; }
}

function clearRegErrors() {
  ['usernameErr','emailErr','passwordErr','confirmErr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('show'); el.style.display = 'none'; }
  });
  const re = document.getElementById('regError');
  if (re) { re.textContent = ''; re.style.display = 'none'; }
}

/* ── Guest Login ── */
function doGuestLogin() {
  const guestName = 'Guest_' + Math.floor(Math.random() * 9000 + 1000);
  setSession({ token: 'guest_' + Date.now(), username: guestName, isGuest: true });
  showToast(`Playing as ${guestName}`);
  setTimeout(() => window.location.href = 'multiplayer.html', 800);
}

function guestLogin() { doGuestLogin(); }

/* ── Logout ── */
function logout() {
  clearSession();
  window.location.href = '../index.html';
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  updateNav();

  // Handle Enter key on login/register forms
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (document.getElementById('loginBtn')) doLogin();
    }
  });
});
