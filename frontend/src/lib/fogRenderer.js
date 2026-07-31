// frontend/src/lib/fogRenderer.js

export class FogRenderer {
  constructor(maskCanvas) {
    this.maskCanvas = maskCanvas;
    this.maskCtx = maskCanvas.getContext('2d');
    this.smoothX = null;
    this.smoothY = null;
    this.SMOOTH = 0.4;
    this.trail = [];
    this.undoStack = [];
    this.fogReady = false;
  }

  addFog(volume, W, H) {
    this.fogReady = true;
    const ctx = this.maskCtx;
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      const cx = W * 0.5 + (Math.random() - 0.5) * W * 0.6;
      const cy = H * 0.5 + (Math.random() - 0.5) * H * 0.3;
      const r = 100 + Math.random() * 200 + volume * 600;
      const a = Math.min(1, 0.4 + volume * 4);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a * 0.65})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  eraseAt(rawX, rawY) {
    if (this.smoothX === null) { this.smoothX = rawX; this.smoothY = rawY; }
    this.smoothX += this.SMOOTH * (rawX - this.smoothX);
    this.smoothY += this.SMOOTH * (rawY - this.smoothY);
    const x = this.smoothX, y = this.smoothY;
    this.trail.push({ x, y });
    if (this.trail.length > 6) this.trail.shift();
    if (this.trail.length < 2) return;

    const ctx = this.maskCtx;
    const t = this.trail;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = 40; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (t.length === 2) {
      ctx.moveTo(t[0].x, t[0].y);
      ctx.lineTo(t[1].x, t[1].y);
    } else {
      ctx.moveTo((t[0].x + t[1].x) / 2, (t[0].y + t[1].y) / 2);
      for (let i = 1; i < t.length - 1; i++) {
        ctx.quadraticCurveTo(t[i].x, t[i].y, (t[i].x + t[i + 1].x) / 2, (t[i].y + t[i + 1].y) / 2);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  resetDraw() { this.smoothX = null; this.smoothY = null; this.trail = []; }

  saveSnapshot(W, H) {
    this.undoStack.push(this.maskCtx.getImageData(0, 0, W, H));
    if (this.undoStack.length > 20) this.undoStack.shift();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.maskCtx.putImageData(this.undoStack.pop(), 0, 0);
  }

  clear(W, H) {
    this.maskCtx.clearRect(0, 0, W, H);
    this.undoStack = [];
    this.fogReady = false;
    this.resetDraw();
  }
}