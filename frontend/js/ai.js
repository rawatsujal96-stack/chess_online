/* =====================================================
   ai.js — Chess AI (Minimax + Alpha-Beta Pruning)
   ===================================================== */

class ChessAI {
  constructor(difficulty = 2) {
    this.difficulty = difficulty; // 1=easy, 2=medium, 3=hard
    this.thinking = false;
  }

  setDifficulty(d) { this.difficulty = d; }

  // Depth based on difficulty
  _depth() {
    if (this.difficulty === 1) return 1;
    if (this.difficulty === 2) return 2;
    return 3;
  }

  // Get best move for color using minimax
  getBestMove(engine, color) {
    this.thinking = true;
    const depth = this._depth();
    const isMaximizing = color === 'w';
    let bestMove = null;
    let bestScore = isMaximizing ? -Infinity : Infinity;

    const moves = engine.getAllLegalMoves(color);
    if (moves.length === 0) { this.thinking = false; return null; }

    // Shuffle for variety at low depth
    this._shuffle(moves);

    for (const [fr, fc, tr, tc] of moves) {
      const state = engine._copyState();
      const { board: nb, castlingRights: ncr, enPassantTarget: nep } =
        engine._applyMove(engine.board, fr, fc, tr, tc, engine.castlingRights, engine.enPassantTarget, 'Q');

      // Temporarily apply
      const savedBoard = engine.board;
      const savedCR    = engine.castlingRights;
      const savedEP    = engine.enPassantTarget;
      const savedTurn  = engine.turn;
      engine.board = nb;
      engine.castlingRights = ncr;
      engine.enPassantTarget = nep;
      engine.turn = color === 'w' ? 'b' : 'w';

      const score = this._minimax(engine, depth - 1, -Infinity, Infinity, !isMaximizing);

      // Restore
      engine.board = savedBoard;
      engine.castlingRights = savedCR;
      engine.enPassantTarget = savedEP;
      engine.turn = savedTurn;

      if (isMaximizing && score > bestScore) { bestScore = score; bestMove = [fr, fc, tr, tc]; }
      if (!isMaximizing && score < bestScore) { bestScore = score; bestMove = [fr, fc, tr, tc]; }
    }

    this.thinking = false;
    return bestMove;
  }

  _minimax(engine, depth, alpha, beta, isMaximizing) {
    if (depth === 0) return engine.evaluate();

    const color = engine.turn;
    const moves = engine.getAllLegalMoves(color);

    if (moves.length === 0) {
      if (engine.isInCheck(engine.board, color, engine.castlingRights, engine.enPassantTarget)) {
        return isMaximizing ? -100 : 100; // checkmate
      }
      return 0; // stalemate
    }

    this._shuffle(moves);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const [fr, fc, tr, tc] of moves) {
        const { board: nb, castlingRights: ncr, enPassantTarget: nep } =
          engine._applyMove(engine.board, fr, fc, tr, tc, engine.castlingRights, engine.enPassantTarget, 'Q');
        const sb = engine.board, sc = engine.castlingRights, se = engine.enPassantTarget, st = engine.turn;
        engine.board = nb; engine.castlingRights = ncr; engine.enPassantTarget = nep; engine.turn = color === 'w' ? 'b' : 'w';
        const score = this._minimax(engine, depth - 1, alpha, beta, false);
        engine.board = sb; engine.castlingRights = sc; engine.enPassantTarget = se; engine.turn = st;
        if (score > maxScore) maxScore = score;
        if (score > alpha) alpha = score;
        if (beta <= alpha) break;
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const [fr, fc, tr, tc] of moves) {
        const { board: nb, castlingRights: ncr, enPassantTarget: nep } =
          engine._applyMove(engine.board, fr, fc, tr, tc, engine.castlingRights, engine.enPassantTarget, 'Q');
        const sb = engine.board, sc = engine.castlingRights, se = engine.enPassantTarget, st = engine.turn;
        engine.board = nb; engine.castlingRights = ncr; engine.enPassantTarget = nep; engine.turn = color === 'w' ? 'b' : 'w';
        const score = this._minimax(engine, depth - 1, alpha, beta, true);
        engine.board = sb; engine.castlingRights = sc; engine.enPassantTarget = se; engine.turn = st;
        if (score < minScore) minScore = score;
        if (score < beta) beta = score;
        if (beta <= alpha) break;
      }
      return minScore;
    }
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

window.chessAI = new ChessAI(2);
