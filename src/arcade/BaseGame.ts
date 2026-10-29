import * as THREE from 'three';
import type { MiniGame, MiniGameContext, MiniGameManifest } from '../types';
import { clamp, prefersReducedMotion } from '../lib/utils';

export type Quality = 'high' | 'low';

export interface Disposable {
  dispose(): void;
}

/**
 * Base class for every three.js minigame.
 *
 * Responsibilities handled centrally so each game stays small and original:
 *  - renderer/scene/camera lifecycle, DPR capped at 1.5
 *  - resize handling (ResizeObserver + window fallback)
 *  - fixed-ish delta loop with tab-visibility pause
 *  - keyboard + pointer + touch swipe input helpers
 *  - adaptive quality: drops effects when FPS < 40
 *  - bulletproof disposal: geometries, materials, textures, renderer, canvas
 *  - score → coin conversion callback
 */
export abstract class BaseGame implements MiniGame {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly emoji: string;
  readonly color: string;
  readonly minYear: number;
  readonly maxYear: number;
  readonly controls: string;
  readonly thumbnail: string;

  protected container!: HTMLElement;
  protected ctx!: MiniGameContext;
  protected renderer!: THREE.WebGLRenderer;
  protected scene!: THREE.Scene;
  protected camera!: THREE.PerspectiveCamera;
  protected clock = new THREE.Clock();
  protected elapsed = 0;
  protected running = false;
  protected pausedFlag = false;
  protected disposed = false;
  protected rafId = 0;
  protected quality: Quality = 'high';
  protected reduced = false;

  protected score = 0;
  protected coins = 0;
  protected collectibles: Disposable[] = [];
  protected timeScale = 1;

  protected keys = new Set<string>();
  protected pointer = new THREE.Vector2(0, 0);
  protected pointerDown = false;
  protected swipe: { x0: number; y0: number; x1: number; y1: number; t0: number } | null = null;

