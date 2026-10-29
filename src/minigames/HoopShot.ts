import * as THREE from 'three';
import { BaseGame } from '../arcade/BaseGame';
import { manifestById } from './manifests';

/**
 * Hoop Shot — swipe-to-shoot basketball. Drag up to set power and angle,
 * release to launch. Simple gravity arc, satisfying swish.
 */
export default class HoopShot extends BaseGame {
  private ball!: THREE.Mesh;
  private hoop!: THREE.Group;
  private vel = new THREE.Vector3();
  private flying = false;
  private scored = false;
  private power = 0;
  private aimX = 0;
  private powerRing!: THREE.Mesh;
  private trailTimer = 0;
  private shotStart = new THREE.Vector3(0, 1.4, 5);
  private hoopPos = new THREE.Vector3(0, 2.6, -3.2);
  private streak = 0;
  private respawnIn = 0;

  constructor() {
    super(manifestById('hoop-shot'));
  }

  protected bgColor() {
    return 0x12243b;
  }

  protected build(): void {
    this.camera.position.set(0, 4.2, 11);
    this.camera.lookAt(0, 2.6, -2);

    // Court floor
    const court = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 30), this.mat(0xb5844a));
    court.position.set(0, -0.2, 0);
    this.scene.add(court);
    for (let i = 0; i < 8; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(24, 0.02, 0.12), this.glowMat(0xf7f1e3, 0.5));
      line.position.set(0, 0.01, -12 + i * 4);
      this.scene.add(line);
    }
    const arc = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.55, 40, 1, 0, Math.PI), this.glowMat(0xf7f1e3, 0.7));
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(0, 0.02, -3.2);
    this.scene.add(arc);

    // Hoop
    this.hoop = new THREE.Group();
    const backboard = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.8, 0.18), this.mat(0xf7f1e3, { emissive: 0x2a2a2a }));
    backboard.position.set(0, 1.6, -0.45);
    this.hoop.add(backboard);
    const target = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.04), this.glowMat(0xe2574c, 0.9));
    target.position.set(0, 1.5, -0.34);
    this.hoop.add(target);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 8, 28), this.mat(0xe2574c, { emissive: 0x3a0f0c }));
    rim.rotation.x = Math.PI / 2;
    this.hoop.add(rim);
    const netMat = this.glowMat(0xf7f1e3, 0.55);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 4), netMat);
      strand.position.set(Math.cos(a) * 0.95, -0.42, Math.sin(a) * 0.95);
      strand.rotation.x = Math.cos(a) * 0.22;
      strand.rotation.z = Math.sin(a) * 0.22;
      this.hoop.add(strand);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6, 8), this.mat(0x2a3550));
    pole.position.set(0, -1.4, -0.6);
    this.hoop.add(pole);
    this.hoop.position.copy(this.hoopPos);
    this.scene.add(this.hoop);

    // Ball
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 20, 16),
      this.mat(0xe08a2e, { emissive: 0x4a2606 }),
    );
    this.resetBall();
    this.scene.add(this.ball);

    // Power ring under the ball
    this.powerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.92, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    this.powerRing.rotation.x = -Math.PI / 2;
    this.powerRing.position.set(0, 0.03, 5);
    this.scene.add(this.powerRing);
  }

  private resetBall(): void {
    this.ball.position.copy(this.shotStart);
    this.ball.scale.setScalar(1);
    this.vel.set(0, 0, 0);
    this.flying = false;
    this.scored = false;
    this.power = 0;
    this.aimX = 0;
  }

  protected handlePointerDown(e: PointerEvent): void {
    if (this.flying) return;
    this.swipe = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, t0: performance.now() };
  }

  protected handlePointerMove(e: PointerEvent): void {
    if (!this.swipe || this.flying) return;
    this.swipe.x1 = e.clientX;
    this.swipe.y1 = e.clientY;
    const dy = this.swipe.y0 - e.clientY;
    const dx = e.clientX - this.swipe.x0;
    this.power = THREE.MathUtils.clamp(dy / 220, 0, 1);
    this.aimX = THREE.MathUtils.clamp(dx / 160, -1, 1);
  }

  protected handlePointerUp(): void {
    if (!this.swipe || this.flying) return;
    if (this.power > 0.08) this.launch();
    else this.resetBall();
    this.swipe = null;
  }

  protected handleKey(e: KeyboardEvent, down: boolean): void {
    if (!down) return;
    if (e.key === ' ') {
      e.preventDefault();
      this.power = (this.power + 0.22) % 1.05;
      this.aimX = Math.sin(this.elapsed * 3) * 0.4;
    }
    if (e.key === 'Enter' && !this.flying) this.launch();
  }

  private launch(): void {
    const dist = this.hoopPos.z - this.shotStart.z;
    const vz = -(11 + this.power * 9);
    const timeToHoop = Math.abs(dist / vz);
    const dy = this.hoopPos.y - this.shotStart.y;
    const vy = dy / timeToHoop + 0.5 * 15.5 * timeToHoop;
    this.vel.set(this.aimX * 5.2, vy, vz);
    this.flying = true;
    this.trailTimer = 0;
    this.ctx.onProgress?.(this.power);
  }

  protected update(dt: number): void {
    if (!this.ball) return;
    this.updateBursts(dt);

    if (!this.flying) {
      this.ball.position.y = this.shotStart.y + Math.sin(this.elapsed * 4) * 0.08;
      this.ball.rotation.y += dt;
      this.powerRing.position.set(this.ball.position.x, 0.03, this.ball.position.z);
      const scale = 0.6 + this.power * 0.9;
      this.powerRing.scale.setScalar(scale);
      (this.powerRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + this.power * 0.6;
      this.powerRing.visible = this.power > 0.02;
      if (this.respawnIn > 0) {
        this.respawnIn -= dt;
        if (this.respawnIn <= 0) this.resetBall();
      }
      return;
    }

    // Physics
    this.vel.y -= 15.5 * dt;
    this.ball.position.addScaledVector(this.vel, dt);
    this.ball.rotation.x -= this.vel.z * dt * 0.6;
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.05;
      this.burst(this.ball.position.clone(), 0xffd166, 3, 0.12);
    }

    // Rim collision (simple sphere vs torus ring plane)
    const nearRim =
      Math.abs(this.ball.position.y - (this.hoopPos.y - 0.1)) < 0.42 &&
      Math.hypot(this.ball.position.x - this.hoopPos.x, this.ball.position.z - this.hoopPos.z) < 1.05;

    if (!this.scored && nearRim && this.vel.y < 0) {
      this.scored = true;
      this.streak++;
      const perfect = Math.hypot(this.ball.position.x - this.hoopPos.x, this.ball.position.z - this.hoopPos.z) < 0.45;
      this.addScore(perfect ? 320 : 220);
      this.burst(new THREE.Vector3(this.hoopPos.x, this.hoopPos.y - 0.3, this.hoopPos.z), 0x9fef9a, 40, 1.5);
      this.camera.position.y -= 0.12;
      if (this.streak >= 3) {
        this.addScore(150);
        this.burst(new THREE.Vector3(0, 3, 3), 0xffd166, 50, 2);
        this.streak = 0;
      }
    }

    if (this.ball.position.y < 0.5 || this.ball.position.z > 9) {
      if (!this.scored) {
        this.streak = 0;
        this.burst(this.ball.position.clone(), 0xe2574c, 10, 0.5);
      }
      this.flying = false;
      this.respawnIn = 0.7;
      this.ball.visible = true;
      this.ball.position.set(0, 0.55, 5.5);
    }

    // Camera follows the ball gently for drama
    const targetY = 4.2 + Math.max(0, this.ball.position.y - 4) * 0.18;
    this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1, dt * 3);
    this.camera.lookAt(0, 2.6, -2);
  }
}
