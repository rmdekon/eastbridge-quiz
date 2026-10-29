import * as THREE from 'three';

/** Original eagle mascot built from primitives — no external assets, no copyright risk. */
export const buildEagle = (scale = 1, bodyColor = 0xffffff, accent = 0xC8973A): THREE.Group => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.scale.set(1, 1.15, 1.25);
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 14, 12),
    new THREE.MeshLambertMaterial({ color: 0xf7f4ec }),
  );
  head.position.set(0, 0.48, 0.18);
  g.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.26, 4),
    new THREE.MeshLambertMaterial({ color: accent }),
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.46, 0.45);
  g.add(beak);

  const wingGeo = new THREE.BoxGeometry(0.14, 0.5, 0.34);
  const wingMat = new THREE.MeshLambertMaterial({ color: accent });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-0.45, 0.02, 0);
  wingL.rotation.z = 0.35;
  g.add(wingL);
  const wingR = wingL.clone();
  wingR.position.x = 0.45;
  wingR.rotation.z = -0.35;
  g.add(wingR);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b3a6b });
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(x, 0.52, 0.36);
    g.add(eye);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 4), wingMat);
  tail.rotation.x = -Math.PI / 2.3;
  tail.position.set(0, 0.05, -0.5);
  g.add(tail);

  g.scale.setScalar(scale);
  return g;
};

export const buildCoin = (r = 0.2): THREE.Mesh => {
  const coin = new THREE.Mesh(
    new THREE.TorusGeometry(r, r * 0.35, 8, 14),
    new THREE.MeshLambertMaterial({ color: 0xE0B45C, emissive: 0x5a3f0a }),
  );
  coin.rotation.y = Math.PI / 2;
  return coin;
};

export const buildStar = (size = 0.3): THREE.Mesh =>
  new THREE.Mesh(
    new THREE.OctahedronGeometry(size, 0),
    new THREE.MeshLambertMaterial({ color: 0xffd58a, emissive: 0x8a5f13 }),
  );

/** Rounded low-poly rock/obstacle. */
export const buildObstacle = (w: number, h: number, d: number, color = 0x2a7f8f): THREE.Mesh =>
  new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d, 1, 1, 1),
    new THREE.MeshLambertMaterial({ color }),
  );

export const laneX = (lane: number, spacing = 2.1) => (lane - 1) * spacing;

export class ObjectPool<T> {
  private free: T[] = [];
  constructor(
    private factory: () => T,
    private reset: (item: T) => void,
    size = 12,
  ) {
    for (let i = 0; i < size; i++) this.free.push(factory());
  }
  get(): T {
    const item = this.free.pop() ?? this.factory();
    this.reset(item);
    return item;
  }
  release(item: T): void {
    if (this.free.length < 40) this.free.push(item);
  }
}

export const disposeTree = (obj: THREE.Object3D) => {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
};
