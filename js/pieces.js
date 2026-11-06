// Kamienne figury szachowe budowane z brył obrotowych (LatheGeometry).
import * as THREE from 'three';
import { marbleTexture } from './textures.js';

const SEG = 48;
const BASE = [
  [0, 0], [0.36, 0], [0.385, 0.02], [0.385, 0.07], [0.35, 0.1],
  [0.31, 0.12], [0.31, 0.15], [0.27, 0.17],
];

const geoCache = new Map();

function lathe(points) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), SEG);
}

function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

let textures = null;
function getTextures() {
  if (!textures) {
    textures = {
      w: marbleTexture('#efe7d6', '#a89678', 21, 512),
      b: marbleTexture('#1b1820', '#5d566e', 33, 512),
    };
  }
  return textures;
}

export function createMaterial(color) {
  const tex = getTextures()[color];
  return color === 'w'
    ? new THREE.MeshPhysicalMaterial({
        color: 0xffffff, map: tex, roughness: 0.32, metalness: 0.0,
        clearcoat: 0.6, clearcoatRoughness: 0.25,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xffffff, map: tex, roughness: 0.28, metalness: 0.15,
        clearcoat: 0.9, clearcoatRoughness: 0.15,
      });
}

function knightHeadGeometry() {
  const s = new THREE.Shape();
  const pts = [
    [-0.2, 0.2], [0.2, 0.2], [0.17, 0.34], [0.1, 0.44], [0.24, 0.52],
    [0.33, 0.6], [0.34, 0.67], [0.28, 0.73], [0.14, 0.8], [0.09, 0.9],
    [0.05, 1.0], [0.0, 0.91], [-0.06, 0.96], [-0.08, 0.86], [-0.18, 0.78],
    [-0.24, 0.6], [-0.24, 0.4],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3,
  });
  g.translate(0, 0, -0.1);
  return g;
}

function addMesh(group, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

export function createPiece(type, color) {
  const group = new THREE.Group();
  const mat = createMaterial(color);
  // Ozdobny materiał dla oczu / klejnotów
  const gem = new THREE.MeshStandardMaterial({
    color: color === 'w' ? 0xffd27a : 0x5cff9a,
    emissive: color === 'w' ? 0xffa83a : 0x22dd66,
    emissiveIntensity: 0.6, roughness: 0.2,
  });

  switch (type) {
    case 'p':
      addMesh(group, cached('p', () => lathe([...BASE,
        [0.21, 0.2], [0.14, 0.28], [0.1, 0.42], [0.17, 0.45], [0.17, 0.48], [0.1, 0.5], [0, 0.5]])), mat);
      addMesh(group, cached('ph', () => new THREE.SphereGeometry(0.14, 32, 24)), mat, 0, 0.61, 0);
      break;
    case 'r': {
      addMesh(group, cached('r', () => lathe([...BASE,
        [0.25, 0.2], [0.21, 0.26], [0.19, 0.6], [0.25, 0.64], [0.26, 0.66],
        [0.26, 0.82], [0.2, 0.82], [0.2, 0.76], [0, 0.76]])), mat);
      const mg = cached('rm', () => new THREE.BoxGeometry(0.1, 0.09, 0.08));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const m = addMesh(group, mg, mat, Math.cos(a) * 0.225, 0.86, Math.sin(a) * 0.225);
        m.rotation.y = -a;
      }
      break;
    }
    case 'n': {
      addMesh(group, cached('n', () => lathe([...BASE, [0.26, 0.2], [0.25, 0.24], [0, 0.24]])), mat);
      const head = addMesh(group, cached('nh', knightHeadGeometry), mat);
      head.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
      // oczy
      const eyeG = cached('ne', () => new THREE.SphereGeometry(0.028, 12, 8));
      const dir = color === 'w' ? -1 : 1;
      for (const side of [-1, 1]) {
        addMesh(group, eyeG, gem, side * 0.135, 0.74, dir * 0.12);
      }
      break;
    }
    case 'b':
      addMesh(group, cached('b', () => lathe([...BASE,
        [0.22, 0.2], [0.14, 0.3], [0.1, 0.62], [0.19, 0.66], [0.19, 0.69], [0.11, 0.72], [0, 0.72]])), mat);
      addMesh(group, cached('bh', () => lathe([
        [0, 0.7], [0.1, 0.72], [0.15, 0.8], [0.16, 0.88], [0.12, 0.98], [0.05, 1.06], [0, 1.08]])), mat);
      addMesh(group, cached('bt', () => new THREE.SphereGeometry(0.05, 16, 12)), gem, 0, 1.11, 0);
      break;
    case 'q': {
      addMesh(group, cached('q', () => lathe([...BASE,
        [0.24, 0.2], [0.15, 0.32], [0.11, 0.78], [0.21, 0.82], [0.21, 0.85], [0.13, 0.88],
        [0.14, 0.93], [0.21, 1.06], [0.17, 1.07], [0.12, 1.02], [0, 1.02]])), mat);
      const bead = cached('qb', () => new THREE.SphereGeometry(0.038, 12, 10));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        addMesh(group, bead, mat, Math.cos(a) * 0.19, 1.09, Math.sin(a) * 0.19);
      }
      addMesh(group, cached('qt', () => new THREE.SphereGeometry(0.075, 20, 14)), gem, 0, 1.1, 0);
      break;
    }
    case 'k':
      addMesh(group, cached('k', () => lathe([...BASE,
        [0.25, 0.2], [0.16, 0.32], [0.12, 0.86], [0.22, 0.9], [0.22, 0.93], [0.14, 0.96],
        [0.15, 1.0], [0.21, 1.13], [0.0, 1.15]])), mat);
      addMesh(group, cached('kc1', () => new THREE.BoxGeometry(0.07, 0.28, 0.07)), mat, 0, 1.28, 0);
      addMesh(group, cached('kc2', () => new THREE.BoxGeometry(0.22, 0.07, 0.07)), mat, 0, 1.31, 0);
      addMesh(group, cached('kg', () => new THREE.SphereGeometry(0.04, 12, 10)), gem, 0, 1.31, 0.04);
      break;
  }

  group.userData = { type, color, materials: [mat], gem };
  return group;
}

export const HEIGHTS = { p: 0.75, r: 0.9, n: 1.0, b: 1.15, q: 1.18, k: 1.45 };
