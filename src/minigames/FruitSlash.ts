import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';

interface Fruit {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  spin: number;
  rotten: boolean;
  sliced: boolean;
  life: number;
}

const FRUIT_COLORS = [0xE2574C, 0xF2A03D, 0x9FEF9A, 0xF7D957, 0xE87BA8, 0x8ED4E8];

/**
 * Fruit Slash — swipe to slice. Rotten items cost points, so accuracy matters.
 * Slicing is a simple distance test against the swipe segment (no physics engine).
 */
export default class FruitSlash extends BaseGame {
  private fruits: Fruit[] = [];
  private spawnTimer = 0.5;
  private swing: Array<{ x: number; y: number; t: number }> = [];
  private trailLine!: THREE.Line;
  private trailPositions!: Float32Array;
  private trailCount = 0;
  private combo = 0;
  private comboTimer = 0;
  private lastX = 0;
  private lastY = 0;

  constructor() {
    super(manifestById('fruit-slash'));
  }

  protected bgColor() {
    return 0x1a1030;
  }

  protected build(): void {
    this.camera.position.set(0, 0, 12);
    this.camera.lookAt(0, 0, 0);

    // Warm arcade backdrop
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), this.glowMat(0x2a1a4a, 1));
    backdrop.position.set(0, 0, -4);
    this.scene.add(backdrop);
    for (let i = 0; i < 30; i++) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 6), this.glowMat(0x6b5aa8, 0.6));
      dot.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, -3);
      this.scene.add(dot);
    }

    // Swipe trail
    const maxPoints = 24;
    this.trailPositions = new Float32Array(maxPoints * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailLine = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    );
    this.trailLine.frustumCulled = false;
    this.scene.add(this.trailLine);

    for (let i = 0; i < 14; i++) this.fruits.push(this.makeFruit());
  }

  private makeFruit(): Fruit {
    const group = new THREE.Group();
    const rotten = Math.random() < 0.26;
    const color = rotten ? 0x3f4a2a : FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)];
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 14, 12),
      this.mat(color, { emissive: rotten ? 0x101405 : 0x1a0e0e }),
    );
    body.scale.set(1, 0.92, 0.92);
    group.add(body);
    if (!rotten) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), this.mat(0x4f8a4f));
      leaf.position.set(0.1, 0.6, 0);
      leaf.rotation.z = -0.5;
      group.add(leaf);
    } else {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), this.glowMat(0x7a8a4a));
      spot.position.set(0.2, 0.15, 0.5);
      group.add(spot);
      const spot2 = spot.clone();
      spot2.position.set(-0.2, -0.1, 0.5);
      group.add(spot2);
    }
    group.visible = false;
    this.scene.add(group);
    return { mesh: group, vel: new THREE.Vector3(), spin: 0, rotten, sliced: false, life: 0 };
  }

  private spawn(): void {
    const f = this.fruits.find((x) => !x.mesh.visible);
    if (!f) return;
    const x = (Math.random() - 0.5) * 12;
    f.mesh.position.set(x, -6.5, 0);
    f.mesh.visible = true;
    f.sliced = false;
    f.life = 0;
    f.vel.set((Math.random() - 0.5) * 2.4, 11 + Math.random() * 3.4 + this.difficulty() * 0.8, 0);
    f.spin = (Math.random() - 0.5) * 5;
  }

  protected handlePointerDown(e: PointerEvent): void {
    this.pointerDown = true;
    this.trackPointer(e);
  }

  protected handlePointerMove(e: PointerEvent): void {
    if (this.pointerDown) this.trackPointer(e);
  }

  protected handlePointerUp(): void {
    this.pointerDown = false;
    this.trailCount = 0;
    this.updateTrailGeometry();
  }

  private trackPointer(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const world = new THREE.Vector3(nx * 7.6, ny * 4.6, 0);
    const prevX = this.lastX;
    const prevY = this.lastY;
    this.lastX = world.x;
    this.lastY = world.y;

    if (this.trailCount > 0) {
      this.checkSlice(prevX, prevY, world.x, world.y);
    }
    this.swing.push({ x: world.x, y: world.y, t: performance.now() });
    if (this.swing.length > 3) this.swing.shift();
    this.pushTrail(world);
  }

  private pushTrail(world: THREE.Vector3): void {
    const max = 24;
    if (this.trailCount < max) {
      this.trailCount++;
    } else {
      this.trailPositions.copyWithin(0, 3);
    }
    const i = this.trailCount - 1;
    this.trailPositions[i * 3] = world.x;
    this.trailPositions[i * 3 + 1] = world.y;
    this.trailPositions[i * 3 + 2] = 0.2;
    this.updateTrailGeometry();
    (this.trailLine.material as THREE.LineBasicMaterial).opacity = 0.95;
  }

  private updateTrailGeometry(): void {
    const geo = this.trailLine.geometry;
    geo.setDrawRange(0, Math.max(0, this.trailCount));
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Distance from a fruit (point) to the swipe segment. */
  private checkSlice(x1: number, y1: number, x2: number, y2: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0009) return;
    for (const f of this.fruits) {
      if (!f.mesh.visible || f.sliced) continue;
      const px = f.mesh.position.x - x1;
      const py = f.mesh.position.y - y1;
      const t = THREE.MathUtils.clamp((px * dx + py * dy) / lenSq, 0, 1);
      const closestX = x1 + dx * t;
      const closestY = y1 + dy * t;
      const dist = Math.hypot(f.mesh.position.x - closestX, f.mesh.position.y - closestY);
      if (dist < 0.85) {
        f.sliced = true;
        f.mesh.visible = false;
        if (f.rotten) {
          this.combo = 0;
          this.score = Math.max(0, this.score - 40);
          this.coins = Math.max(0, this.coins - 40);
          this.ctx.onScore(this.coins, this.score);
          this.shake(this.camera, 0.3);
          this.burst(f.mesh.position.clone(), 0x7a8a4a, 18, 1.1);
        } else {
          this.combo++;
          this.comboTimer = 1.6;
          const points = 60 + Math.min(5, this.combo) * 20;
          this.addScore(points);
          this.burst(f.mesh.position.clone(), 0xffd166, 22, 1.3);
        }
      }
    }
  }

  protected update(dt: number): void {
    if (!this.trailLine) return;
    this.updateBursts(dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) this.combo = 0;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.32, 0.9 - this.difficulty() * 0.12);
      this.spawn();
      if (Math.random() < 0.35) this.spawn();
    }

    for (const f of this.fruits) {
      if (!f.mesh.visible) continue;
      f.vel.y -= 13.5 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.z += f.spin * dt;
      f.mesh.rotation.y += f.spin * dt * 0.4;
      f.life += dt;
      if (f.mesh.position.y < -7 || f.life > 6) {
        f.mesh.visible = false;
      }
    }

    // Fade the swipe trail when idle
    const mat = this.trailLine.material as THREE.LineBasicMaterial;
    if (!this.pointerDown && mat.opacity > 0) {
      mat.opacity = Math.max(0, mat.opacity - dt * 3.5);
    }
    if (this.swing.length) {
      const now = performance.now();
      this.swing = this.swing.filter((s) => now - s.t < 200);
    }

    // Ambient camera sway
    this.camera.position.x = Math.sin(this.elapsed * 0.4) * 0.3;
    this.camera.position.y = Math.cos(this.elapsed * 0.3) * 0.2;
    this.camera.lookAt(0, 0, 0);
  }
}
