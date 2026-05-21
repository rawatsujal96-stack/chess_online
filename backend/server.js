/* =====================================================
   server.js — Chess Online Backend
   Express REST API + WebSocket for multiplayer
   ===================================================== */
  const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Chess } = require('chess.js');
const path = require("path");

  require('dotenv').config()
console.log("ENV CHECK:", process.env.MONGO_URI);

const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require("mongoose");
const app = express(); 
const server = http.createServer(app); 

const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

// ONLY ONE CONNECT
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});


const JWT_SECRET = process.env.JWT_SECRET || "chess_secret";

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("DB Error:", err));

const users = new Map();   // username -> { username, email, passwordHash, createdAt, wins, losses, draws }
const rooms = new Map();   // roomId   -> Room
const wsClients = new Map(); // ws -> { userId, roomId }

/* ─── Auth Helpers ─── */
function generateToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token provided' });

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ message: 'Invalid or expired token' });

  req.username = decoded.username;
  // Guest tokens bypass user lookup
  if (token.startsWith('guest_') || token.startsWith('offline_')) {
    req.username = decoded.username || 'Guest';
    return next();
  }
  next();
}

/* ─── Auth Routes ─── */

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    const emailRegex =
/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(email)) {

  return res.status(400).json({
    message: 'Invalid email address'
  });

}
    return res.status(400).json({ message: 'All fields required' });
  if (username.length < 3)
    return res.status(400).json({ message: 'Username must be at least 3 characters' });
 const strongPassword =
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

if (!strongPassword.test(password)) {

  return res.status(400).json({
    message:
      'Password must contain uppercase, lowercase, number and minimum 8 characters'
  });

}
  if (users.has(username.toLowerCase()))
    return res.status(409).json({ message: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  users.set(username.toLowerCase(), { username, email, passwordHash, createdAt: Date.now(), wins: 0, losses: 0, draws: 0 });
  const token = generateToken(username);
  res.json({ token, username, message: 'Account created' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email , password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: 'Username and password required' });

  const user = [...users.values()].find(
  u => u.email === email
);
  if (!user) return res.status(401).json({ message: 'Invalid username or password' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ message: 'Invalid username or password' });

  const token = generateToken(user.username);
  res.json({ token, username: user.username, message: 'Logged in' });
});

// Guest login
app.post('/api/guest', (req, res) => {
  const guestName = 'Guest_' + Math.floor(Math.random() * 9000 + 1000);
  const token = generateToken(guestName);
  res.json({ token, username: guestName, isGuest: true });
});

// Profile
app.get('/api/profile', authMiddleware, (req, res) => {
  const user = users.get(req.username.toLowerCase());
  if (!user) return res.json({ username: req.username, wins: 0, losses: 0, draws: 0 });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

/* ─── Room Routes ─── */

// List open rooms
app.get('/api/rooms', authMiddleware, (req, res) => {
  const open = [];
  rooms.forEach((room, id) => {
    if (room.status === 'waiting') {
      open.push({
        id,
        name: room.name,
        host: room.hostUsername,
        timeLimit: room.timeLimit,
        createdAt: room.createdAt
      });
    }
  });
  res.json({ rooms: open });
});

// Create room
app.post('/api/rooms', authMiddleware, (req, res) => {
  const { name, timeLimit, hostColor } = req.body;
  const roomId = uuidv4().slice(0, 8);
  const room = {
    id: roomId,
    name: name || `${req.username}'s game`,
    hostUsername: req.username,
    guestUsername: null,
    timeLimit: parseInt(timeLimit) || 300,
    hostColor: hostColor || 'white',
    guestColor: hostColor === 'white' ? 'black' : 'white',
    status: 'waiting', // waiting | active | finished
    createdAt: Date.now(),
    moves: [],
game: new Chess(),
hostWs: null,
guestWs: null
  };
  rooms.set(roomId, room);
  res.json({ roomId, name: room.name, message: 'Room created' });
});

// Join room
app.post('/api/rooms/:roomId/join', authMiddleware, (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).json({ message: 'Room not found' });
  if (room.status !== 'waiting') return res.status(409).json({ message: 'Room is not available' });
  if (room.hostUsername === req.username) return res.status(400).json({ message: 'Cannot join your own room' });

  room.guestUsername = req.username;
  room.status = 'active';
  res.json({ roomId: room.id, color: room.guestColor, message: 'Joined room' });
});

/* ─── WebSocket Handling ─── */
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handleWsMessage(ws, msg);
  });

  ws.on('close', () => {
    const client = wsClients.get(ws);
    if (client && client.roomId) {
      const room = rooms.get(client.roomId);
      if (room) {
        broadcastToRoom(room, { type: 'opponentDisconnected' }, ws);
        room.status = 'finished';
      }
    }
    wsClients.delete(ws);
  });

  ws.on('error', () => wsClients.delete(ws));
});

