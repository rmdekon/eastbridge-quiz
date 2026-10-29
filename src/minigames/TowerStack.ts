import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';

interface Slab {
  mesh: THREE.Mesh;
  width: number;
  x: number;
}

/**
 * Tower Stack — timing-based block stacking with perfect combos.
 * Everything is one reused geometry; only positions/scale change per block.
 */
export default class TowerStack extends BaseGame {
  private slabs: Slab[] = [];
  private moving!: THREE.Mesh;
  private movingWidth = 4;
  private direction = 1;
  private movingSpeed = 2.6;
  private stackHeight = 0;
  private baseY = -3;
  private perfectStreak = 0;
  private gameOver = false;
  private hue = 0;

  constructor() {
    super(manifestById('tower-stack'));
  }

  protected bgColor() {
    return 0x101c33;
  }

  protected build(): void {
    this.camera.position.set(6, 4, 12);
    this.camera.lookAt(0, 1, 0);

    // Platform glow + stars
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.4, 32), this.mat(0x1a2a47));
    disc.position.y = this.baseY - 1.3;
    this.scene.add(disc);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(7, 0.08, 8, 48), this.glowMat(0x4fa3b2, 0.8));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = this.baseY - 1.1;
    this.scene.add(halo);

    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 26 - 4;
      pos[i * 3 + 2] = -10 - Math.random() * 20;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbcd6ff, size: 0.22 })));

    // Base slab
    this.addSlab(0, 4, this.baseY);

    this.moving = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 4), this.mat(0x6bbf8a, { emissive: 0x11402a }));
    this.moving.position.set(0, this.baseY + 0.95, 0);
    this.moving.scale.x = this.movingWidth;
    this.scene.add(this.moving);
  }

  private addSlab(x: number, width: number, y: number): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 4), this.mat(0x6bbf8a, { emissive: 0x11402a }));
    mesh.position.set(x, y, 0);
    mesh.scale.x = width;
    this.scene.add(mesh);
    this.slabs.push({ mesh, width, x });
  }

  protected handlePointerDown(): void {
    this.drop();
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    if (!down) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'arrowdown') {
      e.preventDefault();
      this.drop();
    }
  }

  private drop(): void {
    if (this.gameOver || !this.running) return;
    const prev = this.slabs[this.slabs.length - 1];
    const movingX = this.moving.position.x;
    const leftA = prev.x - prev.width / 2;
    const rightA = prev.x + prev.width / 2;
    const leftB = movingX - this.movingWidth / 2;
    const rightB = movingX + this.movingWidth / 2;
    const overlapLeft = Math.max(leftA, leftB);
    const overlapRight = Math.min(rightA, rightB);
    const overlap = overlapRight - overlapLeft;

    if (overlap <= 0.08) {
      this.gameOver = true;
      this.burst(new THREE.Vector3(movingX, this.moving.position.y, 0), 0xe2574c, 40, 1.6);
      this.shake(this.camera, 0.4);
      this.moving.visible = false;
      setTimeout(() => this.finishGame(), 700);
      return;
    }

    const perfect = Math.abs(movingX - prev.x) < 0.16;
    const width = perfect ? Math.min(prev.width, this.movingWidth + 0.15) : overlap;
    const x = perfect ? prev.x : overlapLeft + overlap / 2;
    const y = this.moving.position.y;

    const placed = this.moving;
    placed.position.x = x;
    placed.scale.x = width;
    this.slabs.push({ mesh: placed, width, x });

    if (perfect) {
      this.perfectStreak++;
      this.addScore(140 + this.perfectStreak * 30);
      this.burst(placed.position.clone(), 0xffd166, 26, 1.2);
    } else {
      this.perfectStreak = 0;
      this.addScore(80, 1);
      this.burst(new THREE.Vector3(x, y, 0), 0x6bbf8a, 12, 0.7);
    }

    this.stackHeight++;
    this.ctx.onProgress?.(Math.min(1, this.stackHeight / 22));

    // Grow camera and speed up
    this.movingSpeed = 2.6 + Math.min(5.5, this.stackHeight * 0.22) + this.difficulty() * 0.4;
    this.hue = (this.hue + 0.07) % 1;
    const color = new THREE.Color().setHSL(0.38 + this.hue * 0.2, 0.5, 0.6);

    this.moving = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 4), this.mat(color.getHex(), { emissive: 0x11402a }));
    this.movingWidth = width;
    this.moving.scale.x = width;
    this.moving.position.set(-8 - width, y + 0.95, 0);
    this.direction = 1;
    this.scene.add(this.moving);

    this.camera.position.y = Math.min(16, 4 + this.stackHeight * 0.55);
    this.camera.lookAt(x * 0.4, y, 0);
  }

  protected update(dt: number): void {
    if (!this.moving || this.gameOver) {
      this.updateBursts(dt);
      return;
    }
    this.updateBursts(dt);
    this.moving.position.x += this.direction * this.movingSpeed * dt;
    const limit = 8 + this.movingWidth / 2;
    if (this.moving.position.x > limit) {
      this.moving.position.x = limit;
      this.direction = -1;
    } else if (this.moving.position.x < -limit) {
      this.moving.position.x = -limit;
      this.direction = 1;
    }
    // Guide line on top of the stack
    const top = this.slabs[this.slabs.length - 1];
    this.moving.position.y = top.mesh.position.y + 0.95;

    this.camera.position.x = 6 + Math.sin(this.elapsed * 0.2) * 0.3;
    this.camera.lookAt(this.moving.position.x * 0.35, top.mesh.position.y + 1, 0);

    // Slabs gently bob for life
    for (let i = 0; i < this.slabs.length; i++) {
      const s = this.slabs[i];
      s.mesh.rotation.y = Math.sin(this.elapsed * 0.6 + i * 0.3) * 0.01;
    }
  }
}
