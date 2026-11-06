// Zamkowa sala: zaczarowane, gwieździste sklepienie, lewitujące świece, kolumny i witraże.
import * as THREE from 'three';
import { stoneTexture, brickTexture, flameTexture, windowTexture, glowTexture, rng } from './textures.js';

export function buildEnvironment(scene) {
  scene.background = new THREE.Color(0x04050b);
  scene.fog = new THREE.FogExp2(0x070814, 0.03);

  const hemi = new THREE.HemisphereLight(0x7d8cff, 0x2a1d12, 0.55);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xc4d2ff, 1.6);
  moon.position.set(-6, 14, 5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = sc.bottom = -7;
  sc.right = sc.top = 7;
  sc.near = 1;
  sc.far = 40;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.02;
  scene.add(moon);

  const warm = new THREE.SpotLight(0xffc27a, 90, 40, Math.PI / 5, 0.6, 1.4);
  warm.position.set(6, 12, 6);
  warm.target.position.set(0, 0, 0);
  scene.add(warm, warm.target);

  // Posadzka
  const floorTex = stoneTexture(3, [58, 54, 60], 4);
  floorTex.repeat.set(14, 14);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 }),
  );
  floor.position.y = -1.2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Kamienny cokół pod szachownicą
  const plinthTex = stoneTexture(8, [80, 74, 82], 2);
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 1.0, 9.8),
    new THREE.MeshStandardMaterial({ map: plinthTex, roughness: 0.8 }),
  );
  plinth.position.y = -0.7;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  scene.add(plinth);
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.25, 11),
    new THREE.MeshStandardMaterial({ map: plinthTex, roughness: 0.85 }),
  );
  step.position.y = -1.08;
  step.receiveShadow = true;
  scene.add(step);

  // Ściany
  const wallTex = brickTexture(5);
  wallTex.repeat.set(18, 6);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 24, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, side: THREE.BackSide }),
  );
  wall.position.y = 10.8;
  scene.add(wall);

  // Witraże
  const winTex = windowTexture();
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, color: new THREE.Color(1.4, 1.5, 1.9), fog: false });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 7.2), winMat);
    w.position.set(Math.cos(a) * 19.8, 6.5, Math.sin(a) * 19.8);
    w.lookAt(0, 6.5, 0);
    scene.add(w);
  }

  // Kolumny
  const colTex = stoneTexture(13, [88, 82, 90], 1);
  colTex.repeat.set(2, 6);
  const colMat = new THREE.MeshStandardMaterial({ map: colTex, roughness: 0.8 });
  const colGeo = new THREE.CylinderGeometry(0.65, 0.75, 22, 20);
  const capGeo = new THREE.BoxGeometry(2, 0.6, 2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * 16, z = Math.sin(a) * 16;
    const c = new THREE.Mesh(colGeo, colMat);
    c.position.set(x, 9.8, z);
    scene.add(c);
    const base = new THREE.Mesh(capGeo, colMat);
    base.position.set(x, -0.9, z);
    scene.add(base);
  }

  // Gwiaździste sklepienie (zaczarowany sufit)
  const starCount = 2500;
  const sPos = new Float32Array(starCount * 3);
  const sPhase = new Float32Array(starCount);
  const sSize = new Float32Array(starCount);
  const r = rng(77);
  for (let i = 0; i < starCount; i++) {
    const th = r() * Math.PI * 2;
    const ph = Math.acos(1 - r() * 0.75);
    const R = 60;
    sPos[i * 3] = Math.sin(ph) * Math.cos(th) * R;
    sPos[i * 3 + 1] = Math.cos(ph) * R + 4;
    sPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * R;
    sPhase[i] = r() * 100;
    sSize[i] = 0.6 + r() * r() * 3.2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(sPhase, 1));
  starGeo.setAttribute('ssize', new THREE.BufferAttribute(sSize, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, pr: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float phase; attribute float ssize; uniform float time; uniform float pr; varying float vA;
      void main(){
        vA = 0.55 + 0.45 * sin(time * (0.6 + fract(phase) * 1.8) + phase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = ssize * pr * (0.8 + vA * 0.6);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * 1.6, a * vA);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Księżyc i mgławica na sklepieniu
  const glowTex = glowTexture();
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: new THREE.Color(2.2, 2.3, 2.6), fog: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  moonSprite.position.set(-22, 42, -30);
  moonSprite.scale.setScalar(9);
  scene.add(moonSprite);
  const nebulaColors = [0x3a2a8a, 0x1d4a7a, 0x4a1d6a];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: nebulaColors[i % 3], fog: false, depthWrite: false, transparent: true,
      opacity: 0.35, blending: THREE.AdditiveBlending,
    }));
    const a = r() * Math.PI * 2;
    s.position.set(Math.cos(a) * 25, 40 + r() * 10, Math.sin(a) * 25);
    s.scale.setScalar(30 + r() * 25);
    scene.add(s);
  }

  // Lewitujące świece
  const candleCount = 60;
  const candleGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.5, 10);
  candleGeo.translate(0, -0.25, 0);
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xf3ead2, emissive: 0x5a3c18, emissiveIntensity: 0.6, roughness: 0.6 });
  const candles = new THREE.InstancedMesh(candleGeo, candleMat, candleCount);
  const flameTex = flameTexture();
  const flameMat = new THREE.SpriteMaterial({
    map: flameTex, color: new THREE.Color(3.0, 1.9, 0.9), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true,
  });
  const candleData = [];
  for (let i = 0; i < candleCount; i++) {
    const a = r() * Math.PI * 2;
    const rad = 7 + r() * 8;
    const z = Math.sin(a) * rad;
    // świece z przodu wiszą wyżej, by nie zasłaniać szachownicy
    const y = z > -2 ? 10.5 + r() * 3 : 4.5 + r() * 5;
    const base = new THREE.Vector3(Math.cos(a) * rad, y, z);
    const flame = new THREE.Sprite(flameMat);
    flame.scale.set(0.12, 0.24, 1);
    scene.add(flame);
    candleData.push({ base, flame, phase: r() * 10, speed: 0.4 + r() * 0.6 });
  }
  scene.add(candles);

  const candleLights = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const l = new THREE.PointLight(0xffa850, 14, 18, 1.6);
    l.position.set(Math.cos(a) * 7, 6, Math.sin(a) * 7);
    scene.add(l);
    candleLights.push({ l, phase: i * 1.7 });
  }

  // Unoszące się magiczne drobinki
  const moteCount = 500;
  const mPos = new Float32Array(moteCount * 3);
  const mPh = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    mPos[i * 3] = (r() - 0.5) * 26;
    mPos[i * 3 + 1] = -1 + r() * 10;
    mPos[i * 3 + 2] = (r() - 0.5) * 26;
    mPh[i] = r() * 100;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  moteGeo.setAttribute('phase', new THREE.BufferAttribute(mPh, 1));
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, map: { value: glowTex }, pr: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float phase; uniform float time; uniform float pr; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(time * 0.3 + phase) * 0.6;
        p.z += cos(time * 0.25 + phase * 1.3) * 0.6;
        p.y += mod(time * 0.15 + phase, 10.0) - 5.0;
        vA = 0.5 + 0.5 * sin(time * 2.0 + phase * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = pr * 40.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; varying float vA;
      void main(){
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vec3(1.6, 1.3, 0.7) * t.rgb, t.a * vA * 0.8);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  scene.add(motes);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();

  return {
    update(t) {
      starMat.uniforms.time.value = t;
      moteMat.uniforms.time.value = t;
      for (let i = 0; i < candleData.length; i++) {
        const c = candleData[i];
        p.copy(c.base);
        p.y += Math.sin(t * c.speed + c.phase) * 0.25;
        p.x += Math.sin(t * c.speed * 0.5 + c.phase) * 0.08;
        m4.compose(p, q, one);
        candles.setMatrixAt(i, m4);
        c.flame.position.set(p.x, p.y + 0.11, p.z);
        const fl = 1 + Math.sin(t * 13 + c.phase * 7) * 0.08 + Math.sin(t * 23 + c.phase) * 0.05;
        c.flame.scale.set(0.12 * fl, 0.24 * fl, 1);
      }
      candles.instanceMatrix.needsUpdate = true;
      for (const { l, phase } of candleLights) {
        l.intensity = 14 + Math.sin(t * 9 + phase) * 1.5 + Math.sin(t * 17 + phase * 2) * 1.0;
      }
    },
  };
}
