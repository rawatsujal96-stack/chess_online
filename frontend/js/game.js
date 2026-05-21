/* =====================================================
   game.js — Game Controller (Timer, Turns, UI)
   ===================================================== */

class GameController {
  constructor() {
    this.params = this._parseParams();
    this.engine = window.chessEngine;
    this.ai = window.chessAI;
    this.sounds = window.chessSounds;
    this.board = null;
    this.playerColor = this.params.color || 'white'; // 'white' or 'black'
    this.playerSide  = this.playerColor === 'white' ? 'w' : 'b';
    this.mode = this.params.mode || 'computer'; // 'computer' or 'online'
    this.timeLimit = parseInt(this.params.time) || 0;
    this.timers = { w: this.timeLimit, b: this.timeLimit };
    this.timerInterval = null;
    this.gameActive = false;
    this.aiColor = this.playerSide === 'w' ? 'b' : 'w';
    this.moveCount = { w: 0, b: 0 };
    this.soundEnabled = this.params.sound !== '0';
    this.socket = null;
    this.socket = null;
this.roomId = this.params.room || null;

    this.sounds.setEnabled(this.soundEnabled);
    if (this.params.diff) this.ai.setDifficulty(parseInt(this.params.diff));

    this._init();
    if (this.mode === 'online') {
  this.connectOnlineGame();
}
  }

  _parseParams() {
    const p = {};
    new URLSearchParams(window.location.search).forEach((v, k) => p[k] = v);
    return p;
  }

