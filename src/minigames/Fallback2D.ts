import type { MiniGame, MiniGameContext, MiniGameManifest } from '../types';

const manifest: MiniGameManifest = {
  id: 'fallback-2d',
  name: 'Eagle Reflex',
  tagline: 'Tap the eagles before they fly away',
  emoji: '🦅',
  color: '#2A7F8F',
  minYear: 1,
  maxYear: 9,
  controls: 'Tap or click the circles',
  thumbnail: 'linear-gradient(145deg,#14565f,#4FA3B2)',
};

/**
 * WebGL-less fallback: a 2D canvas reaction game. Same MiniGame contract,
 * so the arcade break never blocks a learner on an old Chromebook.
 */
export class Fallback2D implements MiniGame {
  id = manifest.id;
  name = manifest.name;
  tagline = manifest.tagline;
  emoji = manifest.emoji;
  color = manifest.color;
  minYear = manifest.minYear;
  maxYear = manifest.maxYear;
  controls = manifest.controls;
  thumbnail = manifest.thumbnail;

  private canvas?: HTMLCanvasElement;
  private ctx2d?: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private paused = false;
  private targets: Array<{ x: number; y: number; r: number; born: number; life: number; hit: boolean }> = [];
  private score = 0;
  private coins = 0;
  private gameCtx!: MiniGameContext;
  private lastSpawn = 0;
  private startedAt = 0;
  private misses = 0;
  private boundHandlers: Array<() => void> = [];

  mount(container: HTMLElement, ctx: MiniGameContext): void {
    this.gameCtx = ctx;
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth || 360;
    canvas.height = container.clientHeight || 360;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    canvas.style.display = 'block';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d') ?? undefined;

    const onTap = (e: PointerEvent) => {
      if (!this.running || this.paused) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      for (const t of this.targets) {
        if (!t.hit && Math.hypot(t.x - x, t.y - y) < t.r + 12) {
          t.hit = true;
          this.score += 60;
          this.coins = this.score;
          this.gameCtx.onScore(this.coins, this.score);
          return;
        }
      }
      this.misses++;
    };
    const onResize = () => {
      if (!this.canvas) return;
      this.canvas.width = container.clientWidth || 360;
      this.canvas.height = container.clientHeight || 360;
    };
    canvas.addEventListener('pointerdown', onTap);
    window.addEventListener('resize', onResize);
    this.boundHandlers.push(() => canvas.removeEventListener('pointerdown', onTap));
    this.boundHandlers.push(() => window.removeEventListener('resize', onResize));
    this.loop();
    ctx.onReady?.();
  }

  start(): void {
    this.running = true;
    this.startedAt = performance.now();
  }

  pause(paused: boolean): void {
    this.paused = paused;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.running = false;
    this.boundHandlers.forEach((fn) => fn());
    this.boundHandlers = [];
    this.canvas?.remove();
    this.canvas = undefined;
    this.targets = [];
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const c = this.ctx2d;
    if (!c || !this.canvas) return;
    const now = performance.now();
    const w = this.canvas.width;
    const h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0c1526';
    c.fillRect(0, 0, w, h);

    // subtle stars
    c.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 30; i++) {
      const x = ((i * 97) % w + (now * 0.01) % w) % w;
      c.fillRect(x, (i * 53) % h, 2, 2);
    }

    if (!this.running || this.paused) return;

    if (now - this.lastSpawn > 620 && this.targets.length < 5) {
      this.lastSpawn = now;
      const r = 26 + Math.random() * 14;
      this.targets.push({
        x: r + Math.random() * (w - r * 2),
        y: r + Math.random() * (h - r * 2),
        r,
        born: now,
        life: 1600,
        hit: false,
      });
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      const age = now - t.born;
      if (t.hit || age > t.life) {
        if (!t.hit) this.misses++;
        this.targets.splice(i, 1);
        continue;
      }
      const alpha = 1 - age / t.life;
      const pulse = 1 + Math.sin(age * 0.01) * 0.06;
      c.beginPath();
      c.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
      const grad = c.createRadialGradient(t.x, t.y, 4, t.x, t.y, t.r);
      grad.addColorStop(0, `rgba(224,180,92,${alpha})`);
      grad.addColorStop(1, `rgba(200,151,58,${alpha * 0.55})`);
      c.fillStyle = grad;
      c.fill();
      c.strokeStyle = `rgba(253,251,246,${alpha * 0.8})`;
      c.lineWidth = 3;
      c.stroke();
      c.font = `${Math.round(t.r)}px serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🦅', t.x, t.y + 2);
    }

    c.fillStyle = '#FBF8F1';
    c.font = 'bold 18px Nunito, system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText(`Score ${this.score}`, 16, 28);
  };
}

export default () => new Fallback2D();
