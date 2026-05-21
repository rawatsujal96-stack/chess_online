/* =====================================================
   chess-engine.js — Core Chess Logic
   Full move generation, validation, check/checkmate
   ===================================================== */

const PIECES = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

const PIECE_VALUES = { K:0, Q:9, R:5, B:3, N:3, P:1 };

class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this._initBoard();
    this.turn = 'w'; // 'w' or 'b'
    this.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    this.enPassantTarget = null; // [row, col] or null
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.moveHistory = [];
    this.capturedPieces = { w: [], b: [] };
    this.gameOver = false;
    this.gameResult = null; // 'w', 'b', 'draw'
    this.gameResultReason = '';
    this.promotionPending = null;
  }

  _initBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(null));
    const backRank = ['R','N','B','Q','K','B','N','R'];
    for (let c = 0; c < 8; c++) {
      b[0][c] = 'b' + backRank[c];
      b[1][c] = 'bP';
      b[6][c] = 'wP';
      b[7][c] = 'w' + backRank[c];
    }
    return b;
  }

  // Get piece color
  _color(piece) { return piece ? piece[0] : null; }
  _type(piece)  { return piece ? piece[1] : null; }

  // Copy board
  _copyBoard(board) {
    return board.map(row => [...row]);
  }

  _copyState() {
    return {
      board: this._copyBoard(this.board),
      turn: this.turn,
      castlingRights: { ...this.castlingRights },
      enPassantTarget: this.enPassantTarget ? [...this.enPassantTarget] : null
    };
  }

  // Check if position is on board
  _onBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  // Get raw moves (ignoring check) for a piece at (r,c)
  _rawMoves(board, r, c, castlingRights, enPassantTarget) {
    const piece = board[r][c];
    if (!piece) return [];
    const color = this._color(piece);
    const type  = this._type(piece);
    const moves = [];
    const opp   = color === 'w' ? 'b' : 'w';

    const addIfValid = (nr, nc) => {
      if (!this._onBoard(nr, nc)) return false;
      if (this._color(board[nr][nc]) === color) return false;
      moves.push([nr, nc]);
      return this._color(board[nr][nc]) === opp; // hit enemy = stop sliding
    };

    const slide = (drs, dcs) => {
      for (let i = 0; i < drs.length; i++) {
        let nr = r + drs[i], nc = c + dcs[i];
        while (this._onBoard(nr, nc)) {
          if (this._color(board[nr][nc]) === color) break;
          moves.push([nr, nc]);
          if (this._color(board[nr][nc]) === opp) break;
          nr += drs[i]; nc += dcs[i];
        }
      }
    };

    if (type === 'P') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      // Forward
      if (this._onBoard(r+dir, c) && !board[r+dir][c]) {
        moves.push([r+dir, c]);
        // Double push
        if (r === startRow && !board[r+2*dir][c]) moves.push([r+2*dir, c]);
      }
      // Captures
      for (const dc of [-1, 1]) {
        if (this._onBoard(r+dir, c+dc)) {
          if (this._color(board[r+dir][c+dc]) === opp) moves.push([r+dir, c+dc]);
          // En passant
          if (enPassantTarget && enPassantTarget[0] === r+dir && enPassantTarget[1] === c+dc) {
            moves.push([r+dir, c+dc]);
          }
        }
      }
    }

    else if (type === 'N') {
      const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      jumps.forEach(([dr,dc]) => addIfValid(r+dr, c+dc));
    }

    else if (type === 'B') { slide([-1,-1,-1,1,1,1], [-1,1,1,-1,-1,1]); /* fixed below */ }
    else if (type === 'R') { slide([-1,0,1,0], [0,1,0,-1]); }
    else if (type === 'Q') {
      slide([-1,-1,-1,0,0,1,1,1], [-1,0,1,-1,1,-1,0,1]);
    }
    else if (type === 'K') {
      const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      dirs.forEach(([dr,dc]) => addIfValid(r+dr, c+dc));
      // Castling
      if (color === 'w' && r === 7 && c === 4) {
        if (castlingRights.wK && !board[7][5] && !board[7][6] && board[7][7] === 'wR') moves.push([7,6]);
        if (castlingRights.wQ && !board[7][3] && !board[7][2] && !board[7][1] && board[7][0] === 'wR') moves.push([7,2]);
      }
      if (color === 'b' && r === 0 && c === 4) {
        if (castlingRights.bK && !board[0][5] && !board[0][6] && board[0][7] === 'bR') moves.push([0,6]);
        if (castlingRights.bQ && !board[0][3] && !board[0][2] && !board[0][1] && board[0][0] === 'bR') moves.push([0,2]);
      }
    }

    // Fix Bishop diagonal
    if (type === 'B') {
      // redo with correct slide
      moves.length = 0;
      for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        let nr=r+dr, nc=c+dc;
        while (this._onBoard(nr,nc)) {
          if (this._color(board[nr][nc]) === color) break;
          moves.push([nr,nc]);
          if (this._color(board[nr][nc]) === opp) break;
          nr+=dr; nc+=dc;
        }
      }
    }

    return moves;
  }

  // Is square (r,c) attacked by 'attacker' color?
  _isAttacked(board, r, c, attacker, castlingRights, enPassantTarget) {
    for (let rr = 0; rr < 8; rr++) {
      for (let cc = 0; cc < 8; cc++) {
        if (this._color(board[rr][cc]) !== attacker) continue;
        const moves = this._rawMoves(board, rr, cc, castlingRights, enPassantTarget);
        if (moves.some(([mr,mc]) => mr === r && mc === c)) return true;
      }
    }
    return false;
  }

  // Find king position
  _findKing(board, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c] === color + 'K') return [r, c];
    return null;
  }

  // Is 'color' in check?
  isInCheck(board, color, castlingRights, enPassantTarget) {
    const kPos = this._findKing(board, color);
    if (!kPos) return false;
    return this._isAttacked(board, kPos[0], kPos[1], color === 'w' ? 'b' : 'w', castlingRights, enPassantTarget);
  }

  // Apply move to board copy, return new state
  _applyMove(board, fromR, fromC, toR, toC, castlingRights, enPassantTarget, promoteTo) {
    const b = this._copyBoard(board);
    const piece = b[fromR][fromC];
    const color = this._color(piece);
    const type  = this._type(piece);
    let newCR = { ...castlingRights };
    let newEP = null;
    let captured = b[toR][toC];

    // En passant capture
    if (type === 'P' && enPassantTarget && toR === enPassantTarget[0] && toC === enPassantTarget[1]) {
      const capRow = color === 'w' ? toR + 1 : toR - 1;
      captured = b[capRow][toC];
      b[capRow][toC] = null;
    }

    // Castling move king
    if (type === 'K') {
      if (color === 'w') { newCR.wK = false; newCR.wQ = false; }
      else               { newCR.bK = false; newCR.bQ = false; }
      // Move rook
      if (fromC === 4 && toC === 6) { b[fromR][7] = null; b[fromR][5] = color + 'R'; }
      if (fromC === 4 && toC === 2) { b[fromR][0] = null; b[fromR][3] = color + 'R'; }
    }

    // Rook moves update castling
    if (type === 'R') {
      if (fromR === 7 && fromC === 0) newCR.wQ = false;
      if (fromR === 7 && fromC === 7) newCR.wK = false;
      if (fromR === 0 && fromC === 0) newCR.bQ = false;
      if (fromR === 0 && fromC === 7) newCR.bK = false;
    }

    // Capturing rook removes castling rights
    if (toR === 7 && toC === 0) newCR.wQ = false;
    if (toR === 7 && toC === 7) newCR.wK = false;
    if (toR === 0 && toC === 0) newCR.bQ = false;
    if (toR === 0 && toC === 7) newCR.bK = false;

    // Double pawn push sets en passant
    if (type === 'P' && Math.abs(toR - fromR) === 2) {
      newEP = [(fromR + toR) / 2, fromC];
    }

    // Move piece
    b[toR][toC] = piece;
    b[fromR][fromC] = null;

    // Promotion
    if (type === 'P' && (toR === 0 || toR === 7)) {
      b[toR][toC] = color + (promoteTo || 'Q');
    }

    return { board: b, castlingRights: newCR, enPassantTarget: newEP, captured };
  }

  // Get legal moves for piece at (r,c)
  getLegalMoves(r, c) {
    const piece = this.board[r][c];
    if (!piece || this._color(piece) !== this.turn) return [];
    const raw = this._rawMoves(this.board, r, c, this.castlingRights, this.enPassantTarget);
    const legal = [];

    for (const [tr, tc] of raw) {
      // Validate castling: king can't castle through check
      if (this._type(piece) === 'K' && Math.abs(tc - c) === 2) {
        const dir = tc > c ? 1 : -1;
        const opp = this.turn === 'w' ? 'b' : 'w';
        // Can't castle if in check
        if (this.isInCheck(this.board, this.turn, this.castlingRights, this.enPassantTarget)) continue;
        // Can't castle through attacked square
        const { board: tb1 } = this._applyMove(this.board, r, c, r, c+dir, this.castlingRights, this.enPassantTarget);
        if (this._isAttacked(tb1, r, c+dir, opp, this.castlingRights, this.enPassantTarget)) continue;
      }

      const { board: nb, castlingRights: ncr } = this._applyMove(
        this.board, r, c, tr, tc, this.castlingRights, this.enPassantTarget
      );
      if (!this.isInCheck(nb, this.turn, ncr, null)) {
        legal.push([tr, tc]);
      }
    }
    return legal;
  }

  // Get all legal moves for current player
  getAllLegalMoves(color) {
    const col = color || this.turn;
    const moves = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this._color(this.board[r][c]) === col) {
          const lm = this.getLegalMovesFor(r, c, col);
          lm.forEach(([tr,tc]) => moves.push([r,c,tr,tc]));
        }
    return moves;
  }

  getLegalMovesFor(r, c, color) {
    const piece = this.board[r][c];
    if (!piece || this._color(piece) !== color) return [];
    const raw = this._rawMoves(this.board, r, c, this.castlingRights, this.enPassantTarget);
    const legal = [];
    for (const [tr, tc] of raw) {
      if (this._type(piece) === 'K' && Math.abs(tc - c) === 2) {
        const dir = tc > c ? 1 : -1;
        const opp = color === 'w' ? 'b' : 'w';
        if (this.isInCheck(this.board, color, this.castlingRights, this.enPassantTarget)) continue;
        const { board: tb1 } = this._applyMove(this.board, r, c, r, c+dir, this.castlingRights, this.enPassantTarget);
        if (this._isAttacked(tb1, r, c+dir, opp, this.castlingRights, this.enPassantTarget)) continue;
      }
      const { board: nb, castlingRights: ncr } = this._applyMove(
        this.board, r, c, tr, tc, this.castlingRights, this.enPassantTarget
      );
      if (!this.isInCheck(nb, color, ncr, null)) legal.push([tr, tc]);
    }
    return legal;
  }

  // Make a move - returns { ok, promotion, captured, check, checkmate, draw }
  makeMove(fromR, fromC, toR, toC, promoteTo) {
    if (this.gameOver) return { ok: false };
    const piece = this.board[fromR][fromC];
    if (!piece || this._color(piece) !== this.turn) return { ok: false };

    const legal = this.getLegalMoves(fromR, fromC);
    if (!legal.some(([r,c]) => r === toR && c === toC)) return { ok: false };

    const type  = this._type(piece);
    const color = this._color(piece);

    // Check promotion
    if (type === 'P' && (toR === 0 || toR === 7)) {
      if (!promoteTo) {
        this.promotionPending = { fromR, fromC, toR, toC };
        return { ok: true, promotion: true };
      }
    }

    const { board: nb, castlingRights: ncr, enPassantTarget: nep, captured } =
      this._applyMove(this.board, fromR, fromC, toR, toC, this.castlingRights, this.enPassantTarget, promoteTo);

    // Record move in history
    const moveNotation = this._buildNotation(fromR, fromC, toR, toC, piece, captured, promoteTo, nb, ncr, nep);
    this.moveHistory.push({
      from: [fromR, fromC], to: [toR, toC], piece,
      captured, notation: moveNotation, promoteTo,
      prevCR: { ...this.castlingRights },
      prevEP: this.enPassantTarget
    });

    if (captured) this.capturedPieces[color].push(captured);

    this.board = nb;
    this.castlingRights = ncr;
    this.enPassantTarget = nep;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    if (this.turn === 'w') this.fullMoveNumber++;

    // Check game state
    const opp = this.turn;
    const inCheck = this.isInCheck(this.board, opp, this.castlingRights, this.enPassantTarget);
    const allMoves = this.getAllLegalMoves(opp);
    let checkmate = false, draw = false, stalemate = false;

    if (allMoves.length === 0) {
      if (inCheck) { checkmate = true; this.gameOver = true; this.gameResult = color; this.gameResultReason = 'checkmate'; }
      else         { stalemate = true; draw = true; this.gameOver = true; this.gameResult = 'draw'; this.gameResultReason = 'stalemate'; }
    }

    // Insufficient material draw
    if (!this.gameOver && this._isInsufficientMaterial()) {
      draw = true; this.gameOver = true; this.gameResult = 'draw'; this.gameResultReason = 'insufficient material';
    }

    return { ok: true, promotion: false, captured, check: inCheck, checkmate, stalemate, draw, notation: moveNotation };
  }

  completePromotion(promoteTo) {
    if (!this.promotionPending) return { ok: false };
    const { fromR, fromC, toR, toC } = this.promotionPending;
    this.promotionPending = null;
    return this.makeMove(fromR, fromC, toR, toC, promoteTo);
  }

  undoMove() {
    if (this.moveHistory.length === 0) return false;
    const last = this.moveHistory.pop();
    // Undo by rebuilding from start (simple approach)
    const savedHistory = [...this.moveHistory];
    const savedCaptures = { w: [...this.capturedPieces.w], b: [...this.capturedPieces.b] };
    this.reset();
    for (const m of savedHistory) {
      this.makeMove(m.from[0], m.from[1], m.to[0], m.to[1], m.promoteTo);
    }
    this.capturedPieces = savedCaptures;
    return true;
  }

  _buildNotation(fr, fc, tr, tc, piece, captured, promoteTo, nb, ncr, nep) {
    const files = 'abcdefgh';
    const type = this._type(piece);
    const color = this._color(piece);
    let n = '';
    if (type === 'K' && Math.abs(tc - fc) === 2) {
      n = tc > fc ? 'O-O' : 'O-O-O';
    } else {
      if (type !== 'P') n += type;
      if (captured || (type === 'P' && fc !== tc)) { if (type === 'P') n += files[fc]; n += 'x'; }
      n += files[tc] + (8 - tr);
      if (promoteTo) n += '=' + promoteTo;
    }
    const opp = color === 'w' ? 'b' : 'w';
    if (this.isInCheck(nb, opp, ncr, nep)) n += '+';
    return n;
  }

  _isInsufficientMaterial() {
    const pieces = { w: [], b: [] };
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p) pieces[this._color(p)].push(this._type(p));
      }
    const isInsuf = (ps) => {
      if (ps.length === 1) return true; // K only
      if (ps.length === 2 && (ps.includes('B') || ps.includes('N'))) return true;
      return false;
    };
    return isInsuf(pieces.w) && isInsuf(pieces.b);
  }

  // Evaluate board for AI (positive = white advantage)
  evaluate() {
    let score = 0;
    const posBonus = {
      P: [[0,0,0,0,0,0,0,0],[5,5,5,5,5,5,5,5],[1,1,2,3,3,2,1,1],[0.5,0.5,1,2.5,2.5,1,0.5,0.5],[0,0,0,2,2,0,0,0],[0.5,-0.5,-1,0,0,-1,-0.5,0.5],[0.5,1,1,-2,-2,1,1,0.5],[0,0,0,0,0,0,0,0]],
      N: [[-5,-4,-3,-3,-3,-3,-4,-5],[-4,-2,0,0,0,0,-2,-4],[-3,0,1,1.5,1.5,1,0,-3],[-3,0.5,1.5,2,2,1.5,0.5,-3],[-3,0,1.5,2,2,1.5,0,-3],[-3,0.5,1,1.5,1.5,1,0.5,-3],[-4,-2,0,0.5,0.5,0,-2,-4],[-5,-4,-3,-3,-3,-3,-4,-5]],
      B: [[-2,-1,-1,-1,-1,-1,-1,-2],[-1,0,0,0,0,0,0,-1],[-1,0,0.5,1,1,0.5,0,-1],[-1,0.5,0.5,1,1,0.5,0.5,-1],[-1,0,1,1,1,1,0,-1],[-1,1,1,1,1,1,1,-1],[-1,0.5,0,0,0,0,0.5,-1],[-2,-1,-1,-1,-1,-1,-1,-2]],
    };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) continue;
        const col = this._color(p), type = this._type(p);
        const val = PIECE_VALUES[type] || 0;
        const row = col === 'w' ? r : 7 - r;
        const bonus = posBonus[type] ? posBonus[type][row][c] * 0.1 : 0;
        score += col === 'w' ? (val + bonus) : -(val + bonus);
      }
    }
    return score;
  }
}

// Global engine instance
window.chessEngine = new ChessEngine();
