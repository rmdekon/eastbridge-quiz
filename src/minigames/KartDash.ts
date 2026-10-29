import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';

/**
 * Kart Dash — a low-poly time-trial loop. Steer around the ring, hit every
 * boost pad and collect coins on the racing line. No crashing, no contact.
 */
export default class KartDash extends BaseGame {
  private kart!: THREE.Group;
  private angle = 0;
  private radius = 18;
  private offset = 0;
  private speed = 0.42;
  private pads: Array<{ mesh: THREE.Mesh; angle: number; offset: number; taken: boolean }> = [];
  private checkpoints = new Set<number>();
  private lap = 0;
  private boost = 0;
  private wheelSpin = 0;

  constructor() {
    super(manifestById('kart-dash'));
  }

  protected bgColor() {
    return 0x9fd6e8;
  }

  protected build(): void {
    this.camera.position.set(0, 9, 26);
    this.camera.lookAt(0, 0, 0);

    // Ground
    const ground = new THREE.Mesh(new THREE.CircleGeometry(34, 40), this.mat(0x7fae72));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    this.scene.add(ground);

    // Track ring
    const track = new THREE.Mesh(new THREE.RingGeometry(this.radius - 3.4, this.radius + 3.4, 64), this.mat(0x4a4f63));
    track.rotation.x = -Math.PI / 2;
    this.scene.add(track);
    const inner = new THREE.Mesh(new THREE.RingGeometry(this.radius - 3.55, this.radius - 3.4, 64), this.glowMat(0xffffff, 0.8));
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.01;
    this.scene.add(inner);
    const outer = inner.clone();
    outer.geometry = new THREE.RingGeometry(this.radius + 3.4, this.radius + 3.55, 64);
    this.scene.add(outer);

    // Start line
    for (let i = 0; i < 8; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 6.8), this.glowMat(i % 2 ? 0xffffff : 0x1b3a6b));
      stripe.position.set(-0.4 + i * 0.5, 0.03, this.radius);
      stripe.rotation.y = 0;
      this.scene.add(stripe);
    }

    // Scenery
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = this.radius + 9 + Math.random() * 4;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 6), this.mat(0x8a5a34));
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 7), this.mat(0x4f8a4f));
      crown.position.y = 2.4;
      tree.add(crown);
      tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      this.scene.add(tree);
    }

    // Boost pads
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const offset = (i % 3) - 1;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 3.2), this.glowMat(0xffd166, 0.95));
      const r = this.radius + offset * 1.9;
      pad.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      pad.rotation.y = -a;
      this.scene.add(pad);
      this.pads.push({ mesh: pad, angle: a, offset, taken: false });
    }

    // Kart
    this.kart = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 2.4), this.mat(0xe2574c, { emissive: 0x3a0f0c }));
    chassis.position.y = 0.45;
    this.kart.add(chassis);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), this.mat(0xfdfbf6));
    cockpit.position.set(0, 0.85, -0.2);
    cockpit.scale.set(1, 0.8, 1.2);
    this.kart.add(cockpit);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.3), this.mat(0x1b3a6b));
    spoiler.position.set(0, 1, -1.15);
    this.kart.add(spoiler);
    for (const [x, z] of [
      [-0.8, 0.8],
      [0.8, 0.8],
      [-0.8, -0.85],
      [0.8, -0.85],
    ] as Array<[number, number]>) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10), this.mat(0x24242e));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.3, z);
      wheel.name = 'wheel';
      this.kart.add(wheel);
    }
    // Driver flag
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), this.glowMat(0xc8973a));
    flag.position.set(0.5, 1.35, -0.9);
    this.kart.add(flag);
    this.scene.add(this.kart);
    this.placeKart();

    // Skid marks (static decals for atmosphere)
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = this.radius + (Math.random() - 0.5) * 5;
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 1.2), this.glowMat(0x33384a, 0.5));
      mark.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
      mark.rotation.y = -a;
      this.scene.add(mark);
    }
  }

  private placeKart(): void {
    const x = Math.cos(this.angle) * (this.radius + this.offset);
    const z = Math.sin(this.angle) * (this.radius + this.offset);
    this.kart.position.set(x, 0, z);
    this.kart.rotation.y = -this.angle - Math.PI / 2;
    // bank into the turn
    this.kart.rotation.z = -this.offset * 0.04;
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
    if (!this.pointerDown) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, 0);
  }

  protected handlePointerDown(e: PointerEvent): void {
    this.pointerDown = true;
    this.handlePointerMove(e);
  }

  protected handlePointerUp(): void {
    this.pointerDown = false;
    this.pointer.set(0, 0);
  }

  protected update(dt: number): void {
    if (!this.kart) return;
    this.updateBursts(dt);

    let steer = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) steer -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) steer += 1;
    if (steer === 0 && this.pointerDown) steer = THREE.MathUtils.clamp(this.pointer.x * 1.6, -1, 1);

    this.offset = THREE.MathUtils.clamp(this.offset + steer * dt * 7, -2.6, 2.6);
    if (steer === 0) this.offset *= 1 - dt * 0.8;

    this.boost = Math.max(0, this.boost - dt);
    const speed = this.speed * (this.boost > 0 ? 1.75 : 1);
    this.angle += speed * dt;
    this.wheelSpin += dt * speed * 26;

    this.placeKart();
    this.kart.position.y = Math.abs(Math.sin(this.elapsed * 18)) * 0.04;

    for (const w of this.kart.children) {
      if (w.name === 'wheel') w.rotation.x = this.wheelSpin;
    }

    // Boost pads
    for (const pad of this.pads) {
      if (pad.taken) continue;
      const angleDiff = Math.atan2(Math.sin(pad.angle - this.angle), Math.cos(pad.angle - this.angle));
      if (Math.abs(angleDiff) < 0.09 && Math.abs(this.offset - pad.offset * 1.9) < 1.7) {
        pad.taken = true;
        pad.mesh.material = this.mat(0x57e0d2, { emissive: 0x1a6f8a });
        this.boost = 1.6;
        this.addScore(90);
        this.burst(pad.mesh.position.clone().setY(0.6), 0xffd166, 22, 1);
      }
    }

    // Checkpoints every 30 degrees
    const cp = Math.floor(((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 6));
    if (!this.checkpoints.has(cp)) {
      this.checkpoints.add(cp);
      this.addScore(this.boost > 0 ? 60 : 45);
      if (cp === 0 && this.angle > Math.PI * 2) {
        this.lap++;
        this.checkpoints.clear();
        this.pads.forEach((p) => {
          p.taken = false;
          p.mesh.material = this.glowMat(0xffd166, 0.95);
        });
        this.addScore(220);
      }
      this.burst(new THREE.Vector3(this.kart.position.x, 0.5, this.kart.position.z), 0x57e0d2, 12, 0.6);
      this.ctx.onProgress?.(Math.min(1, (cp + this.lap * 12) / 24));
    }

    // Chase camera
    const behind = new THREE.Vector3(
      Math.cos(this.angle - 0.16) * (this.radius + this.offset),
      5.4,
      Math.sin(this.angle - 0.16) * (this.radius + this.offset),
    );
    this.camera.position.lerp(behind, Math.min(1, dt * 5));
    this.camera.lookAt(
      Math.cos(this.angle + 0.2) * (this.radius + this.offset * 0.5),
      0.9,
      Math.sin(this.angle + 0.2) * (this.radius + this.offset * 0.5),
    );
    if (this.boost > 0) {
      this.camera.position.y += Math.sin(this.elapsed * 30) * 0.05;
    }
  }
}
