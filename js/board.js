// Szachownica, współrzędne pól i znaczniki podświetleń.
import * as THREE from 'three';
import { boardTexture, frameTexture, glowTexture } from './textures.js';

export function squareToPos(sq, y = 0) {
  const f = sq.charCodeAt(0) - 97;
  const r = parseInt(sq[1], 10) - 1;
  return new THREE.Vector3(f - 3.5, y, 3.5 - r);
}

export function posToSquare(p) {
  const f = Math.floor(p.x + 4);
  const r = Math.floor(4 - p.z);
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return String.fromCharCode(97 + f) + (r + 1);
}

export function buildBoard(scene) {
  const topMat = new THREE.MeshPhysicalMaterial({
    map: boardTexture(), roughness: 0.3, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.3,
  });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 8), [edgeMat, edgeMat, topMat, edgeMat, edgeMat, edgeMat]);
  board.position.y = -0.1;
  board.receiveShadow = true;
  scene.add(board);

  const frameTop = new THREE.MeshStandardMaterial({ map: frameTexture(), roughness: 0.45, metalness: 0.25 });
  const frameSide = new THREE.MeshStandardMaterial({ color: 0x3a2717, roughness: 0.5, metalness: 0.2 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 9), [frameSide, frameSide, frameTop, frameSide, frameSide, frameSide]);
  frame.position.y = -0.17;
  frame.receiveShadow = true;
  frame.castShadow = true;
  scene.add(frame);

  // Złota listwa
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(9.12, 0.06, 9.12),
    new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.9 }),
  );
  trim.position.y = -0.3;
  scene.add(trim);

  const glow = glowTexture();
  const discGeo = new THREE.CircleGeometry(0.16, 32).rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.36, 0.46, 48).rotateX(-Math.PI / 2);
  const squareGeo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);

  const mkMat = (color, opacity) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const markers = [];
  const markerMatMove = mkMat(new THREE.Color(1.2, 1.0, 0.5), 0.85);
  const markerMatCap = mkMat(new THREE.Color(1.8, 0.35, 0.25), 0.9);

  const hover = new THREE.Mesh(squareGeo, mkMat(new THREE.Color(0.5, 0.45, 0.3), 0.35));
  hover.position.y = 0.006;
  hover.visible = false;
  scene.add(hover);

  const selectSq = new THREE.Mesh(squareGeo, mkMat(new THREE.Color(1.0, 0.8, 0.3), 0.45));
  selectSq.position.y = 0.007;
  selectSq.visible = false;
  scene.add(selectSq);

  const lastFrom = new THREE.Mesh(squareGeo, mkMat(new THREE.Color(0.35, 0.55, 0.9), 0.3));
  const lastTo = new THREE.Mesh(squareGeo, mkMat(new THREE.Color(0.35, 0.55, 0.9), 0.45));
  for (const m of [lastFrom, lastTo]) {
    m.position.y = 0.005;
    m.visible = false;
    scene.add(m);
  }

  const checkSprite = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: glow, color: new THREE.Color(3, 0.4, 0.3), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  checkSprite.position.y = 0.01;
  checkSprite.visible = false;
  scene.add(checkSprite);

  return {
    mesh: board,
    setHover(sq) {
      if (!sq) {
        hover.visible = false;
        return;
      }
      hover.position.copy(squareToPos(sq, 0.006));
      hover.visible = true;
    },
    setSelected(sq) {
      if (!sq) {
        selectSq.visible = false;
        return;
      }
      selectSq.position.copy(squareToPos(sq, 0.007));
      selectSq.visible = true;
    },
    setLastMove(from, to) {
      if (!from) {
        lastFrom.visible = lastTo.visible = false;
        return;
      }
      lastFrom.position.copy(squareToPos(from, 0.005));
      lastTo.position.copy(squareToPos(to, 0.005));
      lastFrom.visible = lastTo.visible = true;
    },
    setCheck(sq) {
      if (!sq) {
        checkSprite.visible = false;
        return;
      }
      checkSprite.position.copy(squareToPos(sq, 0.01));
      checkSprite.visible = true;
    },
    pulse(t) {
      checkSprite.material.opacity = 0.6 + Math.sin(t * 6) * 0.35;
      for (const m of markers) m.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    },
    showTargets(moves) {
      this.clearTargets();
      for (const mv of moves) {
        const capture = mv.flags.includes('c') || mv.flags.includes('e');
        const m = new THREE.Mesh(capture ? ringGeo : discGeo, capture ? markerMatCap : markerMatMove);
        m.position.copy(squareToPos(mv.to, 0.012));
        m.renderOrder = 3;
        scene.add(m);
        markers.push(m);
      }
    },
    clearTargets() {
      for (const m of markers) scene.remove(m);
      markers.length = 0;
    },
  };
}
