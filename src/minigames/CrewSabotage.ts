import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';
import { buildEagle } from './shared';

interface Station {
  group: THREE.Group;
  pos: THREE.Vector3;
  done: boolean;
  progress: number;
  ring: THREE.Mesh;
  core: THREE.Mesh;
  label: string;
}

/**
 * Crew Sabotage — guide the eagle engineer around a low-poly ship deck,
 * holding to repair three stations while a glitch-bot patrols the corridors.
 */
export default class CrewSabotage extends BaseGame {
  private player!: THREE.Group;
  private bot!: THREE.Group;
  private stations: Station[] = [];
  private target = new THREE.Vector3(0, 0, 3);
  private velocity = new THREE.Vector3();
  private botAngle = 0;
  private hitCooldown = 0;
  private flash = 0;
  private deck!: THREE.Mesh;
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private raycaster = new THREE.Raycaster();
  private nudge = new THREE.Vector3();

  constructor() {
    super(manifestById('crew-sabotage'));
  }

  protected bgColor() {
    return 0x0a1024;
  }

  protected build(): void {
    this.camera.position.set(0, 14, 11);
    this.camera.lookAt(0, 0, 0);

    // Deck
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.6, 16),
      this.mat(0x1b2a4a),
    );
    deck.position.y = -0.3;
    this.scene.add(deck);
    this.deck = deck;

    const grid = new THREE.GridHelper(22, 22, 0x2a7f8f, 0x1c3a5e);
    grid.position.y = 0.02;
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    // Hull walls (low, so the camera sees everything)
    const wallMat = this.mat(0x14233d);
    const walls: Array<{ size: [number, number, number]; pos: [number, number, number] }> = [
      { size: [22, 2.4, 0.6], pos: [0, 1.2, -8] },
      { size: [22, 2.4, 0.6], pos: [0, 1.2, 8] },
      { size: [0.6, 2.4, 16], pos: [-11, 1.2, 0] },
      { size: [0.6, 2.4, 16], pos: [11, 1.2, 0] },
    ];
    for (const w of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
      wall.position.set(...w.pos);
      this.scene.add(wall);
    }

    // Starfield backdrop
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 120;
      starPos[i * 3 + 1] = Math.random() * 40 + 6;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 0.35 })));

    // Stations
    const specs: Array<{ pos: [number, number, number]; color: number; label: string }> = [
      { pos: [-7.5, 0, -5], color: 0x4FA3B2, label: 'Wires' },
      { pos: [7.5, 0, -5], color: 0xE0B45C, label: 'Scan card' },
      { pos: [0, 0, 6], color: 0xB7CDB3, label: 'Refuel' },
    ];
    for (const spec of specs) {
      const group = new THREE.Group();
      group.position.set(...spec.pos);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.4, 8), this.mat(0x24365a));
      base.position.y = 0.2;
      group.add(base);
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), this.mat(spec.color, { emissive: spec.color }));
      core.position.y = 1.05;
      group.add(core);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.4, 1.75, 32),
        new THREE.MeshBasicMaterial({ color: spec.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      group.add(ring);
      this.scene.add(group);
      this.stations.push({
        group,
        pos: new THREE.Vector3(...spec.pos),
        done: false,
        progress: 0,
        ring,
        core,
        label: spec.label,
      });
    }

    // Player eagle
    this.player = buildEagle(0.95, 0xfdfbf6, 0xC8973A);
    this.player.position.set(0, 0.55, 3);
    this.scene.add(this.player);

    // Glitch bot
    this.bot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), this.mat(0xE2574C, { emissive: 0x44110f }));
    this.bot.add(body);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.2), this.glowMat(0xffd166));
    visor.position.set(0, 0.12, 0.5);
    this.bot.add(visor);
    const eyeGlow = new THREE.PointLight(0xff6b6b, 0.8, 5);
    this.bot.add(eyeGlow);
    this.bot.position.set(0, 0.7, -6);
    this.scene.add(this.bot);

    // Ambient ship lights
    for (const [x, z, c] of [
      [-8, -7, 0x4fa3b2],
      [8, -7, 0xe0b45c],
      [0, 7, 0x9fef9a],
    ] as Array<[number, number, number]>) {
      const light = new THREE.PointLight(c, 0.9, 14);
      light.position.set(x, 3, z);
      this.scene.add(light);
    }

  }

  protected handlePointerDown(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.floorPlane, hit)) {
      if (Math.abs(hit.x) < 10 && Math.abs(hit.z) < 7.5) {
        this.target.set(hit.x, 0, hit.z);
      }
    }
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      e.preventDefault();
      if (down) this.keys.add(key);
      else this.keys.delete(key);
    }
  }

  protected update(dt: number): void {
    if (!this.player) return;
    this.updateBursts(dt);

    // ---- movement input
    const dir = new THREE.Vector3();
    if (this.keys.has('w') || this.keys.has('arrowup')) dir.z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dir.z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dir.x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dir.x += 1;

    const pos = this.player.position;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.velocity.lerp(dir.multiplyScalar(6.4), 0.35);
      this.target.copy(pos);
    } else {
      const toTarget = new THREE.Vector3(this.target.x, 0, this.target.z).sub(new THREE.Vector3(pos.x, 0, pos.z));
      if (toTarget.length() > 0.25) {
        toTarget.normalize();
        this.velocity.lerp(toTarget.multiplyScalar(5.6), 0.16);
      } else {
        this.velocity.multiplyScalar(0.8);
      }
    }
    this.velocity.add(this.nudge);
    this.nudge.multiplyScalar(0.86);

    pos.x = THREE.MathUtils.clamp(pos.x + this.velocity.x * dt, -10, 10);
    pos.z = THREE.MathUtils.clamp(pos.z + this.velocity.z * dt, -7, 7);
    pos.y = 0.55 + Math.sin(this.elapsed * 9) * 0.05;
    this.player.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
    this.player.rotation.z = -this.velocity.x * 0.04;

    // ---- bot patrol
    const speed = 0.55 + this.difficulty() * 0.14;
    this.botAngle += dt * speed;
    const radiusX = 6.4;
    const radiusZ = 4.4;
    this.bot.position.x = Math.sin(this.botAngle) * radiusX;
    this.bot.position.z = Math.cos(this.botAngle * 1.15) * radiusZ;
    this.bot.rotation.y += dt * 1.5;
    this.bot.position.y = 0.85 + Math.sin(this.elapsed * 3) * 0.2;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.flash = Math.max(0, this.flash - dt * 2);

    const botDist = this.bot.position.distanceTo(this.player.position);
    if (botDist < 1.5 && this.hitCooldown <= 0) {
      this.hitCooldown = 1.4;
      this.flash = 1;
      const away = this.player.position.clone().sub(this.bot.position).setY(0).normalize();
      this.nudge.copy(away.multiplyScalar(13));
      this.target.copy(this.player.position);
      this.timeScale = 0.55;
      setTimeout(() => (this.timeScale = 1), 260);
      (this.scene.background as THREE.Color).setHex(0x3a1020);
      setTimeout(() => {
        if (!this.disposed) (this.scene.background as THREE.Color).setHex(this.bgColor());
      }, 220);
    }

    // ---- stations
    for (const s of this.stations) {
      if (s.done) continue;
      const near = s.pos.distanceTo(new THREE.Vector3(pos.x, 0, pos.z)) < 1.9;
      if (near && this.hitCooldown <= 0) {
        s.progress = Math.min(1, s.progress + dt / 1.4);
        s.core.rotation.y += dt * 4;
        if (s.progress >= 1) {
          s.done = true;
          s.core.material = this.mat(0x9fef9a, { emissive: 0x2f7d32 });
          s.ring.material = new THREE.MeshBasicMaterial({ color: 0x9fef9a, side: THREE.DoubleSide });
          this.addScore(260);
          this.burst(s.pos.clone().setY(1.2), 0x9fef9a, 50, 1.6);
          if (this.stations.every((x) => x.done)) {
            this.addScore(420);
            this.ctx.onProgress?.(1);
            setTimeout(() => this.finishGame(), 500);
          }
        }
      } else {
        s.progress = Math.max(0, s.progress - dt * 0.06);
      }
      const scale = 1 + s.progress * 0.12;
      s.group.scale.setScalar(scale);
      (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + s.progress * 0.6;
      s.core.position.y = 1.05 + Math.sin(this.elapsed * 2 + s.pos.x) * 0.08;
    }

    // ---- camera follow
    this.camera.position.lerp(new THREE.Vector3(pos.x * 0.32, 13.5, pos.z + 10.5), 0.06);
    this.camera.lookAt(pos.x * 0.3, 0.6, pos.z - 0.5);
    if (this.flash > 0 && !this.reduced) {
      this.camera.position.x += (Math.random() - 0.5) * this.flash * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.flash * 0.5;
    }

    const done = this.stations.filter((s) => s.done).length;
    this.ctx.onProgress?.(done / 3);
  }
}
