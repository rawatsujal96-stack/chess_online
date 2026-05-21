/* =====================================================
   sounds.js — Chess Sound Effects (Web Audio API)
   ===================================================== */

class ChessSounds {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
      console.warn('Web Audio not supported');
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(val) { this.enabled = val; }

  _play(type) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (type) {
      case 'move':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.08);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;

      case 'capture':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
        // Second click
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(200, now + 0.05);
        g2.gain.setValueAtTime(0.1, now + 0.05);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc2.start(now + 0.05); osc2.stop(now + 0.18);
        break;

      case 'check':
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
        break;

      case 'castle':
        // Two-tone click
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(620, now + 0.07);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now); osc.stop(now + 0.18);
        break;

      case 'promote':
        // Ascending arpeggio
        [440,554,659,880].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + i * 0.07);
          g.gain.setValueAtTime(0.18, now + i * 0.07);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.15);
          o.start(now + i * 0.07);
          o.stop(now + i * 0.07 + 0.15);
        });
        break;

      case 'gameOver':
        // Descending sequence
        [523, 392, 330, 262].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + i * 0.18);
          g.gain.setValueAtTime(0.22, now + i * 0.18);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.3);
          o.start(now + i * 0.18);
          o.stop(now + i * 0.18 + 0.3);
        });
        break;

      case 'win':
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + i * 0.15);
          g.gain.setValueAtTime(0.2, now + i * 0.15);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
          o.start(now + i * 0.15);
          o.stop(now + i * 0.15 + 0.25);
        });
        break;

      case 'tick':
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now); osc.stop(now + 0.04);
        break;
    }
  }

  move()     { this._play('move'); }
  capture()  { this._play('capture'); }
  check()    { this._play('check'); }
  castle()   { this._play('castle'); }
  promote()  { this._play('promote'); }
  gameOver() { this._play('gameOver'); }
  win()      { this._play('win'); }
  tick()     { this._play('tick'); }
}

window.chessSounds = new ChessSounds();
