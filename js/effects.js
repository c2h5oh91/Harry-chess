// Efekty magiczne: iskry, pył, odłamki, fale uderzeniowe, magiczne kręgi, pociski zaklęć.
import * as THREE from 'three';
import { glowTexture, runeCircleTexture } from './textures.js';
import { tween, ease } from './tween.js';

const tmpColor = new THREE.Color();

class Particles {
  constructor(scene, map, max, blending, intensity = 1) {
    this.max = max;
    this.count = 0;
    this.intensity = intensity;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    const mk = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.aPos = mk(this.pos, 3);
    this.aCol = mk(this.col, 3);
    this.aSize = mk(this.size, 1);
    this.aAlpha = mk(this.alpha, 1);
    g.setAttribute('position', this.aPos);
    g.setAttribute('pcolor', this.aCol);
    g.setAttribute('psize', this.aSize);
    g.setAttribute('palpha', this.aAlpha);
    g.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: `
        attribute vec3 pcolor; attribute float psize; attribute float palpha;
        varying vec3 vColor; varying float vAlpha; uniform float pixelRatio;
        void main(){
          vColor = pcolor; vAlpha = palpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * pixelRatio * (420.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main(){
          vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  emit(p, v, color, size, life, gravity = 0, drag = 0) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = p.x; this.pos[i3 + 1] = p.y; this.pos[i3 + 2] = p.z;
    this.vel[i3] = v.x; this.vel[i3 + 1] = v.y; this.vel[i3 + 2] = v.z;
    this.col[i3] = color.r * this.intensity;
    this.col[i3 + 1] = color.g * this.intensity;
    this.col[i3 + 2] = color.b * this.intensity;
    this.size[i] = this.size0[i] = size;
    this.alpha[i] = 1;
    this.life[i] = this.maxLife[i] = life;
    this.grav[i] = gravity;
    this.drag[i] = drag;
  }

  kill(i) {
    const last = --this.count;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[i3 + k] = this.pos[l3 + k];
      this.vel[i3 + k] = this.vel[l3 + k];
      this.col[i3 + k] = this.col[l3 + k];
    }
    this.size[i] = this.size[last];
    this.size0[i] = this.size0[last];
    this.alpha[i] = this.alpha[last];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.grav[i] = this.grav[last];
    this.drag[i] = this.drag[last];
  }

  update(dt) {
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.01 && Math.abs(this.pos[i3]) < 4.6 && Math.abs(this.pos[i3 + 2]) < 4.6) {
        this.pos[i3 + 1] = 0.01;
        this.vel[i3 + 1] *= -0.3;
      }
      const k = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, k * 2.5);
      this.size[i] = this.size0[i] * (0.4 + 0.6 * k);
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}

const rand = (a, b) => a + Math.random() * (b - a);
const randDir = (v = new THREE.Vector3()) => {
  const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
  return v.set(r * Math.cos(t), u, r * Math.sin(t));
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.glowTex = glowTexture();
    this.runeTex = runeCircleTexture();
    this.sparks = new Particles(scene, this.glowTex, 6000, THREE.AdditiveBlending, 2.0);
    this.smoke = new Particles(scene, this.glowTex, 2000, THREE.NormalBlending, 1.0);
    this.fragments = [];
    this.fragGeos = [
      new THREE.TetrahedronGeometry(1),
      new THREE.OctahedronGeometry(1),
      new THREE.DodecahedronGeometry(1),
      new THREE.IcosahedronGeometry(1),
    ];
    this.ringGeo = new THREE.RingGeometry(0.42, 0.5, 64).rotateX(-Math.PI / 2);
    this.planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.v = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
  }

  update(dt) {
    this.sparks.update(dt);
    this.smoke.update(dt);
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i];
      f.life -= dt;
      const m = f.mesh;
      f.vel.y -= 9.8 * dt;
      m.position.addScaledVector(f.vel, dt);
      m.rotation.x += f.spin.x * dt;
      m.rotation.y += f.spin.y * dt;
      m.rotation.z += f.spin.z * dt;
      const onBoard = Math.abs(m.position.x) < 4.75 && Math.abs(m.position.z) < 4.75;
      const ground = (onBoard ? 0 : -1.2) + f.r * 0.6;
      if (m.position.y < ground) {
        m.position.y = ground;
        f.vel.y *= -0.32;
        f.vel.x *= 0.6;
        f.vel.z *= 0.6;
        f.spin.multiplyScalar(0.6);
      }
      if (f.life < 1) m.material.opacity = Math.max(0, f.life);
      if (f.life <= 0) {
        this.scene.remove(m);
        m.material.dispose();
        this.fragments.splice(i, 1);
      }
    }
  }

  color(hex) {
    return tmpColor.set(hex);
  }

  trail(pos, hex, n = 3) {
    const c = this.color(hex);
    for (let i = 0; i < n; i++) {
      this.v.set(pos.x + rand(-0.15, 0.15), pos.y + rand(0, 0.6), pos.z + rand(-0.15, 0.15));
      randDir(this.v2).multiplyScalar(rand(0.05, 0.4));
      this.v2.y += 0.25;
      this.sparks.emit(this.v, this.v2, c, rand(0.05, 0.13), rand(0.5, 1.1), -0.1, 0.8);
    }
  }

  burst(pos, hex, count = 90, speed = 3, size = 0.12) {
    const c = this.color(hex);
    for (let i = 0; i < count; i++) {
      randDir(this.v2).multiplyScalar(rand(0.3, 1) * speed);
      this.v2.y = Math.abs(this.v2.y) * 1.2;
      this.sparks.emit(pos, this.v2, c, rand(size * 0.5, size * 1.5), rand(0.6, 1.4), 2.5, 1.2);
    }
  }

  spiral(pos, hex, height = 1.4, count = 60) {
    const c = this.color(hex);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 6;
      const y = (i / count) * height;
      this.v.set(pos.x + Math.cos(a) * 0.45, pos.y + y, pos.z + Math.sin(a) * 0.45);
      this.v2.set(-Math.sin(a) * 0.6, 0.6, Math.cos(a) * 0.6);
      this.sparks.emit(this.v, this.v2, c, rand(0.06, 0.12), rand(0.7, 1.3), -0.2, 0.5);
    }
  }

  dust(pos, count = 40, strength = 1) {
    const c = this.color(0x8f8576);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.6, 2.2) * strength;
      this.v.set(pos.x + Math.cos(a) * 0.3, 0.05, pos.z + Math.sin(a) * 0.3);
      this.v2.set(Math.cos(a) * s, rand(0.1, 0.8), Math.sin(a) * s);
      this.smoke.emit(this.v, this.v2, c, rand(0.25, 0.55), rand(0.8, 1.6), -0.15, 2.5);
    }
  }

  shockwave(pos, hex, scale = 4.5, dur = 0.7) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(1.4), transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(pos.x, 0.03, pos.z);
    this.scene.add(m);
    return tween(dur, (k) => {
      m.scale.setScalar(0.6 + k * scale);
      mat.opacity = 1 - k;
    }, ease.outCubic).then(() => {
      this.scene.remove(m);
      mat.dispose();
    });
  }

  magicCircle(pos, hex, size = 1.5) {
    const mat = new THREE.MeshBasicMaterial({
      map: this.runeTex, color: new THREE.Color(hex).multiplyScalar(2.2), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(this.planeGeo, mat);
    m.position.set(pos.x, 0.015, pos.z);
    m.renderOrder = 5;
    this.scene.add(m);
    let alive = true;
    const spin = () => {
      if (!alive) return;
      m.rotation.y += 0.02;
      requestAnimationFrame(spin);
    };
    spin();
    tween(0.4, (k) => {
      mat.opacity = k;
      m.scale.setScalar(size * (0.3 + 0.7 * k));
    }, ease.outBack);
    return {
      mesh: m,
      close: (dur = 0.5) => tween(dur, (k) => {
        mat.opacity = 1 - k;
        m.scale.setScalar(size * (1 + 0.4 * k));
      }).then(() => {
        alive = false;
        this.scene.remove(m);
        mat.dispose();
      }),
    };
  }

  flash(pos, hex, intensity = 40, dur = 0.5) {
    const l = new THREE.PointLight(hex, intensity, 8, 2);
    l.position.copy(pos);
    this.scene.add(l);
    return tween(dur, (k) => (l.intensity = intensity * (1 - k)), ease.outQuad).then(() => {
      this.scene.remove(l);
      l.dispose();
    });
  }

  bolt(from, to, hex, dur = 0.5) {
    const col = new THREE.Color(hex);
    const orbMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(6) });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), orbMat);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: col.clone().multiplyScalar(3), blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true,
    }));
    halo.scale.setScalar(0.8);
    orb.add(halo);
    const light = new THREE.PointLight(hex, 8, 5, 2);
    orb.add(light);
    this.scene.add(orb);
    const ctrl = from.clone().lerp(to, 0.5);
    ctrl.y += 1.0 + from.distanceTo(to) * 0.25;
    const p = new THREE.Vector3();
    return tween(dur, (k) => {
      const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k;
      p.set(
        a * from.x + b * ctrl.x + c * to.x,
        a * from.y + b * ctrl.y + c * to.y,
        a * from.z + b * ctrl.z + c * to.z,
      );
      orb.position.copy(p);
      halo.material.rotation += 0.3;
      this.trail(p, hex, 6);
    }, ease.inQuad).then(() => {
      this.scene.remove(orb);
      orb.geometry.dispose();
      orbMat.dispose();
      halo.material.dispose();
      light.dispose();
    });
  }

  lightning(from, to, hex, dur = 0.35) {
    const pts = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const p = from.clone().lerp(to, i / segs);
      if (i > 0 && i < segs) {
        p.x += rand(-0.18, 0.18);
        p.y += rand(-0.18, 0.18);
        p.z += rand(-0.18, 0.18);
      }
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(5), transparent: true, blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    return tween(dur, (k) => (mat.opacity = Math.random() > 0.3 ? 1 - k : 0.1), ease.linear).then(() => {
      this.scene.remove(line);
      geo.dispose();
      mat.dispose();
    });
  }

  pillar(pos, hex, height = 5, dur = 1.4) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(2.5), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const geo = new THREE.CylinderGeometry(0.42, 0.5, height, 32, 1, true);
    geo.translate(0, height / 2, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos.x, 0, pos.z);
    this.scene.add(m);
    return tween(dur, (k) => {
      mat.opacity = Math.sin(k * Math.PI) * 0.55;
      m.scale.set(1 - k * 0.5, 0.2 + k * 0.8, 1 - k * 0.5);
    }, ease.linear).then(() => {
      this.scene.remove(m);
      geo.dispose();
      mat.dispose();
    });
  }

  shatter(group) {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const baseMat = group.userData.materials[0];
    const count = 46;
    for (let i = 0; i < count; i++) {
      const mat = baseMat.clone();
      mat.transparent = true;
      mat.emissiveIntensity = 0;
      const r = rand(0.04, 0.12) * (i < 6 ? 1.6 : 1);
      const m = new THREE.Mesh(this.fragGeos[i % this.fragGeos.length], mat);
      m.scale.set(r * rand(0.7, 1.3), r * rand(0.7, 1.3), r * rand(0.7, 1.3));
      m.castShadow = true;
      m.position.set(
        center.x + rand(-0.5, 0.5) * size.x * 0.7,
        box.min.y + Math.random() * size.y,
        center.z + rand(-0.5, 0.5) * size.z * 0.7,
      );
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const out = this.v.set(m.position.x - center.x, 0, m.position.z - center.z);
      if (out.lengthSq() < 1e-4) randDir(out).setY(0);
      out.normalize().multiplyScalar(rand(1, 4.2));
      const vel = new THREE.Vector3(out.x, rand(1.5, 5.5), out.z);
      const spin = new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12));
      this.scene.add(m);
      this.fragments.push({ mesh: m, vel, spin, r, life: rand(2.6, 3.8) });
    }
    this.dust(center, 60, 1.4);
  }
}
