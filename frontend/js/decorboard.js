/* =====================================================
   decorboard.js — Decorative Board for Homepage
   ===================================================== */

const UNICODE = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
};

const INIT_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR'],
];

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('decorBoard');
  if (!container) return;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq';
      const isLight = (r + c) % 2 === 0;
      sq.style.background = isLight ? '#f0d9b5' : '#b58863';
      const piece = INIT_BOARD[r][c];
      if (piece) {
        sq.textContent = UNICODE[piece];
        sq.style.fontSize = '1.8rem';
        sq.style.filter = 'drop-shadow(1px 2px 1px rgba(0,0,0,0.3))';
        sq.style.lineHeight = '1';
        sq.style.display = 'flex';
        sq.style.alignItems = 'center';
        sq.style.justifyContent = 'center';
      }
      container.appendChild(sq);
    }
  }
});
