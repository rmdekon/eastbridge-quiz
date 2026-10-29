import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';
import { buildEagle } from './shared';

interface Tile {
  mesh: THREE.Mesh;
  gold: THREE.Mesh;
  x: number;
  z: number;
  dug: boolean;
  hasGold: boolean;
  pop: number;
}

/**
 * Gold Rush — dig the sand grid for gold cubes before time runs out.
 * Move with arrows/WASD or drag, dig with space or tap.
 */
export default class GoldRush extends BaseGame {
  private grid = 6;
  private tileSize = 2.4;
  private tiles: Tile[][] = [];
  private player!: THREE.Group;
  private px = 2;
  private pz = 5;
  private target = new THREE.Vector2(2, 5);
  private digCooldown = 0;
  private dugCount = 0;
  private goldCount = 0;

  constructor() {
    super(manifestById('gold-rush'));
  }

  protected bgColor() {
    return 0x2a2114;
  }

  private worldX(i: number) {
    return (i - (this.grid - 1) / 2) * this.tileSize;
  }
  private worldZ(j: number) {
    return (j - (this.grid - 1) / 2) * this.tileSize;
  }

  protected build(): void {
    this.camera.position.set(0, 15, 13);
    this.camera.lookAt(0, 0, 0);

    const base = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 24), this.mat(0x4a3a22));
    base.position.y = -0.7;
    this.scene.add(base);

    const tileGeo = new THREE.BoxGeometry(this.tileSize - 0.12, 0.5, this.tileSize - 0.12);
    for (let j = 0; j < this.grid; j++) {
      const row: Tile[] = [];
      for (let i = 0; i < this.grid; i++) {
        const hasGold = Math.random() < 0.22;
        const mesh = new THREE.Mesh(tileGeo, this.mat(0xb98a4a));
        mesh.position.set(this.worldX(i), 0, this.worldZ(j));
        this.scene.add(mesh);
        const gold = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.8, 0.8),
          this.mat(0xffd166, { emissive: 0x8a5f13 }),
        );
        gold.position.set(this.worldX(i), 0.5, this.worldZ(j));
        gold.visible = false;
        this.scene.add(gold);
        row.push({ mesh, gold, x: i, z: j, dug: false, hasGold, pop: 0 });
      }
      this.tiles.push(row);
    }

    // Border posts
    for (let i = 0; i < 4; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 3, 6), this.mat(0x6b4f2a));
      post.position.set(i % 2 === 0 ? -8.5 : 8.5, 1.4, i < 2 ? -8.5 : 8.5);
      this.scene.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), this.glowMat(0xffd166));
      lamp.position.copy(post.position).setY(3.1);
      this.scene.add(lamp);
    }

    this.player = buildEagle(0.85, 0xfdfbf6, 0xc8973a);
    this.player.position.set(this.worldX(this.px), 0.65, this.worldZ(this.pz));
    this.scene.add(this.player);

    // Little cart for flavour
    const cart = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1.2), this.mat(0x6b4f2a));
    cart.add(bed);
    for (const [x, z] of [
      [-0.7, 0.5],
      [0.7, 0.5],
      [-0.7, -0.5],
      [0.7, -0.5],
    ] as Array<[number, number]>) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), this.mat(0x3a2a18));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -0.35, z);
      cart.add(wheel);
    }
    cart.position.set(-10.5, 0.7, 2);
    this.scene.add(cart);
  }

  private move(dx: number, dz: number): void {
    this.target.x = THREE.MathUtils.clamp(this.target.x + dx, 0, this.grid - 1);
    this.target.y = THREE.MathUtils.clamp(this.target.y + dz, 0, this.grid - 1);
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    if (!down) return;
    const k = e.key.toLowerCase();
    e.preventDefault();
    if (k === 'arrowleft' || k === 'a') this.move(-1, 0);
    else if (k === 'arrowright' || k === 'd') this.move(1, 0);
    else if (k === 'arrowup' || k === 'w') this.move(0, -1);
    else if (k === 'arrowdown' || k === 's') this.move(0, 1);
    else if (k === ' ') this.dig();
  }

  protected handlePointerMove(e: PointerEvent): void {
    if (!this.pointerDown) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const i = Math.round((nx * 11) / this.tileSize + (this.grid - 1) / 2);
    const j = Math.round((ny * 7) / this.tileSize + (this.grid - 1) / 2);
    this.target.set(THREE.MathUtils.clamp(i, 0, this.grid - 1), THREE.MathUtils.clamp(j, 0, this.grid - 1));
  }

  protected handlePointerDown(e: PointerEvent): void {
    this.pointerDown = true;
    this.handlePointerMove(e);
    this.dig();
  }

  protected handlePointerUp(): void {
    this.pointerDown = false;
  }

  private dig(): void {
    if (this.digCooldown > 0) return;
    const tile = this.tiles[Math.round(this.target.y)]?.[Math.round(this.target.x)];
    if (!tile || tile.dug) return;
    const dist = Math.hypot(this.px - tile.x, this.pz - tile.z);
    if (dist > 0.6) return;
    this.digCooldown = 0.18;
    tile.dug = true;
    this.dugCount++;
    tile.mesh.material = this.mat(0x6b4f2a);
    tile.mesh.scale.y = 0.45;
    if (tile.hasGold) {
      this.goldCount++;
      tile.gold.visible = true;
      tile.pop = 0.001;
      this.addScore(120);
      this.burst(tile.gold.position.clone(), 0xffd166, 30, 1.2);
    } else {
      this.addScore(15);
      this.burst(new THREE.Vector3(tile.mesh.position.x, 0.4, tile.mesh.position.z), 0xb98a4a, 8, 0.6);
    }
    this.ctx.onProgress?.(this.dugCount / (this.grid * this.grid));
    if (this.dugCount >= this.grid * this.grid) {
      setTimeout(() => this.finishGame(), 500);
    }
  }

  protected update(dt: number): void {
    if (!this.player) return;
    this.updateBursts(dt);
    this.digCooldown = Math.max(0, this.digCooldown - dt);

    const tx = this.worldX(this.target.x);
    const tz = this.worldZ(this.target.y);
    const oldX = this.player.position.x;
    this.player.position.x += (tx - this.player.position.x) * Math.min(1, dt * 9);
    this.player.position.z += (tz - this.player.position.z) * Math.min(1, dt * 9);
    this.player.position.y = 0.65 + Math.abs(Math.sin(this.elapsed * 10)) * 0.06;
    this.player.rotation.z = (this.player.position.x - oldX) * -0.9;

    this.px = this.target.x;
    this.pz = this.target.y;

    // Selection ring follows the player
    for (const row of this.tiles) {
      for (const t of row) {
        if (t.pop > 0) {
          t.pop += dt * 3;
          t.gold.position.y = 0.5 + Math.sin(Math.min(Math.PI, t.pop) ) * 1.1;
          t.gold.rotation.y += dt * 4;
          if (t.pop > Math.PI) t.pop = 0;
        }
        if (!t.dug) t.mesh.position.y = Math.sin(this.elapsed * 1.4 + t.x + t.z) * 0.02;
      }
    }

    this.camera.position.x = this.player.position.x * 0.25;
    this.camera.position.z = 13 + this.player.position.z * 0.12;
    this.camera.lookAt(this.player.position.x * 0.2, 0, this.player.position.z * 0.2);
  }
}
