import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';
import { buildStar } from './shared';

interface Obstacle {
  mesh: THREE.Object3D;
  kind: 'orb' | 'hole';
  z: number;
  x: number;
  active: boolean;
  hit?: boolean;
}

/**
 * Neon Slope — steer a glowing ball down an endless neon ramp.
 * Collect star orbs, avoid the dark pits.
 */
export default class NeonSlope extends BaseGame {
  private ball!: THREE.Mesh;
  private trail!: THREE.Points;
  private trailPositions!: Float32Array;
  private trailIndex = 0;
  private velX = 0;
  private playerX = 0;
  private speed = 16;
  private distance = 0;
  private items: Obstacle[] = [];
  private spawnIn = 0;
  private invuln = 0;
  private railGlow: THREE.Mesh[] = [];

  constructor() {
    super(manifestById('neon-slope'));
  }

  protected bgColor() {
    return 0x081720;
  }

  protected build(): void {
    this.camera.position.set(0, 7.5, 10);
    this.camera.lookAt(0, 0, -10);

    // Slope
    const slope = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 220), this.mat(0x0e2b37));
    slope.position.set(0, -0.25, -90);
    this.scene.add(slope);

    const grid = new THREE.GridHelper(220, 44, 0x4fa3b2, 0x17414d);
    grid.position.set(0, 0.02, -90);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    this.scene.add(grid);

    // Rails
    for (const x of [-5.4, 5.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 220), this.glowMat(0x57e0d2));
      rail.position.set(x, 0.3, -90);
      this.scene.add(rail);
      this.railGlow.push(rail);
    }

    // Neon pylons for speed feel
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4 + Math.random() * 4, 0.35), this.mat(0x16323d));
      pylon.position.set(side * (7 + Math.random() * 2), 2, -i * 9 - 5);
      this.scene.add(pylon);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), this.glowMat(side > 0 ? 0x4fa3b2 : 0xE0B45C));
      cap.position.copy(pylon.position).setY(4 + 2);
      this.scene.add(cap);
    }

    // Ball
    this.ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 2),
      this.mat(0x9fe8ff, { emissive: 0x1a6f8a }),
    );
    this.ball.position.set(0, 0.75, 0);
    this.scene.add(this.ball);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 24), this.glowMat(0x57e0d2, 0.8));
    halo.rotation.x = Math.PI / 2;
    this.ball.add(halo);

    // Trail points
    const count = 40;
    this.trailPositions = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trail = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x57e0d2, size: 0.22, transparent: true, opacity: 0.75 }));
    this.scene.add(this.trail);

    for (let i = 0; i < 22; i++) this.items.push(this.makeItem());
  }

  private makeItem(): Obstacle {
    const orb = Math.random() < 0.66;
    const mesh = orb
      ? buildStar(0.36)
      : new THREE.Mesh(new THREE.CircleGeometry(0.95, 12), this.glowMat(0x020a0f, 1));
    if (!orb) mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, kind: orb ? 'orb' : 'hole', z: 0, x: 0, active: false };
  }

  private spawn(): void {
    const slot = this.items.find((i) => !i.active);
    if (!slot) return;
    const isOrb = Math.random() < 0.68;
    slot.kind = isOrb ? 'orb' : 'hole';
    slot.x = (Math.random() - 0.5) * 8.6;
    slot.z = -70;
    slot.active = true;
    slot.hit = false;
    slot.mesh.visible = true;
    slot.mesh.position.set(slot.x, isOrb ? 1.0 : 0.06, slot.z);
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'a', 'arrowright', 'd'].includes(k)) {
      e.preventDefault();
      if (down) this.keys.add(k);
      else this.keys.delete(k);
    }
  }

  protected handlePointerMove(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.set(nx, 0);
  }

  protected handlePointerDown(e: PointerEvent): void {
    this.pointerDown = true;
    this.handlePointerMove(e);
  }

  protected handlePointerUp(): void {
    this.pointerDown = false;
  }

  protected update(dt: number): void {
    if (!this.ball) return;
    this.updateBursts(dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.speed = 15 + this.difficulty() * 2.4 + Math.min(8, this.distance / 260);
    this.distance += this.speed * dt;
    this.ctx.onProgress?.(Math.min(1, this.distance / 500));

    let steer = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) steer -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) steer += 1;
    if (steer === 0 && this.pointerDown) steer = this.pointer.x * 1.25;
    this.velX += steer * dt * 26;
    this.velX *= 0.92;
    this.playerX = THREE.MathUtils.clamp(this.playerX + this.velX * dt, -4.9, 4.9);
    this.ball.position.x = this.playerX;
    this.ball.position.z = 0;
    this.ball.position.y = 0.75 + Math.sin(this.elapsed * 6) * 0.05;
    this.ball.rotation.z -= this.velX * dt * 0.6;
    this.ball.rotation.x -= this.speed * dt * 0.5;

    if (this.invuln > 0) this.ball.visible = Math.floor(this.elapsed * 14) % 2 === 0;

    // Trail
    this.trailIndex = (this.trailIndex + 1) % 40;
    this.trailPositions[this.trailIndex * 3] = this.playerX + (Math.random() - 0.5) * 0.3;
    this.trailPositions[this.trailIndex * 3 + 1] = 0.7;
    this.trailPositions[this.trailIndex * 3 + 2] = 0.2 + Math.random() * 1.4;
    (this.trail.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    // Items
    this.spawnIn -= this.speed * dt;
    if (this.spawnIn <= 0) {
      this.spawnIn = 8 + Math.random() * 8;
      this.spawn();
    }
    for (const item of this.items) {
      if (!item.active) continue;
      item.z += this.speed * dt;
      item.mesh.position.z = item.z;
      if (item.kind === 'orb') {
        item.mesh.rotation.y += dt * 2.4;
        item.mesh.position.y = 1 + Math.sin(this.elapsed * 3 + item.x) * 0.14;
      }
      if (!item.hit && Math.abs(item.z) < 1.1 && Math.abs(item.x - this.playerX) < 0.95) {
        item.hit = true;
        if (item.kind === 'orb') {
          item.active = false;
          item.mesh.visible = false;
          this.addScore(60);
          this.burst(item.mesh.position.clone(), 0xffd166, 14, 0.8);
        } else if (this.invuln <= 0) {
          this.invuln = 1.2;
          this.velX *= -0.4;
          this.playerX = THREE.MathUtils.clamp(this.playerX + (this.playerX > 0 ? -1.4 : 1.4), -4.9, 4.9);
          this.shake(this.camera, 0.3);
          this.burst(new THREE.Vector3(item.x, 0.4, 0), 0xe2574c, 20, 1);
        }
      }
      if (item.z > 10) {
        item.active = false;
        item.mesh.visible = false;
      }
    }

    this.camera.position.x = this.playerX * 0.55;
    this.camera.position.y = 7.2;
    this.camera.position.z = 10.5;
    this.camera.lookAt(this.playerX * 0.4, 0.6, -8);
  }
}