  private ro?: ResizeObserver;
  private fpsFrames = 0;
  private fpsAccum = 0;
  private lowStreak = 0;
  private onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);
  private onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
  private onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
  private onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private onContext = (e: Event) => e.preventDefault();
  private onVisibility = () => {
    if (document.hidden) this.pause(true);
  };

  constructor(manifest: MiniGameManifest) {
    this.id = manifest.id;
    this.name = manifest.name;
    this.tagline = manifest.tagline;
    this.emoji = manifest.emoji;
    this.color = manifest.color;
    this.minYear = manifest.minYear;
    this.maxYear = manifest.maxYear;
    this.controls = manifest.controls;
    this.thumbnail = manifest.thumbnail;
  }

  /* ------------------------------- lifecycle ------------------------------ */

  mount(container: HTMLElement, ctx: MiniGameContext): void {
    this.container = container;
    this.ctx = ctx;
    this.reduced = ctx.reducedMotion || prefersReducedMotion();

    const renderer = new THREE.WebGLRenderer({
      antialias: ctx.difficulty < 3,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(container.clientWidth || 320, container.clientHeight || 320, false);
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(this.bgColor());
    this.scene = scene;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 220);
    this.camera.position.set(0, 6, 12);
    this.camera.lookAt(0, 0, 0);

    this.addLights();
    this.build();

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(container);
    }
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointermove', this.onPointerMove);
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    renderer.domElement.addEventListener('contextmenu', this.onContext);
    document.addEventListener('visibilitychange', this.onVisibility);

    this.clock.start();
    this.loop();
    ctx.onReady?.();
  }

  start(): void {
    this.running = true;
    this.pausedFlag = false;
    this.clock.getDelta();
  }

  pause(paused: boolean): void {
    this.pausedFlag = paused;
    if (!paused) this.clock.getDelta();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ro?.disconnect();
    if (this.renderer?.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
      this.renderer.domElement.removeEventListener('contextmenu', this.onContext);
    }
    this.onDispose();
    this.scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const m of mats) {
        for (const key of Object.keys(m)) {
          const val = (m as unknown as Record<string, unknown>)[key];
          if (val && typeof val === 'object' && 'isTexture' in (val as object)) {
            (val as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    });
    this.scene?.clear();
    this.collectibles.forEach((c) => c.dispose());
    this.collectibles = [];
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer.domElement.remove();
    }
    if (this.container) this.container.innerHTML = '';
  }

  /* ------------------------------ subclass API ---------------------------- */

  protected abstract build(): void;
  protected update(_dt: number, _t: number): void {}
  protected onDispose(): void {}
  protected bgColor(): number {
    return 0x0c1526;
  }
  protected handleKey(_e: KeyboardEvent, _down: boolean): void {}
  protected handlePointerMove(_e: PointerEvent): void {}
  protected handlePointerDown(_e: PointerEvent): void {}
  protected handlePointerUp(_e: PointerEvent): void {}

  /** Called by the engine when sustained FPS < 40. */
  protected degrade(): void {
    if (this.quality === 'low') return;
    this.quality = 'low';
    this.renderer.setPixelRatio(1);
    this.scene.traverse((o) => {
      if ((o as THREE.Points).isPoints) o.visible = false;
    });
  }

  protected resize = () => {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth || 320;
    const h = this.container.clientHeight || 320;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  /* -------------------------------- scoring ------------------------------- */

  protected addScore(points: number, coinRate = 1): void {
    this.score += points;
    this.coins = Math.round(this.score * coinRate);
    this.ctx.onScore(this.coins, this.score);
  }

  protected finishGame(): void {
    if (!this.running) return;
    this.running = false;
    this.ctx.onFinish({ coins: this.coins, rawScore: this.score });
  }

  /* --------------------------------- loop --------------------------------- */

  private loop = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum > 1) {
      const fps = this.fpsFrames / this.fpsAccum;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      if (fps < 40) {
        if (++this.lowStreak >= 2) this.degrade();
      } else {
        this.lowStreak = 0;
      }
    }
    if (!this.running || this.pausedFlag || this.ctx?.isPaused?.()) {
      this.renderer?.render(this.scene, this.camera);
      return;
    }
    const dt = rawDt * this.timeScale;
    this.elapsed += dt;
    try {
      this.update(dt, this.elapsed);
    } catch (e) {
      console.error(`[${this.id}] update error`, e);
    }
    this.renderer.render(this.scene, this.camera);
  };

  /* --------------------------------- helpers ------------------------------ */

  protected addLights(): void {
    const hemi = new THREE.HemisphereLight(0xd8f0ff, 0x1a2a44, 1.15);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.35);
    dir.position.set(6, 12, 8);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xffd58a, 0.45);
    fill.position.set(-8, 5, -6);
    this.scene.add(fill);
  }

  /** Standard toon-ish material: flat-ish shading, bright, no textures. */
  protected mat(color: number, opts: { emissive?: number; transparent?: boolean; opacity?: number } = {}) {
    return new THREE.MeshLambertMaterial({
      color,
      emissive: opts.emissive ?? 0x000000,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
  }

  protected glowMat(color: number, opacity = 1) {
    return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
  }

  protected box(w: number, h: number, d: number, color: number, pos?: [number, number, number]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color));
    if (pos) mesh.position.set(...pos);
    return mesh;
  }

  protected sphere(r: number, color: number, pos?: [number, number, number], segments = 16) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, segments, segments), this.mat(color));
    if (pos) mesh.position.set(...pos);
    return mesh;
  }

  protected ring(inner: number, outer: number, color: number) {
    return new THREE.Mesh(new THREE.RingGeometry(inner, outer, 28), this.glowMat(color, 0.75));
  }

  /** Lightweight confetti burst using a pooled Points cloud. */
  protected burst(position: THREE.Vector3, color = 0xC8973A, count = 40, spread = 1.4): void {
    if (this.reduced || this.quality === 'low') return;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel: number[] = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = position.x;
      pos[i * 3 + 1] = position.y;
      pos[i * 3 + 2] = position.z;
      vel.push((Math.random() - 0.5) * 4 * spread, Math.random() * 4.5, (Math.random() - 0.5) * 4 * spread);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.16, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    let life = 0.85;
    const tick = (dt: number) => {
      life -= dt;
      const arr = (geo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] += vel[i * 3] * dt;
        arr[i * 3 + 1] += vel[i * 3 + 1] * dt;
        arr[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 9.8 * dt;
      }
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      mat.opacity = clamp(life / 0.85, 0, 1);
      if (life <= 0) {
        this.scene.remove(points);
        geo.dispose();
        mat.dispose();
        const idx = this.collectibles.indexOf(holder);
        if (idx >= 0) this.collectibles.splice(idx, 1);
      }
    };
    const holder: Disposable = {
      dispose: () => {
        this.scene?.remove(points);
        geo.dispose();
        mat.dispose();
      },
    };
    this.collectibles.push(holder);
    this.bursts.push({ tick, holder });
  }

  private bursts: Array<{ tick: (dt: number) => void; holder: Disposable }> = [];

  protected updateBursts(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].tick(dt);
      if (!this.collectibles.includes(this.bursts[i].holder)) this.bursts.splice(i, 1);
    }
  }

  protected shake(camera: THREE.PerspectiveCamera, amount = 0.18): void {
    if (this.reduced) return;
    camera.position.x += (Math.random() - 0.5) * amount;
    camera.position.y += (Math.random() - 0.5) * amount;
  }

  protected forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }

  protected difficulty(): 1 | 2 | 3 {
    return this.ctx.difficulty;
  }
}