  _init() {
    this.engine.reset();
    // Pass flipped=true directly so board is built with correct coordinates from the start
    const flipped = this.playerSide === 'b';
    this.board = new BoardRenderer('chessboard', (fr, fc, tr, tc) => this._handleMove(fr, fc, tr, tc), flipped);

    this._setupPlayerInfo();
    this._setupTimers();
    this.gameActive = true;
    this.refreshBoard();
    if (this.mode === 'online' && this.socket) {

  const move =
    this.engine.moveHistory[
      this.engine.moveHistory.length - 1
    ];

  this.socket.send(JSON.stringify({
    type: 'move',
    move: {
      from: move.fromNotation,
      to: move.toNotation,
      promotion: 'q'
    }
  }));

}
    this._updateStatus();
if (this.mode === 'online') {
  this._connectWebSocket();
}
    // If player is black, AI moves first
    if (this.mode === 'computer' && this.playerSide === 'b') {
      setTimeout(() => this._doAiMove(), 600);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'z') undoMove();
    });
  }

  _setupPlayerInfo() {
    const isWhiteBottom = this.playerSide === 'w';

    // Bottom = player, Top = opponent/AI
    document.getElementById('bottomName').textContent = getUsername() || 'You';
    document.getElementById('topName').textContent = this.mode === 'computer' ? `Computer (${this._diffName()})` : 'Opponent';

    document.getElementById('bottomAvatar').textContent = isWhiteBottom ? '♔' : '♚';
    document.getElementById('topAvatar').textContent = isWhiteBottom ? '♚' : '♔';
  }

  _diffName() {
    const d = parseInt(this.params.diff) || 2;
    return ['','Easy','Medium','Hard'][d] || 'Medium';
  }

  _setupTimers() {
    if (this.timeLimit === 0) {
      document.getElementById('topTimer').textContent = '∞';
      document.getElementById('bottomTimer').textContent = '∞';
      return;
    }
    this._updateTimerDisplay();
    this._startTimerTick();
  }

  _startTimerTick() {
    if (this.timeLimit === 0) return;
    this.timerInterval = setInterval(() => {
      if (!this.gameActive) { clearInterval(this.timerInterval); return; }
      const cur = this.engine.turn;
      this.timers[cur]--;
      this._updateTimerDisplay();

      if (this.timers[cur] <= 10) this.sounds.tick();

      if (this.timers[cur] <= 0) {
        this.timers[cur] = 0;
        clearInterval(this.timerInterval);
        this._onTimeout(cur);
      }
    }, 1000);
  }

  _updateTimerDisplay() {
    const fmt = (s) => {
      if (s <= 0) return '0:00';
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const isWhiteBottom = this.playerSide === 'w';
    const bottomColor   = isWhiteBottom ? 'w' : 'b';
    const topColor      = isWhiteBottom ? 'b' : 'w';

    const bottomTimer = document.getElementById('bottomTimer');
    const topTimer    = document.getElementById('topTimer');

    if (this.timeLimit === 0) { bottomTimer.textContent = '∞'; topTimer.textContent = '∞'; return; }

    bottomTimer.textContent = fmt(this.timers[bottomColor]);
    topTimer.textContent    = fmt(this.timers[topColor]);

    // Low time warning
    bottomTimer.classList.toggle('low-time', this.timers[bottomColor] <= 30 && this.timers[bottomColor] > 0);
    topTimer.classList.toggle('low-time', this.timers[topColor] <= 30 && this.timers[topColor] > 0);
  }

  _updateActivePlayer() {
    const isWhiteBottom = this.playerSide === 'w';
    const bottomActive = (this.engine.turn === 'w') === isWhiteBottom;
    document.getElementById('bottomPlayer').classList.toggle('active-player', bottomActive);
    document.getElementById('topPlayer').classList.toggle('active-player', !bottomActive);
  }

  _onTimeout(color) {
    this.gameActive = false;
    const winner = color === 'w' ? 'b' : 'w';
    const winName = winner === this.playerSide ? 'You win' : (this.mode === 'computer' ? 'Computer wins' : 'Opponent wins');
    this._showGameOver(`${winName} on time!`, winner === this.playerSide ? '⏰ Time Expired — You Win!' : '⏰ Time Expired — You Lose!');
    this.sounds.gameOver();
  }

  _handleMove(fr, fc, tr, tc) {
    if (!this.gameActive) return;
    // Only allow player's turn in computer mode
    if (this.mode === 'computer' && this.engine.turn !== this.playerSide) return;

    const result = this.engine.makeMove(fr, fc, tr, tc);
    if (!result.ok) return;

    if (result.promotion) {
      // The turn hasn't changed yet for promotion — use the current mover's color
      this._showPromotionModal(fr, fc, tr, tc, this.engine.turn);
      return;
    }

    this._afterMove(result, fr, fc, tr, tc);
  }

  _afterMove(result, fr, fc, tr, tc) {
    // Detect castling (king moved 2 squares)
    const piece = this.engine.moveHistory[this.engine.moveHistory.length - 1]?.piece;
    const isCastle = piece && piece[1] === 'K' && Math.abs(tc - fc) === 2;

    // Sound
    if (isCastle)         this.sounds.castle();
    else if (result.captured) this.sounds.capture();
    else                   this.sounds.move();

    if (result.check || result.checkmate) this.sounds.check();

    this.board.clearSelection();
    this.refreshBoard(fr, fc, tr, tc, result);
    this._updateStatus(result);
    this._updateMoveHistory();
    this._updateCaptured();
    this._updateActivePlayer();
    if (this.mode === 'online' && this.socket) {

  const lastMove =
    this.engine.moveHistory[
      this.engine.moveHistory.length - 1
    ];

  this.socket.send(JSON.stringify({

    type: 'move',

    move: {

      from: lastMove.fromNotation,

      to: lastMove.toNotation

    }

  }));

}

    if (this.gameActive && result.gameOver || result.checkmate || result.draw) {
      this.gameActive = false;
      clearInterval(this.timerInterval);
      setTimeout(() => {
        if (result.checkmate) {
          const winner = this.engine.moveHistory[this.engine.moveHistory.length - 1]?.piece[0];
          const winName = winner === this.playerSide ? 'You win' : (this.mode === 'computer' ? 'Computer wins' : 'Opponent wins');
          this._showGameOver(winName + ' by checkmate!', winner === this.playerSide ? '♔ You Win!' : '♚ You Lose!');
          winner === this.playerSide ? this.sounds.win() : this.sounds.gameOver();
        } else if (result.draw || result.stalemate) {
          this._showGameOver(this.engine.gameResultReason || 'Draw', '½ — Draw!');
          this.sounds.gameOver();
        }
      }, 300);
      return;
    }

    // AI move
    if (this.mode === 'computer' && this.gameActive && this.engine.turn === this.aiColor) {
      setTimeout(() => this._doAiMove(), this.ai.difficulty === 3 ? 600 : 400);
    }
  }

  _doAiMove() {
    if (!this.gameActive) return;
    const move = this.ai.getBestMove(this.engine, this.aiColor);
    if (!move) return;
    const [fr, fc, tr, tc] = move;
    const piece = this.engine.board[fr][fc];

    // AI promotion always picks queen
    const type = piece ? piece[1] : null;
    const isPromo = type === 'P' && (tr === 0 || tr === 7);
    const result = this.engine.makeMove(fr, fc, tr, tc, isPromo ? 'Q' : undefined);
    if (!result.ok) return;
    this._afterMove(result, fr, fc, tr, tc);
  }

  _showPromotionModal(fr, fc, tr, tc, color) {
    const modal = document.getElementById('promotionModal');
    const grid  = document.getElementById('promotionGrid');
    const pieces = color === 'w'
      ? [['Q','♕'],['R','♖'],['B','♗'],['N','♘']]
      : [['Q','♛'],['R','♜'],['B','♝'],['N','♞']];

    grid.innerHTML = '';
    pieces.forEach(([type, sym]) => {
      const btn = document.createElement('div');
      btn.className = 'promo-piece';
      btn.textContent = sym;
      btn.onclick = () => {
        modal.classList.remove('open');
        const result = this.engine.completePromotion(type);
        if (result.ok) {
          this.sounds.promote();
          this._afterMove(result, fr, fc, tr, tc);
        }
      };
      grid.appendChild(btn);
    });

    modal.classList.add('open');
  }

  refreshBoard(fr, fc, tr, tc, result) {
    const lastMove = (fr !== undefined) ? { from: [fr, fc], to: [tr, tc] } : this.engine.moveHistory.length > 0
      ? (() => { const m = this.engine.moveHistory[this.engine.moveHistory.length - 1]; return { from: m.from, to: m.to }; })()
      : null;

    let checkSquare = null;
    if (this.engine.isInCheck(this.engine.board, this.engine.turn, this.engine.castlingRights, this.engine.enPassantTarget)) {
      checkSquare = this.engine._findKing(this.engine.board, this.engine.turn);
    }

    this.board.render(this.engine.board, lastMove, checkSquare);
    this._updateTimerDisplay();
  }

  _updateStatus(result) {
    const el = document.getElementById('gameStatus');
    if (!el) return;
    if (!this.gameActive) return;

    const turnName = this.engine.turn === 'w' ? 'White' : 'Black';
    const isYourTurn = this.engine.turn === this.playerSide;

    if (result && result.check) {
      el.textContent = `${turnName} is in CHECK!`;
    } else {
      el.textContent = this.mode === 'computer'
        ? (isYourTurn ? `Your turn — ${turnName}` : `Computer thinking...`)
        : `${turnName}'s turn`;
    }
  }

  _updateMoveHistory() {
    const list = document.getElementById('moveList');
    if (!list) return;
    list.innerHTML = '';
    const history = this.engine.moveHistory;

    for (let i = 0; i < history.length; i += 2) {
      const li = document.createElement('li');
      const wMove = history[i];
      const bMove = history[i + 1];
      li.innerHTML = `<span class="move-num">${Math.floor(i/2)+1}.</span>
        <span class="move-white">${wMove ? wMove.notation : ''}</span>
        <span class="move-black">${bMove ? bMove.notation : ''}</span>`;
      list.appendChild(li);
    }

    // Scroll to bottom
    const mh = document.getElementById('moveHistory');
    if (mh) mh.scrollTop = mh.scrollHeight;
  }

  _updateCaptured() {
    const wEl = document.getElementById('capturedWhite');
    const bEl = document.getElementById('capturedBlack');
    const PIECES_UNI = {
      wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
      bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
    };
    if (wEl) wEl.textContent = this.engine.capturedPieces.b.map(p => PIECES_UNI[p] || p).join(' ');
    if (bEl) bEl.textContent = this.engine.capturedPieces.w.map(p => PIECES_UNI[p] || p).join(' ');
  }

  _showGameOver(msg, title) {
    document.getElementById('gameOverTitle').textContent = title;
    document.getElementById('gameOverMsg').textContent = msg;
    document.getElementById('gameOverModal').classList.add('open');
    document.getElementById('newGameBtn').style.display = 'block';
    document.getElementById('gameStatus').textContent = title;
  }

  undo() {
    if (!this.gameActive) return;
    if (this.mode === 'computer') {
      // Undo both player and AI moves
      this.engine.undoMove();
      if (this.engine.turn === this.aiColor) this.engine.undoMove();
    } else {
      this.engine.undoMove();
    }
    this.board.clearSelection();
    this.refreshBoard();
    this._updateStatus();
    this._updateMoveHistory();
    this._updateCaptured();
    this._updateActivePlayer();
    showToast('Move undone');
  }

  resign() {
    document.getElementById('resignModal').classList.add('open');
  }

  confirmResign() {
    document.getElementById('resignModal').classList.remove('open');
    this.gameActive = false;
    clearInterval(this.timerInterval);
    const oppName = this.mode === 'computer' ? 'Computer' : 'Opponent';
    this._showGameOver(`You resigned. ${oppName} wins.`, '⚑ Resigned');
    this.sounds.gameOver();
  }
  _connectWebSocket() {

  const session =
    JSON.parse(localStorage.getItem('chess_session'));

  this.socket =
    new WebSocket('wss://chess-online-1-n2xg.onrender.com');

  this.socket.onopen = () => {

    console.log('Connected To Server');

    this.socket.send(JSON.stringify({

      type: 'joinRoom',

      roomId: this.roomId,

      token: session.token

    }));

  };

  this.socket.onmessage = (event) => {

    const data = JSON.parse(event.data);

    console.log(data);

    switch (data.type) {

      case 'gameStart':

        showToast('Opponent Connected!');
        break;

      case 'opponentMove':

        this.engine.loadFEN(data.fen);

        this.refreshBoard();

        this._updateMoveHistory();

        this._updateCaptured();

        this._updateStatus();

        break;

      case 'opponentDisconnected':

        this.gameActive = false;

        this._showGameOver(
          'Opponent disconnected',
          'Disconnected'
        );

        break;

      case 'gameOver':

        this.gameActive = false;

        this._showGameOver(
          data.reason,
          'Game Over'
        );

        break;
    }
  };

  this.socket.onerror = () => {

    console.log('WebSocket Error');

  };

}

  newGame() {
    connectOnlineGame() {

  const roomId = this.params.room;

  const session =
    JSON.parse(localStorage.getItem('chess_session'));

  this.socket = new WebSocket(
    location.origin.replace(/^http/, 'ws')
  );

  this.socket.onopen = () => {

    console.log('Connected');

    this.socket.send(JSON.stringify({
      type: 'joinRoom',
      roomId,
      token: session.token
    }));

  };

  this.socket.onmessage = (event) => {

    const data = JSON.parse(event.data);

    console.log(data);

    // Opponent move received
    if (data.type === 'opponentMove') {

      this.engine.game.move(data.move);

      this.refreshBoard();

    }

    // Game started
    if (data.type === 'gameStart') {

      showToast('Opponent Connected');

    }

  };

  this.socket.onerror = () => {

    showToast('WebSocket Error');

  };

}
    closeModal('gameOverModal');
    const params = new URLSearchParams(window.location.search);
    window.location.href = window.location.pathname + '?' + params.toString();
  }
}

