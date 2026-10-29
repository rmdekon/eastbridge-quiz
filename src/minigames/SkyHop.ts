import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';

type RowKind = 'grass' | 'road' | 'river';

interface Row {
  z: number;
  kind: RowKind;
  tiles: THREE.Mesh[];
  movers: Array<{ mesh: THREE.Mesh; speed: number; width: number }>;
  index: number;
}

/**
 * Sky Hop — a voxel road-and-river hopper. Tap to hop one row forward.
 * Cars send you back, river rows need a log to land on. Gentle, colourful.
 */
export default class SkyHop extends BaseGame {
  private hopper!: THREE.Group;
  private rows: Row[] = [];
  private playerRow = 0;
  private playerX = 0;
  private hop = 0;
  private hopFrom = new THREE.Vector3();
  private hopTo = new THREE.Vector3();
  private hopperY = 0.4;
  private maxRow = 0;
  private nextIndex = 0;
  private rowSpacing = 2.2;
  private camLift = 0;

  constructor() {
    super(manifestById('sky-hop'));
  }

  protected bgColor() {
    return 0x8fd3e8;
  }

  protected build(): void {
    this.camera.position.set(0, 8, 10);
    this.camera.lookAt(0, 0, -8);

    // Soft grass banks either side
    const bankL = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 120), this.mat(0x7fa476));
    bankL.position.set(-20, -0.5, -40);
    this.scene.add(bankL);
    const bankR = bankL.clone();
    bankR.position.x = 20;
    this.scene.add(bankR);

    // Starting safe grass row
    const start = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 2.2), this.mat(0x8fbb7f));
    start.position.set(0, 0, 0);
    this.scene.add(start);

    this.hopper = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), this.mat(0x9fef9a, { emissive: 0x1f5e23 }));
    this.hopper.add(body);
    for (const [x, z] of [
      [-0.25, 0.4],
      [0.25, 0.4],
    ] as Array<[number, number]>) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), this.glowMat(0x1b3a6b));
      eye.position.set(x, 0.2, z);
      this.hopper.add(eye);
    }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 4), this.mat(0xc8973a));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.05, 0.62);
    this.hopper.add(beak);
    this.hopper.position.set(0, 0.4, 0);
    this.scene.add(this.hopper);

    for (let i = 0; i < 10; i++) this.rows.push(this.makeRow());
    for (let i = 0; i < 10; i++) {
      this.placeRow(this.rows[i], i + 1);
    }

    // Clouds
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random(), 8, 8), this.mat(0xffffff));
        puff.position.set(j * 1.4 - 1.4, Math.random() * 0.4, 0);
        cloud.add(puff);
      }
      cloud.position.set((Math.random() - 0.5) * 40, 9 + Math.random() * 4, -20 - Math.random() * 30);
      this.scene.add(cloud);
    }
  }

  private makeRow(): Row {
    return { z: 0, kind: 'grass', tiles: [], movers: [], index: 0 };
  }

  private clearRow(row: Row): void {
    for (const m of row.tiles) this.scene.remove(m);
    for (const m of row.movers) this.scene.remove(m.mesh);
    row.tiles = [];
    row.movers = [];
  }

  private placeRow(row: Row, rowNumber: number): void {
    this.clearRow(row);
    const difficulty = this.difficulty();
    const rand = Math.random();
    const kind: RowKind = rowNumber < 3 ? 'grass' : rand < 0.45 ? 'road' : rand < 0.78 ? 'river' : 'grass';
    row.kind = kind;
    row.index = rowNumber;
    row.z = -rowNumber * this.rowSpacing + 1.2;

    if (kind === 'grass') {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, this.rowSpacing), this.mat(0x8fbb7f));
      tile.position.set(0, 0, row.z);
      this.scene.add(tile);
      row.tiles.push(tile);
    } else if (kind === 'road') {
      const road = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, this.rowSpacing), this.mat(0x4a4f63));
      road.position.set(0, 0, row.z);
      this.scene.add(road);
      row.tiles.push(road);
      const count = 1 + (difficulty > 1 ? 1 : 0) + (difficulty > 2 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const car = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.9, 1.2),
          this.mat(i % 2 ? 0xe2574c : 0xe0b45c, { emissive: 0x2a0f08 }),
        );
        car.position.set((Math.random() - 0.5) * 12, 0.55, row.z);
        this.scene.add(car);
        row.movers.push({
          mesh: car,
          speed: (2.6 + difficulty * 0.9 + Math.random() * 1.6) * (Math.random() > 0.5 ? 1 : -1),
          width: 2.1,
        });
      }
    } else {
      const water = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, this.rowSpacing), this.mat(0x3aa6c9));
      water.position.set(0, -0.15, row.z);
      this.scene.add(water);
      row.tiles.push(water);
      const logs = 2 + (difficulty > 2 ? 0 : 1);
      for (let i = 0; i < logs; i++) {
        const log = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.5, 1.3),
          this.mat(0x8a5a34, { emissive: 0x2a1a0c }),
        );
        log.position.set((i - (logs - 1) / 2) * 4.6 + (Math.random() - 0.5) * 1.2, 0.22, row.z);
        this.scene.add(log);
        row.movers.push({ mesh: log, speed: 1.4 + Math.random() * 1.2, width: 3.4 });
      }
    }
  }

  protected handlePointerDown(): void {
    this.hopForward();
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    if (!down) return;
    const k = e.key.toLowerCase();
    if ([' ', 'w', 'arrowup'].includes(k)) {
      e.preventDefault();
      this.hopForward();
    } else if (['a', 'arrowleft'].includes(k)) {
      e.preventDefault();
      this.playerX = THREE.MathUtils.clamp(this.playerX - 1.4, -5.8, 5.8);
    } else if (['d', 'arrowright'].includes(k)) {
      e.preventDefault();
      this.playerX = THREE.MathUtils.clamp(this.playerX + 1.4, -5.8, 5.8);
    }
  }

  private hopForward(): void {
    if (this.hop > 0 || !this.running) return;
    const nextRow = this.rows.find((r) => r.index === this.playerRow + 1);
    if (!nextRow) return;
    const log = nextRow.movers.find(
      (m) => nextRow.kind === 'river' && Math.abs(m.mesh.position.x - this.playerX) < m.width / 2 + 0.35,
    );
    if (nextRow.kind === 'river' && !log) {
      // Splash back — no progress, gentle penalty
      this.playerX = 0;
      this.hop = 0.6;
      this.hopFrom.copy(this.hopper.position);
      this.hopTo.set(0, this.hopper.position.y, this.hopper.position.z + 1.0);
      this.burst(new THREE.Vector3(this.playerX, 0.3, nextRow.z), 0x3aa6c9, 24, 1.2);
      return;
    }
    if (log) {
      this.playerX = log.mesh.position.x;
    }
    this.playerRow++;
    this.maxRow = Math.max(this.maxRow, this.playerRow);
    this.hop = 0.001;
    this.hopFrom.copy(this.hopper.position);
    this.hopTo.set(this.playerX, 0.4, nextRow.z);
    this.addScore(25 + Math.min(40, this.playerRow * 2));
    this.ctx.onProgress?.(Math.min(1, this.maxRow / 40));

    if (this.playerRow > 4) {
      const recycled = this.rows.reduce((min, r) => (r.index < min.index ? r : min), this.rows[0]);
      if (recycled.index < this.playerRow - 7) {
        this.nextIndex = Math.max(...this.rows.map((r) => r.index)) + 1;
        this.placeRow(recycled, this.nextIndex);
      }
      this.camLift += this.rowSpacing;
    }
  }

  protected update(dt: number): void {
    if (!this.hopper) return;
    this.updateBursts(dt);

    if (this.hop > 0) {
      this.hop += dt * 4.4;
      const t = Math.min(1, this.hop);
      const arc = Math.sin(t * Math.PI) * 1.15;
      this.hopper.position.lerpVectors(this.hopFrom, this.hopTo, t);
      this.hopper.position.y += arc;
      this.hopper.rotation.y = Math.sin(t * Math.PI) * 0.4;
      if (t >= 1) {
        this.hop = 0;
        this.hopper.position.copy(this.hopTo);
        this.hopper.rotation.y = 0;
      }
    } else {
      this.hopper.position.y = 0.4 + Math.sin(this.elapsed * 4) * 0.05;
    }

    // Move cars and logs
    for (const row of this.rows) {
      for (const m of row.movers) {
        m.mesh.position.x += m.speed * dt;
        if (m.mesh.position.x > 8.5) m.mesh.position.x = -8.5;
        if (m.mesh.position.x < -8.5) m.mesh.position.x = 8.5;
      }
      // Ride the log on river rows
      if (row.index === this.playerRow && row.kind === 'river' && this.hop === 0) {
        const log = row.movers.find((m) => Math.abs(m.mesh.position.x - this.playerX) < m.width / 2 + 0.3);
        if (log) {
          this.playerX = log.mesh.position.x;
          this.hopper.position.x = this.playerX;
        } else {
          this.playerX = 0;
          this.hopper.position.x = 0;
        }
      }
      // Car collisions on the road
      if (row.index === this.playerRow && row.kind === 'road' && this.hop === 0) {
        for (const m of row.movers) {
          if (Math.abs(m.mesh.position.x - this.hopper.position.x) < m.width / 2 + 0.3) {
            this.playerRow = Math.max(0, this.playerRow - 2);
            this.maxRow = Math.max(this.maxRow, this.playerRow);
            this.playerX = 0;
            const target = this.rows.find((r) => r.index === this.playerRow) ?? this.rows[0];
            this.hopFrom.copy(this.hopper.position);
            this.hopTo.set(0, 0.4, target.z);
            this.hop = 0.001;
            this.shake(this.camera, 0.4);
            this.burst(this.hopper.position.clone(), 0xe2574c, 26, 1.2);
            break;
          }
        }
      }
    }

    // Camera follows the hopper's progress
    const targetZ = this.hopper.position.z + 8.4;
    this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1, dt * 4);
    this.camera.position.x = this.hopper.position.x * 0.2;
    this.camera.position.y = 8.2;
    this.camera.lookAt(this.hopper.position.x * 0.15, 0.4, this.hopper.position.z - 5);
  }

  protected onDispose(): void {
    for (const row of this.rows) this.clearRow(row);
  }
}