function handleWsMessage(ws, msg) {
  switch (msg.type) {
    case 'joinRoom': {
      const { roomId, token } = msg;
      const decoded = verifyToken(token);
      if (!decoded) { ws.send(JSON.stringify({ type: 'error', message: 'Auth failed' })); return; }
      const username = decoded.username;
      const room = rooms.get(roomId);
      if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); return; }

      // Register connection
      wsClients.set(ws, { username, roomId });
      if (room.hostUsername === username)  room.hostWs  = ws;
      if (room.guestUsername === username) room.guestWs = ws;

      ws.send(JSON.stringify({
        type: 'roomJoined',
        roomId,
        color: room.hostUsername === username ? room.hostColor : room.guestColor,
        opponent: room.hostUsername === username ? room.guestUsername : room.hostUsername,
        timeLimit: room.timeLimit
      }));

      // If both players connected, start game
      if (room.hostWs && room.guestWs) {
        broadcastToRoom(room, { type: 'gameStart', timeLimit: room.timeLimit });
      }
      break;
    }

  case 'move': {

  const client = wsClients.get(ws);

  if (!client) return;

  const room = rooms.get(client.roomId);

  if (!room || room.status !== 'active') return;

  try {

    // Validate move using chess.js
    const result = room.game.move(msg.move);

    // Invalid move
    if (!result) {

      ws.send(JSON.stringify({
        type: 'invalidMove'
      }));

      return;
    }

    // Store move
    room.moves.push(msg.move);

    // Send move to opponent
    broadcastToRoom(room, {
      type: 'opponentMove',
      move: msg.move,
      fen: room.game.fen()
    }, ws);

    // Checkmate
    if (room.game.isCheckmate()) {

      room.status = 'finished';

      broadcastToRoom(room, {
        type: 'gameOver',
        reason: 'checkmate',
        winner: client.username
      });

    }

    // Draw
    else if (
      room.game.isDraw() ||
      room.game.isStalemate() ||
      room.game.isThreefoldRepetition()
    ) {

      room.status = 'finished';

      broadcastToRoom(room, {
        type: 'gameOver',
        reason: 'draw'
      });

    }

  } catch (err) {

    ws.send(JSON.stringify({
      type: 'invalidMove'
    }));

  }

  break;
}

    case 'resign': {
      const client = wsClients.get(ws);
      if (!client) return;
      const room = rooms.get(client.roomId);
      if (!room) return;
      room.status = 'finished';
      broadcastToRoom(room, { type: 'opponentResigned', username: client.username }, ws);
      break;
    }

    case 'offerDraw': {
      const client = wsClients.get(ws);
      if (!client) return;
      const room = rooms.get(client.roomId);
      if (!room) return;
      broadcastToRoom(room, { type: 'drawOffer' }, ws);
      break;
    }

    case 'acceptDraw': {
      const client = wsClients.get(ws);
      if (!client) return;
      const room = rooms.get(client.roomId);
      if (!room) return;
      room.status = 'finished';
      broadcastToRoom(room, { type: 'drawAccepted' });
      break;
    }

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

function broadcastToRoom(room, msg, exclude) {
  const str = JSON.stringify(msg);
  [room.hostWs, room.guestWs].forEach(ws => {
    if (ws && ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(str);
    }
  });
}

// Heartbeat
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Cleanup old rooms every hour
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  rooms.forEach((room, id) => {
    if (room.createdAt < cutoff && room.status !== 'active') rooms.delete(id);
  });
}, 3600000);

/* ─── Start ─── */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n♟  Chess Online Server running on http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Frontend:  http://localhost:${PORT}/index.html\n`);
});
