import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';
import { buildEagle } from './shared';

interface Bot {
  mesh: THREE.Group;
  speed: number;
  wobble: number;
}

interface PowerUp {
  mesh: THREE.Mesh;
  taken: boolean;
}

/**
 * Blaster Arena — low-poly foam-blaster target practice.
 * Bots pop into confetti (never anything graphic). Touch and mouse both aim.
 */
export default class BlasterArena extends BaseGame {
  private player!: THREE.Group;
  private bots: Bot[] = [];
  private powerUps: PowerUp[] = [];
  private raycaster = new THREE.Raycaster();
  private cooldown = 0;
  private spawnTimer = 0;
  private rapidFire = 0;
  private reticle!: THREE.Mesh;
  private pointerNdc = new THREE.Vector2(0, 0);
  private arenaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
  private aimPoint = new THREE.Vector3(0, 0.9, -4);
  private playerX = 0;

  constructor() {
    super(manifestById('blaster-arena'));
  }

  protected bgColor() {
    return 0x130f1f;
  }

  protected build(): void {
    this.camera.position.set(0, 6.5, 13);
    this.camera.lookAt(0, 1.2, -2);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.4, 40), this.mat(0x1d1a2e));
    floor.position.z = -8;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(40, 20, 0xe2574c, 0x3b3057);
    grid.position.set(0, 0.21, -8);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    this.scene.add(grid);

    // Neon arena walls
    for (const [x, z, w, d] of [
      [-12, -8, 0.5, 40],
      [12, -8, 0.5, 40],
      [0, -27, 24, 0.5],
    ] as Array<[number, number, number, number]>) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, d), this.mat(0x241f38, { emissive: 0x120d20 }));
      wall.position.set(x, 1.7, z);
      this.scene.add(wall);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.12, d + 0.05), this.glowMat(0xe2574c));
      strip.position.set(x, 3.35, z);
      this.scene.add(strip);
    }

    // Player
    this.player = buildEagle(1.05, 0xfdfbf6, 0xE2574C);
    this.player.position.set(0, 0.7, 8);
    this.player.rotation.y = Math.PI;
    this.scene.add(this.player);

    // Foam blaster
    const blaster = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 8), this.mat(0x4fa3b2, { emissive: 0x14404a }));
    barrel.rotation.x = Math.PI / 2;
    blaster.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.2), this.mat(0x2a2a3a));
    grip.position.set(0, -0.28, 0.25);
    blaster.add(grip);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), this.mat(0xffd166, { emissive: 0x6b4a00 }));
    tip.position.z = -0.6;
    blaster.add(tip);
    blaster.position.set(0.45, 0.15, 0.55);
    this.player.add(blaster);

    // Aim reticle
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.32, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
    );
    this.reticle.rotation.x = -Math.PI / 2;
    this.scene.add(this.reticle);

    // Backdrop blocks
    for (let i = 0; i < 14; i++) {
      const h = 1 + Math.random() * 5;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, h, 1.2),
        this.mat(i % 2 ? 0x2b2440 : 0x332b4d),
      );
      block.position.set((Math.random() - 0.5) * 22, h / 2, -24 - Math.random() * 4);
      this.scene.add(block);
    }

    this.spawnPowerUp();
    for (let i = 0; i < 3; i++) this.spawnBot(true);
  }

  private spawnBot(initial = false): void {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 0),
      this.mat(initial ? 0x6f5bd6 : 0x8f7bf0, { emissive: 0x241a4d }),
    );
    group.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), this.glowMat(0xffffff));
    eye.position.set(0, 0.1, 0.5);
    group.add(eye);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), this.glowMat(0x9fef9a));
    antenna.position.set(0, 0.7, 0);
    group.add(antenna);
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), this.glowMat(0x9fef9a));
    bubble.position.set(0, 0.98, 0);
    group.add(bubble);

    group.position.set((Math.random() - 0.5) * 20, 1, initial ? -6 - Math.random() * 14 : -24);
    this.scene.add(group);
    this.bots.push({
      mesh: group,
      speed: 1.1 + this.difficulty() * 0.55 + Math.random() * 0.6,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  private spawnPowerUp(): void {
    if (this.quality === 'low' && this.powerUps.length > 0) return;
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      this.mat(0xffd166, { emissive: 0x8a5f13 }),
    );
    mesh.position.set((Math.random() - 0.5) * 16, 1.3, -6 - Math.random() * 10);
    this.scene.add(mesh);
    this.powerUps.push({ mesh, taken: false });
  }

  protected handlePointerMove(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.pointer.set(e.clientX, e.clientY);
  }

  protected handlePointerDown(e: PointerEvent): void {
    this.handlePointerMove(e);
    this.shoot();
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key.toLowerCase();
    if (['a', 'd', 'arrowleft', 'arrowright', ' '].includes(k)) {
      e.preventDefault();
      if (k === ' ') {
        if (down && !this.keys.has(' ')) this.shoot();
        this.keys.add(' ');
      } else if (down) this.keys.add(k);
      else this.keys.delete(k);
    }
  }

  private shoot(): void {
    if (!this.running || this.cooldown > 0) return;
    this.cooldown = this.rapidFire > 0 ? 0.09 : 0.22;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    // Muzzle flash
    const tip = this.player.position.clone().add(new THREE.Vector3(0.4, 0.9, 0.4));
    this.burst(tip, 0x9fe8ff, 8, 0.35);

    for (let i = this.bots.length - 1; i >= 0; i--) {
      const hit = this.raycaster.intersectObject(this.bots[i].mesh, true);
      if (hit.length) {
        const bot = this.bots[i];
        this.burst(bot.mesh.position.clone(), i % 2 ? 0xffd166 : 0x9fef9a, 46, 1.8);
        this.scene.remove(bot.mesh);
        this.bots.splice(i, 1);
        this.addScore(100);
        this.spawnBot();
        return;
      }
    }
    for (const p of this.powerUps) {
      if (p.taken) continue;
      if (this.raycaster.intersectObject(p.mesh, true).length) {
        p.taken = true;
        this.scene.remove(p.mesh);
        this.rapidFire = 5;
        this.addScore(80);
        this.burst(p.mesh.position.clone(), 0xffd166, 40, 1.4);
        return;
      }
    }
  }

  protected update(dt: number): void {
    if (!this.player) return;
    this.updateBursts(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.rapidFire = Math.max(0, this.rapidFire - dt);

    // Move left/right
    let move = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) move -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) move += 1;
    this.playerX = THREE.MathUtils.clamp(this.playerX + move * dt * 9, -9, 9);
    this.player.position.x += (this.playerX - this.player.position.x) * Math.min(1, dt * 12);
    this.player.position.y = 0.7 + Math.sin(this.elapsed * 6) * 0.04;
    this.player.rotation.z = -move * 0.12;

    // Reticle follows aim point
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.arenaPlane, hit)) {
      this.aimPoint.copy(hit);
    }
    this.reticle.position.copy(this.aimPoint).setY(0.95);
    this.reticle.rotation.z += dt * 2;
    this.player.rotation.y = Math.PI + THREE.MathUtils.clamp((this.aimPoint.x - this.player.position.x) * -0.04, -0.5, 0.5);

    // Bots advance
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i];
      bot.mesh.position.z += bot.speed * dt;
      bot.wobble += dt * 3;
      bot.mesh.position.x += Math.sin(bot.wobble) * dt * 1.4;
      bot.mesh.position.x = THREE.MathUtils.clamp(bot.mesh.position.x, -10, 10);
      bot.mesh.position.y = 1 + Math.abs(Math.sin(bot.wobble * 0.7)) * 0.25;
      bot.mesh.rotation.y += dt * 1.2;
      if (bot.mesh.position.z > 9.5) {
        this.scene.remove(bot.mesh);
        this.bots.splice(i, 1);
        this.spawnBot();
      }
    }

    // Spawn pacing
    this.spawnTimer += dt;
    const target = 4 + this.difficulty();
    if (this.spawnTimer > 1.4 && this.bots.length < target) {
      this.spawnTimer = 0;
      this.spawnBot();
    }
    if (this.powerUps.filter((p) => !p.taken).length < 2 && Math.random() < dt * 0.25) this.spawnPowerUp();
    for (const p of this.powerUps) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 1.3 + Math.sin(this.elapsed * 2 + p.mesh.position.x) * 0.18;
    }

    // Camera sway + subtle shake for juiciness
    this.camera.position.x = this.player.position.x * 0.25;
    this.camera.position.y = 6.4 + Math.sin(this.elapsed * 0.7) * 0.1;
    this.camera.lookAt(this.player.position.x * 0.2, 1.4, -3);
    if (this.rapidFire > 0) {
      this.camera.position.z = 13 + Math.sin(this.elapsed * 40) * 0.05;
    }

    this.ctx.onProgress?.(this.rapidFire > 0 ? 1 : 0.6);
  }
}
