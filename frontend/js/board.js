/* =====================================================
   board.js — Board Rendering & Drag/Drop/Click
   ===================================================== */

const UNICODE_PIECES = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

class BoardRenderer {
  constructor(containerId, onMove, flipped = false) {
    this.container = document.getElementById(containerId);
    this.onMove = onMove; // callback(fromR, fromC, toR, toC)
    this.flipped = flipped;       // set BEFORE _buildBoard so squares get correct coords
    this.selectedSquare = null;   // [r, c] or null
    this.validMoves = [];         // [[r,c], ...]
    this.lastMove = null;         // {from:[r,c], to:[r,c]}
    this.highlightCheck = null;   // [r, c] of king in check
    this.dragFrom = null;
    this.dragGhost = null;
    this._buildBoard();
    this._buildLabels();
  }

  _buildLabels() {
    const rankEl = document.getElementById('rankLabels');
    const fileEl = document.getElementById('fileLabels');
    if (rankEl) {
      rankEl.innerHTML = '';
      for (let r = 0; r < 8; r++) {
        const lbl = document.createElement('div');
        lbl.className = 'rank-label';
        lbl.textContent = this.flipped ? (r + 1) : (8 - r);
        rankEl.appendChild(lbl);
      }
    }
    if (fileEl) {
      fileEl.innerHTML = '';
      const files = 'abcdefgh';
      for (let c = 0; c < 8; c++) {
        const lbl = document.createElement('div');
        lbl.className = 'file-label';
        lbl.textContent = files[this.flipped ? 7 - c : c];
        fileEl.appendChild(lbl);
      }
    }
  }

  _buildBoard() {
    this.container.innerHTML = '';
    this.squares = [];
    for (let r = 0; r < 8; r++) {
      this.squares[r] = [];
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        const displayR = this.flipped ? 7 - r : r;
        const displayC = this.flipped ? 7 - c : c;
        sq.className = 'square ' + ((displayR + displayC) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.row = displayR;
        sq.dataset.col = displayC;

        // Click
        sq.addEventListener('click', (e) => {
          e.stopPropagation();
          this._handleClick(displayR, displayC);
        });

        // Drag target
        sq.addEventListener('dragover', (e) => {
          e.preventDefault();
          this._clearDragOver();
          sq.classList.add('drag-over');
        });
        sq.addEventListener('dragleave', () => sq.classList.remove('drag-over'));
        sq.addEventListener('drop', (e) => {
          e.preventDefault();
          sq.classList.remove('drag-over');
          if (this.dragFrom) {
            this.onMove(this.dragFrom[0], this.dragFrom[1], displayR, displayC);
            this.dragFrom = null;
          }
        });

        this.container.appendChild(sq);
        this.squares[r][c] = sq; // squares[screenRow][screenCol]
      }
    }
  }

  _squareAt(r, c) {
    // r, c are board coordinates; find screen position
    const sr = this.flipped ? 7 - r : r;
    const sc = this.flipped ? 7 - c : c;
    return this.squares[sr][sc];
  }

  _handleClick(r, c) {
    if (this.selectedSquare) {
      const [sr, sc] = this.selectedSquare;
      if (sr === r && sc === c) {
        // Deselect same square
        this.selectedSquare = null;
        this.validMoves = [];
        this._updateHighlights();
        return;
      }
      // Try move to target square
      if (this.validMoves.some(([mr, mc]) => mr === r && mc === c)) {
        const from = this.selectedSquare;
        this.selectedSquare = null;
        this.validMoves = [];
        this._updateHighlights();
        this.onMove(from[0], from[1], r, c);
        return;
      }
      // Clicked another own piece — reselect it
      const piece = window.chessEngine.board[r][c];
      const currentTurn = window.chessEngine.turn;
      if (piece && window.chessEngine._color(piece) === currentTurn) {
        this.selectedSquare = [r, c];
        this.validMoves = window.chessEngine.getLegalMoves(r, c);
        this._updateHighlights();
        return;
      }
      // Clicked empty square with no valid move — deselect
      this.selectedSquare = null;
      this.validMoves = [];
      this._updateHighlights();
      return;
    }
    // Nothing selected yet — select piece if it belongs to current turn
    const piece = window.chessEngine.board[r][c];
    const currentTurn = window.chessEngine.turn;
    if (piece && window.chessEngine._color(piece) === currentTurn) {
      this.selectedSquare = [r, c];
      this.validMoves = window.chessEngine.getLegalMoves(r, c);
    } else {
      this.selectedSquare = null;
      this.validMoves = [];
    }
    this._updateHighlights();
  }

  _clearDragOver() {
    this.container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  render(board, lastMove, checkSquare) {
    this.lastMove = lastMove || null;
    this.highlightCheck = checkSquare || null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = this._squareAt(r, c);
        sq.innerHTML = '';
        const piece = board[r][c];
        if (piece) {
          const el = document.createElement('div');
          el.className = 'piece';
          el.textContent = UNICODE_PIECES[piece] || piece;
          el.draggable = true;
          el.addEventListener('dragstart', (e) => {
            this.dragFrom = [r, c];
            this.selectedSquare = [r, c];
            this.validMoves = window.chessEngine.getLegalMoves(r, c);
            this._updateHighlights();
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Create ghost
            const ghost = el.cloneNode(true);
            ghost.style.cssText = 'position:fixed;top:-200px;opacity:0.85;font-size:3rem;pointer-events:none;';
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 30, 30);
            this.dragGhost = ghost;
          });
          el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            if (this.dragGhost) { this.dragGhost.remove(); this.dragGhost = null; }
            this._clearDragOver();
          });
          sq.appendChild(el);
        }
      }
    }
    this._updateHighlights();
  }

  _updateHighlights() {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = this._squareAt(r, c);
        sq.classList.remove('selected', 'valid-move', 'valid-capture', 'last-move-from', 'last-move-to', 'in-check');

        // Last move
        if (this.lastMove) {
          if (this.lastMove.from[0] === r && this.lastMove.from[1] === c) sq.classList.add('last-move-from');
          if (this.lastMove.to[0] === r && this.lastMove.to[1] === c) sq.classList.add('last-move-to');
        }

        // Check
        if (this.highlightCheck && this.highlightCheck[0] === r && this.highlightCheck[1] === c) {
          sq.classList.add('in-check');
        }

        // Selected
        if (this.selectedSquare && this.selectedSquare[0] === r && this.selectedSquare[1] === c) {
          sq.classList.add('selected');
        }

        // Valid moves
        if (this.validMoves.some(([mr, mc]) => mr === r && mc === c)) {
          const piece = window.chessEngine.board[r][c];
          if (piece && window.chessEngine._color(piece) !== window.chessEngine.turn) {
            sq.classList.add('valid-capture');
          } else {
            sq.classList.add('valid-move');
          }
        }
      }
    }
  }

  flip() {
    this.flipped = !this.flipped;
    this._buildBoard();
    this._buildLabels();
    if (window.gameController) window.gameController.refreshBoard();
  }

  clearSelection() {
    this.selectedSquare = null;
    this.validMoves = [];
    this._updateHighlights();
  }
}

window.BoardRenderer = BoardRenderer;