/* ── Global helpers called from HTML ── */
function undoMove()     { if (window.gameController) window.gameController.undo(); }
function flipBoard()    { if (window.gameController) window.gameController.board.flip(); }
function resignGame()   { if (window.gameController) window.gameController.resign(); }
function confirmResign(){ if (window.gameController) window.gameController.confirmResign(); }
function newGame()      { if (window.gameController) window.gameController.newGame(); }

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function showToast(msg, dur) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur || 2500);
}

function getUsername() {
  try {
    const s = JSON.parse(localStorage.getItem('chess_session'));
    return s ? s.username : null;
  } catch { return null; }
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'computer';

  // Redirect to setup if no params set (direct URL to game.html)
  if (mode === 'computer' && !params.get('diff')) {
    window.location.href = 'setup.html';
    return;
  }

  window.gameController = new GameController();

  // Update nav
  const nav = document.getElementById('navLinks');
  if (nav) {
    try {
      const s = JSON.parse(localStorage.getItem('chess_session'));
      if (s && s.username) {
        nav.innerHTML = `<a href="../index.html">Home</a><span style="opacity:.6;font-size:.82rem;text-transform:uppercase;">${s.username}</span>`;
      } else {
        nav.innerHTML = `<a href="../index.html">Home</a><a href="login.html">Login</a>`;
      }
    } catch {}
  }
});
