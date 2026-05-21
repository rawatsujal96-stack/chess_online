/* =====================================================
   multiplayer.js — Online Multiplayer Lobby
   ===================================================== */

const MP_API = 'https://chess-online-1-n2xg.onrender.com/api';

let selectedCreateTime  = 300;
let selectedCreateColor = 'white';

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (!session || !session.token) {
    document.getElementById('authWall').style.display = 'block';
    document.getElementById('lobbyWall').style.display = 'none';
  } else {
    document.getElementById('authWall').style.display = 'none';
    document.getElementById('lobbyWall').style.display = 'block';
    document.getElementById('lobbyUsername').textContent = session.username;
    refreshRooms();
    setInterval(refreshRooms, 8000);
  }
});

function getSession() {
  try { return JSON.parse(localStorage.getItem('chess_session')); }
  catch { return null; }
}

/* ── Time / Color ── */
function selectCreateTime(btn) {
  document.querySelectorAll('#createTimeSelector .time-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCreateTime = parseInt(btn.dataset.time);
}

function selectCreateColor(btn) {
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCreateColor = btn.dataset.color;
}

/* ── Create Room ── */
async function createRoom() {
  const session = getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const roomName = document.getElementById('roomName').value.trim() || `${session.username}'s game`;
  let color = selectedCreateColor;
  if (color === 'random') color = Math.random() < 0.5 ? 'white' : 'black';

  try {
    const res = await fetch(`${MP_API}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({ name: roomName, timeLimit: selectedCreateTime, hostColor: color })
    });
    const data = await res.json();
   if (res.ok && data.roomId) {
alert("Room ID: " + data.roomId);
  window.location.href =
  `game.html?mode=online&room=${data.roomId}&color=${color}&time=${selectedCreateTime}`;


    } else {
      showToast(data.message || 'Failed to create room');
    }
  } catch (e) {

  console.error(e);

  showToast('Server connection failed');

}
}

/* ── Refresh Room List ── */
async function refreshRooms() {
  const session = getSession();
  const listEl = document.getElementById('roomList');
  const noMsg  = document.getElementById('noRoomsMsg');
  if (!listEl) return;

  try {
    const res = await fetch(`${MP_API}/rooms`, {
      headers: { 'Authorization': `Bearer ${session.token}` }
    });
    const data = await res.json();
    const rooms = data.rooms || [];
    renderRooms(rooms, listEl, noMsg);
  } catch (e) {
    // Offline: show empty
    renderRooms([], listEl, noMsg);
  }
}

function renderRooms(rooms, listEl, noMsg) {
  listEl.innerHTML = '';
  if (rooms.length === 0) {
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.className = 'room-item';
    const timeLabel = room.timeLimit === 0 ? '∞' : (room.timeLimit / 60) + 'min';
    li.innerHTML = `
      <div>
        <div class="room-name">${escHtml(room.name)}</div>
        <div class="room-meta">${escHtml(room.host)} · ${timeLabel}</div>
      </div>
      <span class="room-badge waiting">Waiting</span>
      <button class="btn btn-primary" onclick="joinRoom('${room.id}', ${room.timeLimit})">Join</button>
    `;
    listEl.appendChild(li);
  });
}

/* ── Join Room ── */
async function joinRoom(roomId, timeLimit) {
  const session = getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  try {
    const res = await fetch(`${MP_API}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      }
    });
    const data = await res.json();
    if (res.ok) {
      const color = data.color || 'black';
      window.location.href = `game.html?mode=online&room=${roomId}&color=${color}&time=${timeLimit}`;
    } else {
      showToast(data.message || 'Failed to join room');
    }
  } catch (e) {
    showToast('Server unavailable — cannot join room in offline mode');
  }
}

/* ── Logout ── */
function logout() {
  localStorage.removeItem('chess_session');
  window.location.reload();
}

/* ── Helpers ── */
function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showToast(msg, dur) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur || 2800);
}
