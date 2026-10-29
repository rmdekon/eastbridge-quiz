import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';
import { buildCoin, buildEagle, laneX } from './shared';

interface Runner {
  mesh: THREE.Object3D;
  kind: 'coin' | 'block' | 'gate';
  active: boolean;
  z: number;
  lane: number;
}

/**
 * Eagle Run — three-lane endless dash. Jump the blocks, grab the coins,
 * bank a combo for extra sparkle. All geometry is pooled and recycled.
 */
export default class EagleRun extends BaseGame {
  private player!: THREE.Group;
  private items: Runner[] = [];
  private lane = 1;
  private jumpV = 0;
  private airborne = false;
  private speed = 13;
  private spin = 0;
  private stumble = 0;
  private distance = 0;
  private spawnZ = -70;
  private nextSpawn = 0;
  private trackTiles: THREE.Mesh[] = [];

  constructor() {
    super(manifestById('eagle-run'));
  }

  protected bgColor() {
    return 0x121f33;
  }

  protected build(): void {
    this.camera.position.set(0, 5.2, 8.5);
    this.camera.lookAt(0, 0.8, -8);

    // Track
    const track = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.4, 160), this.mat(0x22334f));
    track.position.set(0, -0.2, -60);
    this.scene.add(track);

    for (let i = 0; i < 3; i++) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 160), this.glowMat(0x4fa3b2, 0.35));
      lane.position.set(laneX(i) * 1.17, 0.02, -60);
      this.scene.add(lane);
    }

    // Moving track stripes for a sense of speed
    for (let i = 0; i < 24; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.02, 0.5), this.glowMat(0x33507c, 0.55));
      stripe.position.set(0, 0.03, -i * 4);
      this.scene.add(stripe);
      this.trackTiles.push(stripe);
    }

    // Side scenery (palms / lamp posts made of primitives)
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 6), this.mat(0x2f4468));
      post.position.set(side * (5.4 + Math.random() * 1.8), 1.7, -i * 8 - 4);
      this.scene.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), this.glowMat(0xffd166));
      lamp.position.copy(post.position).setY(3.5);
      this.scene.add(lamp);
    }

    const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), this.glowMat(0xffb86b, 1));
    sun.position.set(-16, 12, -70);
    this.scene.add(sun);

    this.player = buildEagle(1, 0xfdfbf6, 0xC8973A);
    this.player.position.set(0, 0.9, 0);
    this.player.rotation.y = Math.PI;
    this.scene.add(this.player);

    for (let i = 0; i < 16; i++) this.items.push(this.makeItem());
  }

  private makeItem(): Runner {
    const isCoin = Math.random() < 0.62;
    let mesh: THREE.Object3D;
    if (isCoin) {
      mesh = buildCoin(0.26);
      mesh.rotation.y = 0;
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.2), this.mat(0xE2574C, { emissive: 0x3a0f0c }));
      mesh.position.y = 0.65;
      const warn = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.14, 1.26), this.glowMat(0xffd166));
      warn.position.y = 0.45;
      mesh.add(warn);
    }
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, kind: isCoin ? 'coin' : 'block', active: false, z: 0, lane: 1 };
  }

  private spawn(): void {
    const item = this.items.find((i) => !i.active);
    if (!item) return;
    const lane = Math.floor(Math.random() * 3);
    // Never block all three lanes in one row.
    const blocking = this.items.filter(
      (i) => i.active && i.kind !== 'coin' && Math.abs(i.z - this.spawnZ) < 2.4,
    );
    const kind: Runner['kind'] = blocking.length >= 1 || Math.random() < 0.62 ? 'coin' : 'block';
    item.kind = kind;
    item.lane = lane;
    item.z = this.spawnZ;
    item.active = true;
    item.mesh.visible = true;
    item.mesh.position.set(laneX(lane), kind === 'coin' ? 0.9 : 0.65, this.spawnZ);
    const isCoin = kind === 'coin';
    item.mesh.scale.setScalar(isCoin ? 1 : 1);
    item.mesh.rotation.set(0, 0, 0);
    if (isCoin) item.mesh.rotation.y = Math.PI / 2;
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    if (!down) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') {
      e.preventDefault();
      this.lane = Math.max(0, this.lane - 1);
    } else if (k === 'arrowright' || k === 'd') {
      e.preventDefault();
      this.lane = Math.min(2, this.lane + 1);
    } else if (k === 'arrowup' || k === 'w' || k === ' ') {
      e.preventDefault();
      this.jump();
    }
  }

  protected handlePointerDown(e: PointerEvent): void {
    this.swipe = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, t0: performance.now() };
  }

  protected handlePointerUp(e: PointerEvent): void {
    if (!this.swipe) {
      this.jump();
      return;
    }
    const dx = e.clientX - this.swipe.x0;
    const dy = e.clientY - this.swipe.y0;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) this.lane = Math.min(2, this.lane + 1);
      else this.lane = Math.max(0, this.lane - 1);
    } else if (dy < -30 || Math.abs(dx) < 24) {
      this.jump();
    }
    this.swipe = null;
  }

  private jump(): void {
    if (this.airborne || this.stumble > 0.2) return;
    this.airborne = true;
    this.jumpV = 7.4;
  }

  protected update(dt: number): void {
    if (!this.player) return;
    this.updateBursts(dt);
    this.stumble = Math.max(0, this.stumble - dt);
    this.speed = (12.5 + this.difficulty() * 2.2) * (this.stumble > 0 ? 0.45 : 1);
    this.distance += this.speed * dt;
    this.ctx.onProgress?.(Math.min(1, this.distance / 420));

    // Player physics
    const targetX = laneX(this.lane);
    this.player.position.x += (targetX - this.player.position.x) * Math.min(1, dt * 14);
    this.player.position.z = 0;
    if (this.airborne) {
      this.jumpV -= 24 * dt;
      this.player.position.y += this.jumpV * dt;
      this.spin += dt * 8;
      this.player.rotation.x = -this.spin * 0.4;
      if (this.player.position.y <= 0.9) {
        this.player.position.y = 0.9;
        this.airborne = false;
        this.jumpV = 0;
        this.spin = 0;
        this.player.rotation.x = 0;
      }
    } else {
      this.player.position.y = 0.9 + Math.sin(this.elapsed * 8) * 0.06;
    }
    this.player.rotation.z = (targetX - this.player.position.x) * -0.18;

    // Track stripes
    for (const s of this.trackTiles) {
      s.position.z += this.speed * dt;
      if (s.position.z > 8) s.position.z -= 96;
    }

    // Items
    this.nextSpawn -= this.speed * dt;
    if (this.nextSpawn <= 0) {
      this.nextSpawn = 7 + Math.random() * 5;
      this.spawn();
    }

    for (const item of this.items) {
      if (!item.active) continue;
      item.z += this.speed * dt;
      item.mesh.position.z = item.z;
      if (item.kind === 'coin') {
        item.mesh.rotation.z += dt * 3;
        item.mesh.position.y = 0.9 + Math.sin(this.elapsed * 4 + item.lane) * 0.12;
      }
      if (Math.abs(item.z - this.player.position.z) < 1.1 && item.lane === this.lane) {
        if (item.kind === 'coin' && !this.airborne) {
          item.active = false;
          item.mesh.visible = false;
          this.addScore(45);
          this.burst(item.mesh.position.clone(), 0xffd166, 14, 0.7);
        } else if (item.kind === 'block' && this.player.position.y < 1.55) {
          item.active = false;
          item.mesh.visible = false;
          this.stumble = 0.9;
          this.burst(item.mesh.position.clone(), 0xe2574c, 26, 1.3);
          this.player.rotation.z = 0.5;
        }
      }
      if (item.z > 12) {
        item.active = false;
        item.mesh.visible = false;
      }
    }

    // Camera
    this.camera.position.x = this.player.position.x * 0.35;
    this.camera.position.y = 5.1 + Math.sin(this.elapsed * 1.4) * 0.12 + (this.airborne ? 0.4 : 0);
    this.camera.lookAt(this.player.position.x * 0.2, 1.1, -8);
    if (this.stumble > 0.6) this.shake(this.camera, 0.12);
  }
}
