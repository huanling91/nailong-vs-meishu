/* ============================================================
   特效引擎 v3 —— 打击感 / 华丽技能 / 动态粒子
   · 精灵粒子池（加法混合，零 GC）
   · 冲击环 / 斩击弧 / 星芒 / 速度线 / 能量螺旋 / 地裂贴花
   · 凝胶弹道 / 龙卷风 / 聚气光晕 / KO 爆发 / 必杀演出
   纯脚本，挂在 window.NV 上。
   ============================================================ */
(function (NV) {
  "use strict";
  const T = NV;

  /* ---------- 精灵粒子池 ---------- */
  function SpritePool(scene, max) {
    this.max = max;
    this.items = [];
    this.free = [];
    for (let i = 0; i < max; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: T.fxTextures.dot,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      const it = {
        sprite: m, life: 0, t: 0,
        vx: 0, vy: 0, vz: 0, g: 0, drag: 0,
        s0: 1, s1: 1, rot: 0, spin: 0, fadePow: 1, alive: false,
      };
      this.items.push(it);
      this.free.push(it);
    }
  }
  SpritePool.prototype.emit = function (opt) {
    let it = this.free.pop();
    if (!it) { // 池满：抢占最老的一个
      it = this.items[0];
      for (let i = 1; i < this.items.length; i++) if (this.items[i].alive && this.items[i].t > it.t) it = this.items[i];
    }
    it.alive = true;
    it.t = 0;
    it.life = opt.life || 0.4;
    const s = it.sprite;
    s.visible = true;
    s.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
    s.material.map = opt.map || T.fxTextures.dot;
    s.material.color.set(opt.color == null ? 0xffffff : opt.color);
    s.material.opacity = opt.opacity == null ? 1 : opt.opacity;
    s.material.alphaTest = 0.02;
    s.material.blending = opt.blend === "normal" ? THREE.NormalBlending : THREE.AdditiveBlending;
    s.material.rotation = opt.rot || 0;
    s.material.depthTest = opt.front ? false : true;
    s.renderOrder = opt.front ? 14 : 0;
    s.scale.set(opt.size || 0.2, (opt.size || 0.2) * (opt.sy || 1), 1);
    it.s0 = opt.size || 0.2;
    it.s1 = opt.size1 == null ? it.s0 * 0.1 : opt.size1;
    it.vx = opt.vx || 0; it.vy = opt.vy || 0; it.vz = opt.vz || 0;
    it.g = opt.g == null ? 0 : opt.g;
    it.drag = opt.drag == null ? 0 : opt.drag;
    it.rot = opt.rot || 0;
    it.spin = opt.spin || 0;
    it.fadePow = opt.fadePow || 1;
    it.sy = opt.sy || 1;
    it.baseOpacity = opt.opacity == null ? 1 : opt.opacity;
    return it;
  };
  SpritePool.prototype.update = function (dt) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.alive) continue;
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        it.alive = false; it.sprite.visible = false;
        if (this.free.indexOf(it) < 0) this.free.push(it);
        continue;
      }
      const s = it.sprite;
      s.position.x += it.vx * dt;
      s.position.y += it.vy * dt;
      s.position.z += it.vz * dt;
      it.vy += it.g * dt;
      if (it.drag) {
        const d = Math.max(0, 1 - it.drag * dt);
        it.vx *= d; it.vy *= d; it.vz *= d;
      }
      const size = it.s0 + (it.s1 - it.s0) * k;
      s.scale.set(size, size * it.sy, 1);
      s.material.rotation += it.spin * dt;
      s.material.opacity = Math.pow(1 - k, it.fadePow) * (it.baseOpacity == null ? 1 : it.baseOpacity);
    }
  };
  SpritePool.prototype.clear = function () {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.alive) { it.alive = false; it.sprite.visible = false; this.free.push(it); }
    }
  };

  /* ---------- 冲击环着色器 ---------- */
  function ringMaterial(color) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: 1 },
        uWidth: { value: 0.16 },
      },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:
        "varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity; uniform float uWidth;" +
        "void main(){ float r=length(vUv-0.5)*2.0;" +
        "float a=smoothstep(1.0-uWidth,1.0-0.02*uWidth,r)*(1.0-smoothstep(1.0,1.04,r));" +
        "a*=uOpacity; if(a<=0.003)discard; gl_FragColor=vec4(uColor*(1.4+a*1.6),a); }",
    });
  }

  /* ============================================================
     FX 管理器
     ============================================================ */
  function FX(scene, camera) {
    T.ensureFxTextures();
    this.scene = scene;
    this.camera = camera;
    this.pool = new SpritePool(scene, 720);
    this.groups = [];      // {meshes:[], t, life, update}
    this.decals = [];      // 地裂贴花
    this.ringGeo = new THREE.RingGeometry(0.86, 1, 48);
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this._tmpV = new THREE.Vector3();
  }

  /* 一次性网格组：每帧调用 fn(fx, k) */
  FX.prototype.group = function (life, fn) {
    const grp = { meshes: [], t: 0, life: life, fn: fn };
    this.groups.push(grp);
    return grp;
  };
  FX.prototype.addSprite = function (grp, opt) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: opt.map || T.fxTextures.dot,
      color: opt.color == null ? 0xffffff : opt.color,
      transparent: true,
      blending: opt.blend === "normal" ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: opt.opacity == null ? 1 : opt.opacity,
    }));
    s.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
    s.scale.set(opt.size || 1, (opt.size || 1) * (opt.sy || 1), 1);
    s.material.rotation = opt.rot || 0;
    s.material.depthTest = opt.front ? false : true;
    s.renderOrder = opt.front ? 18 : 0;
    s.frustumCulled = false;
    this.scene.add(s);
    grp.meshes.push(s);
    return s;
  };
  FX.prototype.addRing = function (grp, opt) {
    const m = new THREE.Mesh(this.ringGeo, ringMaterial(opt.color == null ? "#ffffff" : opt.color));
    m.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
    m.rotation.set(opt.rx || 0, opt.ry || 0, opt.rz || 0);
    m.scale.setScalar(opt.size || 1);
    m.frustumCulled = false;
    if (opt.front) { m.material.depthTest = false; m.renderOrder = 16; }
    this.scene.add(m);
    grp.meshes.push(m);
    return m;
  };
  FX.prototype.addPlane = function (grp, opt) {
    const m = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({
      map: opt.map, color: opt.color == null ? 0xffffff : opt.color,
      transparent: true, opacity: opt.opacity == null ? 1 : opt.opacity,
      blending: opt.blend === "normal" ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }));
    m.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
    m.rotation.set(opt.rx || 0, opt.ry || 0, opt.rz || 0);
    m.scale.set(opt.size || 1, (opt.size || 1) * (opt.sy || 1), 1);
    m.frustumCulled = false;
    this.scene.add(m);
    grp.meshes.push(m);
    return m;
  };

  FX.prototype.disposeGroup = function (grp) {
    for (let i = 0; i < grp.meshes.length; i++) {
      const m = grp.meshes[i];
      this.scene.remove(m);
      if (m.material) m.material.dispose();
    }
    grp.meshes.length = 0;
  };

  FX.prototype.update = function (dt) {
    this.pool.update(dt);
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const grp = this.groups[i];
      grp.t += dt;
      const k = grp.t / grp.life;
      if (k >= 1) {
        this.disposeGroup(grp);
        this.groups.splice(i, 1);
      } else {
        grp.fn(this, grp, k, dt);
      }
    }
    // 地裂贴花淡出
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.t += dt;
      const k = d.t / d.life;
      if (k >= 1) {
        this.scene.remove(d.mesh); d.mesh.material.dispose();
        this.decals.splice(i, 1);
      } else d.mesh.material.opacity = 0.85 * (1 - k * k);
    }
  };
  FX.prototype.clear = function () {
    while (this.groups.length) { this.disposeGroup(this.groups.pop()); }
    for (let i = 0; i < this.decals.length; i++) { this.scene.remove(this.decals[i].mesh); this.decals[i].mesh.material.dispose(); }
    this.decals.length = 0;
    this.pool.clear();
  };

  /* ---------- 面向相机的四元数（billboard 组用） ---------- */
  FX.prototype.camQuat = function (out) {
    this.camera.getWorldQuaternion(out || (out = new THREE.Quaternion()));
    return out;
  };

  /* ============================================================
     招式特效库
     ============================================================ */
  const FXlib = {

    /* 轻命中：白热核心 + 火花四溅 + 小环 */
    hit(fx, x, y, tint) {
      const P = fx.pool, TX = T.fxTextures;
      P.emit({ map: TX.core, x: x, y: y, z: 0.3, size: 0.34, size1: 0.05, life: 0.12, color: 0xfff6d8, opacity: 0.9 });
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(2.5, 6.5);
        P.emit({ map: TX.star, x: x, y: y, z: 0.28, size: T.rand(0.05, 0.13), size1: 0.005, life: T.rand(0.18, 0.34),
          color: tint || 0xffd24a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1.2, vz: T.rand(-1, 1), g: -8, drag: 3, spin: T.rand(-9, 9) });
      }
      const grp = fx.group(0.24, function (f, gr, k) {
        const m = gr.meshes[0];
        m.scale.setScalar(0.16 + T.easeOut(k) * 0.42);
        m.material.uniforms.uOpacity.value = (1 - k) * 0.7;
      });
      fx.addRing(grp, { x: x, y: y, z: 0.3, color: tint || "#ffd24a", size: 0.16, rx: -0.2 });
    },

    /* 重击：大星芒 + 双环 + 放射线 + 火星雨 */
    heavyHit(fx, x, y, dir) {
      const P = fx.pool, TX = T.fxTextures;
      P.emit({ map: TX.core, x: x, y: y, z: 0.32, size: 0.5, size1: 0.08, life: 0.15, color: 0xffffff, opacity: 0.9 });
      P.emit({ map: TX.star, x: x, y: y, z: 0.34, size: 0.78, size1: 0.18, life: 0.2, color: 0xfff2c0, spin: 3, opacity: 0.85 });
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(3.5, 9);
        P.emit({ map: TX.star, x: x, y: y, z: 0.3, size: T.rand(0.06, 0.16), size1: 0.006, life: T.rand(0.25, 0.5),
          color: i % 3 ? 0xffb03a : 0xfff2c0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, vz: T.rand(-1.6, 1.6), g: -12, drag: 2.2, spin: T.rand(-12, 12) });
      }
      const grp = fx.group(0.26, function (f, gr, k) {
        gr.meshes[0].scale.setScalar(0.18 + T.easeOut(k) * 0.55);
        gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.75;
        gr.meshes[1].scale.setScalar(0.13 + T.easeOut(k * 0.8) * 0.36);
        gr.meshes[1].material.uniforms.uOpacity.value = (1 - k) * 0.55;
      });
      fx.addRing(grp, { x: x, y: y, z: 0.32, color: "#ff9a3c", size: 0.18 });
      fx.addRing(grp, { x: x, y: y, z: 0.3, color: "#fff2c0", size: 0.13 });
      const grp2 = fx.group(0.16, function (f, gr, k) {
        const s = 1 + k * 0.9;
        gr.meshes[0].scale.set(0.95 * s, 0.95 * s, 1);
        gr.meshes[0].material.opacity = 0.3 * (1 - k);
      });
      fx.addSprite(grp2, { map: TX.speed, x: x, y: y, z: 0.25, size: 0.95, color: 0xffe9b0, opacity: 0.3, rot: Math.random() * 3 });
    },

    /* 格挡：蓝白盾环 + 碎光 */
    blockHit(fx, x, y) {
      const P = fx.pool, TX = T.fxTextures;
      P.emit({ map: TX.core, x: x, y: y, z: 0.3, size: 0.4, size1: 0.05, life: 0.1, color: 0xbfe8ff, opacity: 0.85 });
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(2, 5);
        P.emit({ map: TX.star, x: x, y: y, z: 0.3, size: T.rand(0.04, 0.1), size1: 0.004, life: 0.24,
          color: 0x9ad8ff, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: -6, drag: 4, spin: T.rand(-8, 8) });
      }
      const grp = fx.group(0.26, function (f, gr, k) {
        gr.meshes[0].scale.setScalar(0.26 + T.easeOut(k) * 0.5);
        gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.7;
      });
      fx.addRing(grp, { x: x, y: y, z: 0.34, color: "#9ad8ff", size: 0.26 });
    },

    /* 斩击弧（拳风/掌风轨迹） */
    slash(fx, x, y, dir, color, size) {
      const TX = T.fxTextures;
      const grp = fx.group(0.2, function (f, gr, k) {
        const m = gr.meshes[0];
        const g = (size || 1.4) * (0.5 + k * 0.9);
        m.scale.set(g, g, 1);
        m.material.opacity = 0.7 * (1 - k);
      });
      fx.addSprite(grp, { map: TX.arc, x: x, y: y, z: 0.34, size: (size || 1.4) * 0.5, color: color || 0xfff2c0, rot: dir > 0 ? -0.6 : 0.6 + Math.PI, opacity: 0.7 });
    },

    /* 落地烟尘 */
    dust(fx, x, dir, power) {
      const P = fx.pool, TX = T.fxTextures;
      power = power || 1;
      for (let i = 0; i < Math.round(7 * power); i++) {
        P.emit({ map: TX.smoke, blend: "normal", x: x + T.rand(-0.3, 0.3), y: 0.16, z: T.rand(-0.5, 0.5),
          size: T.rand(0.2, 0.4) * power, size1: T.rand(0.5, 0.9) * power, life: T.rand(0.4, 0.7),
          color: 0xcbb68e, opacity: 0.55, vx: -dir * T.rand(0.4, 1.8) * power, vy: T.rand(0.3, 1.2), g: -1.5, drag: 2.5, spin: T.rand(-2, 2), fadePow: 1.6 });
      }
      const grp = fx.group(0.3, function (f, gr, k) {
        gr.meshes[0].scale.set(1.2 + k * 3.2, (1.2 + k * 3.2) * 0.32, 1);
        gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.7;
      });
      fx.addRing(grp, { x: x, y: 0.14, z: 0, rx: -Math.PI / 2, color: "#d8c49a", size: 1.2 });
    },

    /* 地面裂纹贴花 */
    crack(fx, x, scale) {
      const TX = T.fxTextures;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: TX.crack, color: 0x120c06, transparent: true, opacity: 0.85,
        blending: THREE.NormalBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.135, 0.1);
      m.scale.setScalar(scale || 2);
      fx.scene.add(m);
      fx.decals.push({ mesh: m, t: 0, life: 2.6 });
      // 裂纹发光边缘一闪
      const grp = fx.group(0.25, function (f, gr, k) {
        gr.meshes[0].material.opacity = 0.9 * (1 - k);
        gr.meshes[0].scale.setScalar((scale || 2) * (0.85 + k * 0.25));
      });
      fx.addSprite(grp, { map: TX.crack, x: x, y: 0.16, z: 0.1, size: scale || 2, color: 0xffb03a, rx: -Math.PI / 2 });
    },

    /* 径向速度线（必杀演出） */
    speedLines(fx, life) {
      const TX = T.fxTextures;
      const grp = fx.group(life || 0.5, function (f, gr, k) {
        const m = gr.meshes[0];
        m.position.copy(f.camera.position).add(f._tmpV.set(0, 0, -1).applyQuaternion(f.camera.quaternion).multiplyScalar(3.2));
        m.quaternion.copy(f.camera.quaternion);
        const s = 4 + T.easeOut(k) * 3;
        m.scale.set(s, s, 1);
        m.material.opacity = 0.26 * (1 - k) * (k < 0.2 ? k * 5 : 1);
        m.material.rotation += 0.008;
      });
      fx.addSprite(grp, { map: TX.speed, size: 4, color: 0xffe9b0, opacity: 0 });
    },

    /* 聚气光晕（必杀蓄力） */
    chargeAura(fx, fighter, dur, color) {
      const TX = T.fxTextures;
      const grp = fx.group(dur, function (f, gr, k) {
        const cx = fighter.x, cy = fighter.y + 0.12 + 0.8;
        const pulse = 1 + Math.sin(k * 48) * 0.18;
        gr.meshes[0].position.set(cx, cy, 0);
        gr.meshes[0].scale.setScalar((1.35 - k * 0.45) * pulse);
        gr.meshes[0].material.opacity = (0.48 + Math.sin(k * 36) * 0.14) * (1 - k);
        gr.meshes[1].position.set(cx, cy, 0);
        gr.meshes[1].material.rotation -= 0.38;
        gr.meshes[1].scale.setScalar((1.15 - k * 0.3) * (2.1 - pulse));
        gr.meshes[1].material.opacity = 0.62 * (1 - k);
        gr.meshes[2].position.set(cx, cy, 0.05);
        gr.meshes[2].material.rotation += 0.22;
        gr.meshes[2].scale.setScalar((1.6 - k * 0.4) * pulse);
        gr.meshes[2].material.opacity = 0.32 * (1 - k);
      });
      fx.addSprite(grp, { map: TX.core, size: 1.35, color: color || 0xffe28a, opacity: 0.42 });
      fx.addSprite(grp, { map: TX.ring, size: 1.15, color: color || 0xffd24a, opacity: 0.58, spin: -8 });
      fx.addSprite(grp, { map: TX.ring, size: 1.6, color: 0xfff6e0, opacity: 0.32, spin: 5 });
      fx.group(dur, function (f, gr, k) {
        for (let n = 0; n < 3; n++) {
          const a = Math.random() * 6.2832, r = T.rand(1.1, 2.2);
          const px = fighter.x + Math.cos(a) * r, py = fighter.y + 0.9 + Math.sin(a) * r * 0.85;
          f.pool.emit({ map: n % 2 ? TX.star : TX.dot, x: px, y: py, z: T.rand(-0.4, 0.5), size: T.rand(0.06, 0.16), size1: 0.005,
            life: 0.34, color: color || 0xffd24a, opacity: 0.9,
            vx: (fighter.x - px) * 4.2, vy: (fighter.y + 0.9 - py) * 4.2, g: 0, drag: 0, spin: T.rand(-10, 10) });
        }
      });
    },

    /* 环绕螺旋粒子（旋风类技能） */
    spiral(fx, fighter, dur, opt) {
      opt = opt || {};
      const TX = T.fxTextures;
      const grp = fx.group(dur, function (f, gr, k, dt) {
        const n = opt.count || 3;
        for (let i = 0; i < n; i++) {
          const a = k * (opt.turns || 10) * 6.2832 + i * 6.2832 / n;
          const h = 0.25 + ((k * (opt.rise || 1.2) + i * 0.17) % 1) * 1.15;
          const r = (opt.radius || 0.55) * (1 - h * 0.28);
          f.pool.emit({
            map: opt.map || TX.dot,
            x: fighter.x + Math.cos(a) * r,
            y: fighter.y + 0.12 + h,
            z: Math.sin(a) * r * 0.7,
            size: T.rand(0.08, 0.18), size1: 0.01, life: T.rand(0.22, 0.4),
            color: opt.color == null ? 0xffd24a : opt.color,
            vx: Math.cos(a + 1.57) * 1.4, vy: T.rand(0.6, 1.8), vz: Math.sin(a + 1.57) * 0.8,
            g: -1, drag: 1.2, spin: T.rand(-6, 6),
          });
        }
        // 中心拖尾
        if (Math.random() < 0.6) {
          f.pool.emit({ map: TX.dot, x: fighter.x + T.rand(-0.2, 0.2), y: fighter.y + T.rand(0.3, 1.3), z: T.rand(-0.2, 0.2),
            size: 0.1, size1: 0.01, life: 0.25, color: opt.inner || 0xfff2c0, vy: 1 });
        }
      });
    },

    /* 龙卷风带（旋风弹跳） */
    tornado(fx, fighter, dur) {
      const TX = T.fxTextures;
      const grp = fx.group(dur, function (f, gr, k) {
        for (let i = 0; i < 2; i++) {
          const m = gr.meshes[i];
          m.position.set(fighter.x, fighter.y + 0.55 + i * 0.42, 0.05);
          m.material.rotation += (i ? -0.42 : 0.42);
          const s = (0.85 + i * 0.3) * (1 + Math.sin(k * 30) * 0.06);
          m.scale.set(s, s * 0.62, 1);
          m.material.opacity = (k < 0.15 ? k / 0.15 : 1 - T.ramp(k, 0.75, 1)) * 0.55;
        }
      });
      fx.addSprite(grp, { map: TX.ring, size: 0.85, color: 0xffd76a, opacity: 0 });
      fx.addSprite(grp, { map: TX.arc, size: 1.1, color: 0xfff2c0, opacity: 0, rot: 1 });
      FXlib.spiral(fx, fighter, dur, { color: 0xffd24a, inner: 0xfff6d8, count: 3, turns: 12, radius: 0.6 });
    },

    /* 凝胶弹道波 */
    gelWave(fx, meshObj, t, k) {
      const P = fx.pool, TX = T.fxTextures;
      if (Math.random() < 0.85) {
        P.emit({ map: TX.gel, x: meshObj.position.x + T.rand(-0.25, 0.25), y: 0.2 + Math.random() * 0.5, z: T.rand(-0.3, 0.3),
          size: T.rand(0.1, 0.24), size1: 0.02, life: 0.35, color: 0xb8e04a,
          vx: T.rand(-0.4, 0.4), vy: T.rand(0.6, 2.2), g: -5, drag: 1.5 });
      }
      if (Math.random() < 0.35) {
        P.emit({ map: TX.dot, x: meshObj.position.x, y: 0.15, z: 0.2, size: 0.16, size1: 0.02, life: 0.2, color: 0xeaff9a, vy: 0.4 });
      }
    },

    /* 凝胶滴落（美鼠受击/技能） */
    gelDrip(fx, x, y, n) {
      const P = fx.pool, TX = T.fxTextures;
      for (let i = 0; i < (n || 6); i++) {
        P.emit({ map: TX.gel, x: x + T.rand(-0.3, 0.3), y: y + T.rand(-0.2, 0.3), z: T.rand(-0.2, 0.3),
          size: T.rand(0.08, 0.2), size1: 0.02, sy: T.rand(1, 1.8), life: T.rand(0.35, 0.6), color: 0xa8d84a,
          vx: T.rand(-2, 2), vy: T.rand(1, 3.5), g: -10, drag: 1, spin: T.rand(-4, 4) });
      }
    },

    /* 奶滴飞溅（奶娃必杀） */
    milkSpray(fx, x, y, dir, n) {
      const P = fx.pool, TX = T.fxTextures;
      for (let i = 0; i < (n || 10); i++) {
        const a = T.rand(-0.9, 0.9) + (dir > 0 ? 0 : Math.PI);
        const sp = T.rand(2.5, 7);
        P.emit({ map: TX.milk, x: x, y: y, z: T.rand(-0.2, 0.35),
          size: T.rand(0.09, 0.26), size1: 0.02, life: T.rand(0.3, 0.6),
          color: i % 4 ? 0xfff6e0 : 0xffd24a,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 + 2, vz: T.rand(-1, 1), g: -9, drag: 1.6, spin: T.rand(-5, 5) });
      }
    },

    /* 上升光柱 */
    pillar(fx, x, color, life) {
      const TX = T.fxTextures;
      const grp = fx.group(life || 0.5, function (f, gr, k) {
        const m = gr.meshes[0];
        m.position.set(x, 0.1 + T.easeOut(k) * 1.4, 0.1);
        m.scale.set(0.72 * (1 - k * 0.6), 2.4 * (0.3 + T.easeOut(k) * 0.8), 1);
        m.material.opacity = 0.55 * (1 - k);
        gr.meshes[1].position.set(x, 0.16, 0);
        gr.meshes[1].scale.set(1.6 * (1 + k * 1.8), 1.6 * (1 + k * 1.8) * 0.3, 1);
        gr.meshes[1].material.uniforms.uOpacity.value = (1 - k) * 0.55;
      });
      fx.addSprite(grp, { map: TX.core, size: 0.72, sy: 2.4, color: color || 0xffe28a, opacity: 0.55 });
      fx.addRing(grp, { x: x, y: 0.16, z: 0, rx: -Math.PI / 2, color: "#ffe28a", size: 1.6 });
    },

    /* KO 爆发 */
    koBurst(fx, x, y) {
      FXlib.heavyHit(fx, x, y, 1);
      FXlib.pillar(fx, x, 0xffd24a, 0.8);
      const P = fx.pool, TX = T.fxTextures;
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(3, 10);
        P.emit({ map: TX.star, x: x, y: y, z: T.rand(-0.3, 0.4), size: T.rand(0.08, 0.2), size1: 0.01,
          life: T.rand(0.4, 0.9), color: [0xffd24a, 0xff7a3c, 0xfff2c0][i % 3],
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 3, vz: T.rand(-2, 2), g: -10, drag: 1.4, spin: T.rand(-10, 10) });
      }
      for (let i = 0; i < 3; i++) {
        const grp = fx.group(0.5 + i * 0.12, function (f, gr, k) {
          gr.meshes[0].scale.setScalar(0.28 + T.easeOut(k) * (0.8 + i * 0.34));
          gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.55;
        });
        fx.addRing(grp, { x: x, y: y, z: 0.3, color: i === 1 ? "#ff7a3c" : "#ffd24a", size: 0.28, rx: -Math.PI / 2 + 0.3 });
      }
    },

    /* 必杀演出：角色轮廓闪光环 */
    superIntro(fx, fighter) {
      const grp = fx.group(0.55, function (f, gr, k) {
        for (let i = 0; i < gr.meshes.length; i++) {
          const m = gr.meshes[i];
          const s = 0.4 + T.easeOut(k) * (0.72 + i * 0.34);
          m.scale.set(s, s, 1);
          m.material.uniforms.uOpacity.value = (1 - k) * (0.45 - i * 0.11);
        }
      });
      for (let i = 0; i < 3; i++) {
        fx.addRing(grp, { x: fighter.x, y: fighter.y + 0.8, z: 0.2 - i * 0.1, color: i === 2 ? "#fff2c0" : "#ffd24a", size: 0.4, rx: 0.12 });
      }
      FXlib.chargeAura(fx, fighter, 0.45, 0xfff2c0);
    },

    /* 尾迹（冲刺/弹道） */
    trail(fx, x, y, color) {
      fx.pool.emit({ map: T.fxTextures.dot, x: x, y: y, z: T.rand(-0.15, 0.2),
        size: T.rand(0.12, 0.22), size1: 0.01, life: 0.22, color: color == null ? 0xffd24a : color, vy: T.rand(-0.2, 0.5) });
    },

    /* ============ 高级粒子特效 ============ */

    /* 星尘拖尾：沿运动轨迹撒发光尘 + 残影 */
    starTrail(fx, x, y, dir, color, n) {
      const P = fx.pool, TX = T.fxTextures;
      color = color == null ? 0xffd24a : color;
      for (let i = 0; i < (n || 3); i++) {
        const a = Math.random() * 6.2832, sp = T.rand(0.3, 1.6);
        P.emit({
          map: i % 2 ? TX.star : TX.dot,
          x: x + T.rand(-0.16, 0.16), y: y + T.rand(-0.22, 0.22), z: T.rand(-0.2, 0.3),
          size: T.rand(0.05, 0.16), size1: 0.004, life: T.rand(0.24, 0.5),
          color: i % 3 ? color : 0xfff6e0,
          vx: -dir * sp * 1.4 + Math.cos(a) * 0.4, vy: Math.sin(a) * 0.7 + 0.2, vz: T.rand(-0.4, 0.4),
          g: -1.2, drag: 2.4, spin: T.rand(-7, 7), fadePow: 1.4,
        });
      }
    },

    /* 能量爆裂：多层环 + 光柱 + 核心闪光（必杀命中） */
    energyBurst(fx, x, y, color, power) {
      power = power || 1;
      const P = fx.pool, TX = T.fxTextures;
      color = color == null ? 0xffd24a : color;
      // 核心
      P.emit({ map: TX.core, x: x, y: y, z: 0.34, size: 1.1 * power, size1: 0.06, life: 0.16, color: 0xffffff, opacity: 0.95 });
      P.emit({ map: TX.star, x: x, y: y, z: 0.36, size: 1.5 * power, size1: 0.2, life: 0.22, color: color, spin: 4, opacity: 0.9 });
      // 三层冲击环
      const grp = fx.group(0.42, function (f, gr, k) {
        for (let i = 0; i < 3; i++) {
          const m = gr.meshes[i];
          m.scale.setScalar(0.25 + T.easeOut(k * (1 - i * 0.18)) * (1.1 + i * 0.75) * power);
          m.material.uniforms.uOpacity.value = (1 - k) * (0.7 - i * 0.16);
        }
      });
      for (let i = 0; i < 3; i++) fx.addRing(grp, { x: x, y: y, z: 0.32 - i * 0.05, color: i === 1 ? "#fff6e0" : color, size: 0.25 });
      // 光柱
      FXlib.pillar(fx, x, color, 0.55 * power);
      // 放射粒子雨（三层速度分级）
      for (let i = 0; i < Math.round(30 * power); i++) {
        const a = Math.random() * 6.2832;
        const tier = i % 3;
        const sp = tier === 0 ? T.rand(6, 12) : tier === 1 ? T.rand(3, 6.5) : T.rand(1.5, 3.5);
        P.emit({
          map: tier === 2 ? TX.gel : TX.star,
          x: x, y: y, z: T.rand(-0.4, 0.5),
          size: T.rand(0.06, 0.2) * power, size1: 0.008, life: T.rand(0.32, 0.85),
          color: [color, 0xfff2c0, 0xff8a3c][tier],
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9 + 2.4, vz: T.rand(-2.2, 2.2),
          g: -11, drag: 1.3, spin: T.rand(-14, 14), fadePow: 1.25,
        });
      }
      // 速度线
      FXlib.speedLines(fx, 0.28 * power);
    },

    /* 空冲击波：正面推进的半透明弧面（拳压/重击） */
    airShock(fx, x, y, dir, color, size) {
      const TX = T.fxTextures;
      size = size || 1;
      const grp = fx.group(0.26, function (f, gr, k) {
        const m = gr.meshes[0];
        const s = (0.5 + T.easeOut(k) * 1.9) * size;
        m.scale.set(s * 0.55, s, 1);
        m.material.opacity = 0.5 * (1 - k) * (k < 0.12 ? k / 0.12 : 1);
        m.position.x = x + dir * T.easeOut(k) * 0.7 * size;
      });
      const m = fx.addSprite(grp, { map: TX.arc, x: x, y: y, z: 0.3, size: 0.5 * size, color: color || 0xfff2c0, opacity: 0.5, rot: dir > 0 ? -1.2 : 1.2 + Math.PI });
      m.material.rotation = dir > 0 ? -1.35 : 1.35;
    },

    /* 螺旋上升粒子（旋风/升龙） */
    helixRise(fx, fighter, dur, opt) {
      opt = opt || {};
      const P = fx.pool, TX = T.fxTextures;
      const color = opt.color == null ? 0xffd24a : opt.color;
      fx.group(dur, function (f, gr, k, dt) {
        const spawn = Math.min(10, Math.round((opt.rate || 4) * (0.7 + k)));
        for (let i = 0; i < spawn; i++) {
          const phase = k * (opt.turns || 9) * 6.2832;
          const a = phase + i * 6.2832 / Math.max(1, spawn);
          const rise = opt.rise == null ? 1.35 : opt.rise;
          const h = (k * rise + i / Math.max(1, spawn) * 0.22) % 1;
          const rad = (opt.radius == null ? 0.62 : opt.radius) * (1 - h * 0.52) * (1 + Math.sin(k * 22) * 0.06);
          P.emit({
            map: i % 2 ? TX.star : TX.dot,
            x: fighter.x + Math.cos(a) * rad,
            y: fighter.y + 0.1 + h * 1.5,
            z: Math.sin(a) * rad * 0.72,
            size: T.rand(0.07, 0.19), size1: 0.008, life: T.rand(0.24, 0.46),
            color: i % 4 ? color : 0xfff6e0,
            vx: Math.cos(a + 1.57) * 1.1, vy: T.rand(0.8, 2.6), vz: Math.sin(a + 1.57) * 0.6,
            g: -0.8, drag: 1.1, spin: T.rand(-8, 8), fadePow: 1.3,
          });
        }
        if (Math.random() < 0.5) {
          P.emit({ map: TX.ring, x: fighter.x, y: fighter.y + 0.3 + Math.random() * 1.3, z: 0.1,
            size: T.rand(0.2, 0.5), size1: 0.9, life: 0.3, color: color, opacity: 0.4, spin: T.rand(-3, 3), fadePow: 1.6 });
        }
      });
    },

    /* 地面能量纹：贴地扩散的金色脉络（重击落点） */
    groundGlyph(fx, x, color, scale) {
      const TX = T.fxTextures;
      color = color || 0xffd24a;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: TX.crack, color: color, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * 6.28;
      m.position.set(x, 0.142, 0.1);
      m.scale.setScalar(scale || 2.2);
      fx.scene.add(m);
      fx.decals.push({ mesh: m, t: 0, life: 1.5 });
      const grp = fx.group(0.4, function (f, gr, k) {
        const g = gr.meshes[0];
        g.material.opacity = 0.9 * (1 - k);
        g.scale.setScalar((scale || 2.2) * (0.6 + T.easeOut(k) * 0.55));
        g.material.rotation += 0.004;
      });
      fx.addSprite(grp, { map: TX.crack, x: x, y: 0.15, z: 0.1, size: (scale || 2.2) * 0.6, color: color, opacity: 0.9 });
    },

    /* 奶龙必杀：双元素龙吼 —— 火柱 + 冰环 + 龙首 + 地面崩裂 */
    dragonRoar(fx, fighter, dur) {
      const P = fx.pool, TX = T.fxTextures;
      const x = fighter.x, y = fighter.y + 0.95;
      const life = dur || 1.05;
      FXlib.superIntro(fx, fighter);
      FXlib.chargeGather(fx, fighter, life, 0xfff0a0);
      FXlib.chargeGather(fx, fighter, life * 0.8, 0xff7a1a);
      FXlib.pillar(fx, x, 0xffe28a, 1.65);
      FXlib.pillar(fx, x, 0xff6a10, 1.15);
      FXlib.helixRise(fx, fighter, life, { color: 0xff7a1a, radius: 1.05, turns: 22, rise: 2.4, rate: 12 });
      FXlib.helixRise(fx, fighter, life, { color: 0x6ad0ff, radius: 0.72, turns: 18, rise: 2.1, rate: 9 });
      FXlib.speedLines(fx, 1.35);
      FXlib.groundGlyph(fx, x, 0xff5a10, 4.6);
      FXlib.frostGlyph(fx, x, 3.4);
      FXlib.energyBurst(fx, x, y, 0xff9a28, 1.85);
      FXlib.dragonHeadBlast(fx, x + fighter.facing * 0.55, y + 0.2, fighter.facing, "fire");
      FXlib.dragonHeadBlast(fx, x + fighter.facing * 0.4, y - 0.25, fighter.facing, "ice");
      const grp = fx.group(1.15, function (f, gr, k) {
        for (let i = 0; i < gr.meshes.length; i++) {
          const m = gr.meshes[i];
          const s = 0.7 + T.easeOut(k) * (3.2 + i * 0.85);
          m.scale.set(s, s * 0.52, 1);
          m.material.uniforms.uOpacity.value = (1 - k) * (0.88 - i * 0.1);
          m.position.x = x;
          m.position.y = y + Math.sin(k * 14 + i) * 0.12;
        }
      });
      for (let i = 0; i < 7; i++) {
        fx.addRing(grp, { x: x, y: y, z: 0.28 - i * 0.07, color: i % 3 === 0 ? "#fff6d0" : i % 3 === 1 ? "#ff7a1a" : "#6ad0ff", size: 0.62, rx: 0.04 });
      }
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * 6.2832;
        const fire = i % 2 === 0;
        P.emit({
          map: fire ? (i % 4 ? TX.flame : TX.star) : (i % 4 ? TX.ice : TX.snow),
          x: x, y: y, z: Math.sin(a) * 0.35,
          size: T.rand(0.12, 0.42), size1: 0.02, life: T.rand(0.6, 1.25),
          color: fire ? [0xfff6e0, 0xff7a1a, 0xffc14a][i % 3] : [0xd8f6ff, 0x3ab8ff, 0xffffff][i % 3],
          vx: Math.cos(a) * T.rand(4, 13), vy: T.rand(3, 11), vz: Math.sin(a) * T.rand(1.4, 5),
          g: -9, drag: 0.9, spin: T.rand(-16, 16), fadePow: 1.1, sy: T.rand(0.9, 1.5),
        });
      }
    },

    /* 龙首/冰冠迎面炸开 */
    dragonHeadBlast(fx, x, y, dir, element) {
      const P = fx.pool, TX = T.fxTextures;
      const fire = element !== "ice";
      const c1 = fire ? 0xff7a1a : 0x3ab8ff;
      const c2 = fire ? 0xfff2c0 : 0xd8f6ff;
      P.emit({
        map: fire ? TX.dragonHead : TX.snow,
        x: x + dir * 0.28, y: y, z: 0.34,
        size: fire ? 2.15 : 1.7, size1: 0.42, life: 0.48, color: c2, opacity: 0.96,
        vx: dir * 1.6, spin: fire ? 1.4 : 9, fadePow: 1.15,
      });
      P.emit({ map: TX.star, x: x, y: y, z: 0.36, size: 1.85, size1: 0.22, life: 0.3, color: c1, spin: 12, opacity: 0.95 });
      P.emit({ map: TX.core, x: x, y: y, z: 0.3, size: 1.4, size1: 0.12, life: 0.2, color: 0xffffff, opacity: 1 });
      const grp = fx.group(0.46, function (f, gr, k) {
        gr.meshes[0].scale.setScalar(0.32 + T.easeOut(k) * 1.9);
        gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.9;
        gr.meshes[1].scale.setScalar(0.2 + T.easeOut(k) * 1.2);
        gr.meshes[1].material.uniforms.uOpacity.value = (1 - k) * 0.65;
        gr.meshes[0].position.x = x + dir * T.easeOut(k) * 0.55;
      });
      fx.addRing(grp, { x: x, y: y, z: 0.3, color: c1, size: 0.32 });
      fx.addRing(grp, { x: x, y: y, z: 0.26, color: c2, size: 0.2 });
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(3.5, 11);
        P.emit({
          map: fire ? (i % 2 ? TX.flame : TX.ember) : (i % 2 ? TX.ice : TX.snow),
          x: x, y: y, z: T.rand(-0.3, 0.35),
          size: T.rand(0.08, 0.28), size1: 0.008, life: T.rand(0.32, 0.72),
          color: i % 3 ? c1 : c2,
          vx: Math.cos(a) * sp + dir * 2.4, vy: Math.sin(a) * sp + 1.6, vz: T.rand(-1.8, 1.8),
          g: fire ? -10 : -5, drag: 1.2, spin: T.rand(-22, 22), fadePow: 1.2, sy: T.rand(0.85, 1.5),
        });
      }
    },

    /* 贴身元素风暴（招式持续期间环绕） */
    elementStorm(fx, fighter, element, dur) {
      const P = fx.pool, TX = T.fxTextures;
      const fire = element !== "ice";
      const c1 = fire ? 0xff7a1a : 0x3ab8ff;
      const c2 = fire ? 0xffe08a : 0xd8f6ff;
      fx.group(dur || 0.7, function (f, gr, k) {
        for (let i = 0; i < 7; i++) {
          const a = k * 22 + i * 0.9;
          const rad = 0.55 + Math.sin(k * 16 + i) * 0.18;
          P.emit({
            map: fire ? TX.flame : TX.ice,
            x: fighter.x + Math.cos(a) * rad,
            y: fighter.y + 0.25 + ((k * 1.8 + i * 0.12) % 1.6),
            z: Math.sin(a) * rad * 0.7,
            size: T.rand(0.16, 0.38), size1: 0.02, sy: T.rand(0.9, 1.55),
            life: T.rand(0.18, 0.34), opacity: 0.82,
            color: i % 2 ? c1 : c2,
            vx: Math.cos(a + 1.4) * 1.6, vy: T.rand(0.8, 2.8), vz: Math.sin(a + 1.4) * 0.8,
            g: -1, drag: 1, spin: T.rand(-14, 14), fadePow: 1.25,
          });
        }
      });
    },

    milkNova(fx, x, y, power) {
      power = power || 1;
      FXlib.energyBurst(fx, x, y, 0xffe08a, 1.35 * power);
      FXlib.milkSpray(fx, x, y, 1, 16);
      FXlib.milkSpray(fx, x, y, -1, 16);
      FXlib.gelDrip(fx, x, y, 18);
      FXlib.groundGlyph(fx, x, 0xffe08a, 2.8 * power);
    },

    meteorTrail(fx, fighter, dur) {
      const P = fx.pool, TX = T.fxTextures;
      fx.group(dur, function (f, gr, k) {
        for (let i = 0; i < 5; i++) {
          P.emit({
            map: i % 2 ? TX.core : TX.star,
            x: fighter.x + T.rand(-0.2, 0.2),
            y: fighter.y + 0.4 + T.rand(0, 0.9),
            z: T.rand(-0.2, 0.25),
            size: T.rand(0.12, 0.28), size1: 0.02, life: 0.28,
            color: i % 2 ? 0xfff6e0 : 0xffd24a,
            vy: T.rand(0.2, 1.4), g: -2, spin: T.rand(-6, 6),
          });
        }
      });
    },

    /* 蓄力粒子汇聚（必杀前摇，从外圈吸入） */
    chargeGather(fx, fighter, dur, color) {
      const P = fx.pool, TX = T.fxTextures;
      color = color == null ? 0xffd24a : color;
      fx.group(dur, function (f, gr, k) {
        const rate = 7 + k * 12;
        for (let i = 0; i < rate; i++) {
          const a = Math.random() * 6.2832;
          const rad = T.rand(1.1, 2.4) * (1 - k * 0.35);
          const py = fighter.y + 0.35 + Math.random() * 1.4;
          const px = fighter.x + Math.cos(a) * rad;
          const pz = Math.sin(a) * rad * 0.6;
          P.emit({
            map: i % 3 === 0 ? TX.star : TX.dot,
            x: px, y: py, z: pz,
            size: T.rand(0.05, 0.15), size1: 0.004, life: 0.26,
            color: i % 3 === 1 ? 0xfff6e0 : color,
            vx: (fighter.x - px) * 3.6, vy: (fighter.y + 0.85 - py) * 3.6, vz: (0 - pz) * 3.0,
            g: 0, drag: 0, spin: T.rand(-9, 9), fadePow: 1.2,
          });
        }
      });
    },

    /* ==========================================================
       火焰波 · 史诗级
       七层叠加：白热核心 / 焰舌群 / 螺旋焰环 / 余烬风暴 /
                热浪雾 / 地面焦痕 / 龙息冲击环
       ========================================================== */
    fireWave(fx, x, y, dir, power) {
      const P = fx.pool, TX = T.fxTextures;
      power = (power || 1) * 1.35;
      // ① 白热核心
      P.emit({ map: TX.core, x: x, y: y, z: 0.2, size: 0.72 * power, size1: 0.16 * power, life: 0.2, color: 0xffc040, opacity: 0.98, vx: dir * 1.6 });
      P.emit({ map: TX.core, x: x, y: y, z: 0.24, size: 0.34 * power, size1: 0.05, life: 0.15, color: 0xffffff, opacity: 1 });
      P.emit({ map: TX.dragonHead, x: x + dir * 0.18, y: y + 0.08, z: 0.28, size: 0.95 * power, size1: 0.22, life: 0.22, color: 0xfff2c0, opacity: 0.75, vx: dir * 2.2, spin: 1.2 });
      // ② 焰舌群（多个不同朝向的火焰）
      for (let i = 0; i < 14; i++) {
        const back = T.rand(0, 0.34), side = T.rand(-0.2, 0.2);
        P.emit({
          map: TX.flame,
          x: x - dir * back, y: y + side * 1.3, z: T.rand(-0.22, 0.24),
          size: T.rand(0.3, 0.62) * power, size1: T.rand(0.05, 0.14), sy: T.rand(0.8, 1.5),
          life: T.rand(0.18, 0.4), opacity: T.rand(0.55, 0.9),
          color: i % 3 === 0 ? 0xffe08a : i % 3 === 1 ? 0xff8a1a : 0xff5a10,
          vx: dir * T.rand(1.2, 4.6), vy: T.rand(-0.5, 2.6), vz: T.rand(-1, 1),
          g: -3, drag: 1.5, spin: T.rand(-12, 12), rot: T.rand(-0.5, 0.5), fadePow: 1.3,
        });
      }
      // ③ 螺旋焰环（绕轴旋转的火环）
      const grp = fx.group(0.34, function (f, gr, k) {
        for (let i = 0; i < 3; i++) {
          const m = gr.meshes[i];
          m.position.set(x + dir * T.easeOut(k) * 0.5, y, 0.06 - i * 0.05);
          m.material.rotation += (i % 2 ? -0.3 : 0.3) * (1 + i * 0.4);
          const s = (0.36 + i * 0.24) * power * (0.55 + T.easeOut(k) * 1.5);
          m.scale.set(s, s, 1);
          m.material.opacity = (1 - k) * (0.7 - i * 0.16);
        }
      });
      for (let i = 0; i < 3; i++) {
        fx.addSprite(grp, { map: TX.ring, x: x, y: y, z: 0.06 - i * 0.05, size: 0.36 + i * 0.24, color: i === 0 ? "#fff2c0" : i === 1 ? "#ff9a2a" : "#ff4a08", opacity: 0.7, spin: i % 2 ? -4 : 4 });
      }
      // ④ 余烬风暴
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(1.8, 6.5);
        P.emit({
          map: i % 2 ? TX.ember : TX.star,
          x: x + T.rand(-0.2, 0.2), y: y + T.rand(-0.2, 0.3), z: T.rand(-0.24, 0.26),
          size: T.rand(0.05, 0.16) * power, size1: 0.004, life: T.rand(0.24, 0.62),
          color: i % 3 ? 0xff9a28 : 0xfff2c0,
          vx: Math.cos(a) * sp * 0.6 + dir * T.rand(1.6, 5), vy: Math.sin(a) * sp * 0.5 + T.rand(0.4, 2.6), vz: T.rand(-1.2, 1.2),
          g: -5, drag: 1.1, spin: T.rand(-16, 16), fadePow: 1.4,
        });
      }
      // ⑤ 热浪雾
      for (let i = 0; i < 8; i++) {
        P.emit({
          map: TX.heat, x: x - dir * T.rand(0, 0.4), y: y + T.rand(-0.2, 0.3), z: T.rand(-0.1, 0.2),
          size: T.rand(0.38, 0.78) * power, size1: T.rand(0.9, 1.4) * power, life: T.rand(0.34, 0.62),
          opacity: 0.48, color: 0xff8a3a, vx: dir * T.rand(0.6, 2.4), vy: T.rand(0.8, 2.4), g: 0.6, drag: 1.2, fadePow: 1.6,
        });
      }
      // ⑥ 地面焦痕（重波才铺，避免轻波每帧刷地纹）
      if (power >= 1.5 && T.FXlib.groundGlyph) T.FXlib.groundGlyph(fx, x - dir * 0.1, 0xff5a10, 1.35 * power);
    },
    fireBurst(fx, x, y, dir) {
      const P = fx.pool, TX = T.fxTextures;
      // 核心闪光 + 大星芒 + 龙首
      P.emit({ map: TX.core, x: x, y: y, z: 0.3, size: 1.15, size1: 0.12, life: 0.2, color: 0xfff6d8, opacity: 1 });
      P.emit({ map: TX.star, x: x, y: y, z: 0.32, size: 1.45, size1: 0.18, life: 0.26, color: 0xffc85a, spin: 7, opacity: 0.95 });
      P.emit({ map: TX.dragonHead, x: x + dir * 0.2, y: y + 0.1, z: 0.34, size: 1.55, size1: 0.28, life: 0.32, color: 0xfff2c0, opacity: 0.9, vx: dir * 1.4, spin: 1.5 });
      // 爆发焰舌
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(2, 7);
        P.emit({
          map: TX.flame, x: x, y: y, z: 0.28,
          size: T.rand(0.24, 0.5), size1: 0.05, sy: T.rand(0.9, 1.6), life: T.rand(0.2, 0.42),
          opacity: T.rand(0.6, 0.95), color: i % 3 === 0 ? 0xffe9a0 : 0xff6a18,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1.6, vz: T.rand(-1.4, 1.4),
          g: -7, drag: 1.8, spin: T.rand(-14, 14), rot: T.rand(-0.6, 0.6), fadePow: 1.3,
        });
      }
      // 余烬雨
      for (let i = 0; i < 32; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(3, 10);
        P.emit({
          map: i % 2 ? TX.ember : TX.dot, x: x, y: y, z: 0.26,
          size: T.rand(0.06, 0.16), size1: 0.006, life: T.rand(0.26, 0.62),
          color: i % 3 ? 0xff6a18 : 0xffe9a0,
          vx: Math.cos(a) * sp + dir * 2, vy: Math.sin(a) * sp + 1.6, vz: T.rand(-1.5, 1.5),
          g: -11, drag: 1.6, spin: T.rand(-18, 18), fadePow: 1.3,
        });
      }
      // 双层冲击环 + 地面焦纹
      const grp = fx.group(0.34, function (f, gr, k) {
        gr.meshes[0].scale.setScalar(0.2 + T.easeOut(k) * 1.15);
        gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.85;
        gr.meshes[1].scale.setScalar(0.14 + T.easeOut(k) * 0.7);
        gr.meshes[1].material.uniforms.uOpacity.value = (1 - k) * 0.6;
      });
      fx.addRing(grp, { x: x, y: y, z: 0.3, color: "#ff7a1a", size: 0.2 });
      fx.addRing(grp, { x: x, y: y, z: 0.26, color: "#fff2c0", size: 0.14 });
      if (T.FXlib.groundGlyph) T.FXlib.groundGlyph(fx, x, 0xff5a10, 2.1);
      T.FXlib.speedLines(fx, 0.42);
    },
    fireTrail(fx, x, y, dir) {
      const P = fx.pool, TX = T.fxTextures;
      P.emit({
        map: TX.flame, x: x - dir * 0.16, y: y + T.rand(-0.12, 0.14), z: T.rand(-0.12, 0.14),
        size: T.rand(0.28, 0.52), size1: 0.04, sy: T.rand(0.9, 1.6), life: T.rand(0.2, 0.38),
        opacity: 0.82, color: T.rand(0, 1) < 0.4 ? 0xffe08a : 0xff7a1a,
        vx: -dir * T.rand(0.6, 1.8), vy: T.rand(0.6, 2.4), g: -2, drag: 1.4, spin: T.rand(-10, 10), fadePow: 1.3,
      });
      P.emit({
        map: TX.ember, x: x + T.rand(-0.12, 0.12), y: y + T.rand(-0.12, 0.14), z: T.rand(-0.14, 0.14),
        size: T.rand(0.07, 0.16), size1: 0.004, life: T.rand(0.24, 0.48),
        color: 0xffb040, vx: -dir * T.rand(0.7, 2.6), vy: T.rand(0.7, 2.8), g: -4, drag: 1.2, spin: T.rand(-12, 12),
      });
      if (Math.random() < 0.55) {
        P.emit({ map: TX.heat, x: x - dir * 0.28, y: y, z: 0, size: 0.32, size1: 0.68, life: 0.34, opacity: 0.38, color: 0xff8a3a, vy: 1.0, drag: 1.4, fadePow: 1.6 });
      }
      if (Math.random() < 0.35) {
        P.emit({ map: TX.star, x: x, y: y, z: T.rand(-0.1, 0.1), size: T.rand(0.08, 0.16), size1: 0.004, life: 0.22, color: 0xfff2c0, vx: -dir * 1.2, vy: 1.4, spin: 8 });
      }
    },

    /* ==========================================================
       寒冰波 · 史诗级（高饱和冷蓝层 + 霜雾 + 晶簇 + 极寒环）
       ========================================================== */
    iceWave(fx, x, y, dir, power) {
      const P = fx.pool, TX = T.fxTextures;
      power = (power || 1) * 1.35;
      // ① 冷光底盘：大范围蓝色辉光（整体染蓝）
      P.emit({ map: TX.core, x: x, y: y, z: 0.08, size: 2.05 * power, size1: 0.55, life: 0.36, color: 0x1a6ae0, opacity: 0.62, vx: dir * 0.8 });
      // ② 晶核（高饱和蓝）
      P.emit({ map: TX.core, x: x, y: y, z: 0.2, size: 0.52 * power, size1: 0.14 * power, life: 0.18, color: 0x3ab8ff, opacity: 0.98, vx: dir * 1.2 });
      P.emit({ map: TX.core, x: x, y: y, z: 0.24, size: 0.22 * power, size1: 0.04, life: 0.13, color: 0xd8f6ff, opacity: 1 });
      // ③ 冰晶簇
      for (let i = 0; i < 14; i++) {
        const back = T.rand(0, 0.3), side = T.rand(-0.22, 0.22);
        P.emit({
          map: TX.ice,
          x: x - dir * back, y: y + side * 1.2, z: T.rand(-0.2, 0.22),
          size: T.rand(0.26, 0.55) * power, size1: T.rand(0.04, 0.12), sy: T.rand(0.9, 1.5),
          life: T.rand(0.2, 0.44), opacity: T.rand(0.7, 1),
          color: i % 4 === 0 ? 0xd8f6ff : i % 4 === 1 ? 0x3ab8ff : i % 4 === 2 ? 0x1a7ae0 : 0x6ad0ff,
          vx: dir * T.rand(1, 4), vy: T.rand(-0.4, 2.2), vz: T.rand(-0.9, 0.9),
          g: -2, drag: 1.6, spin: T.rand(-20, 20), rot: T.rand(-0.6, 0.6), fadePow: 1.3,
        });
      }
      // ④ 霜环（三层冷蓝旋转环）
      const grp = fx.group(0.38, function (f, gr, k) {
        for (let i = 0; i < 3; i++) {
          const m = gr.meshes[i];
          m.position.set(x + dir * T.easeOut(k) * 0.45, y, 0.06 - i * 0.05);
          m.material.rotation += (i % 2 ? 0.42 : -0.42) * (1 + i * 0.3);
          const s = (0.34 + i * 0.24) * power * (0.55 + T.easeOut(k) * 1.5);
          m.scale.set(s, s, 1);
          m.material.opacity = (1 - k) * (0.8 - i * 0.16);
        }
      });
      fx.addSprite(grp, { map: TX.ring, x: x, y: y, z: 0.06, size: 0.34 * power, color: "#3ab8ff", opacity: 0.8, spin: 5 });
      fx.addSprite(grp, { map: TX.ring, x: x, y: y, z: 0.01, size: 0.58 * power, color: "#1a7ae0", opacity: 0.65, spin: -5 });
      fx.addSprite(grp, { map: TX.ring, x: x, y: y, z: -0.04, size: 0.82 * power, color: "#0a4ab8", opacity: 0.5, spin: 4 });
      // ⑤ 雪花旋舞
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(1.6, 5.8);
        P.emit({
          map: i % 2 ? TX.snow : TX.ice,
          x: x + T.rand(-0.22, 0.22), y: y + T.rand(-0.22, 0.3), z: T.rand(-0.22, 0.24),
          size: T.rand(0.09, 0.24) * power, size1: 0.006, life: T.rand(0.28, 0.66),
          color: i % 3 ? 0x3ab8ff : 0xd8f6ff,
          vx: Math.cos(a) * sp * 0.6 + dir * T.rand(1.2, 4), vy: Math.sin(a) * sp * 0.5 + T.rand(0.3, 2), vz: T.rand(-1.1, 1.1),
          g: -3, drag: 1.3, spin: T.rand(-24, 24), fadePow: 1.3,
        });
      }
      // ⑥ 霜雾（冷蓝）
      for (let i = 0; i < 6; i++) {
        P.emit({
          map: TX.frost, x: x - dir * T.rand(0, 0.4), y: y + T.rand(-0.24, 0.32), z: T.rand(-0.16, 0.2),
          size: T.rand(0.34, 0.7) * power, size1: T.rand(0.8, 1.25) * power, life: T.rand(0.32, 0.62),
          opacity: 0.5, color: 0x6ad0ff, vx: dir * T.rand(0.5, 1.8), vy: T.rand(0.4, 1.4), g: -0.5, drag: 1.2, fadePow: 1.6,
        });
      }
      // ⑦ 冰霜地纹
      if (power >= 1.5 && T.FXlib.frostGlyph) T.FXlib.frostGlyph(fx, x - dir * 0.1, 1.35 * power);
    },
    iceBurst(fx, x, y, dir) {
      const P = fx.pool, TX = T.fxTextures;
      // 冷光底盘
      P.emit({ map: TX.core, x: x, y: y, z: 0.16, size: 1.7, size1: 0.5, life: 0.32, color: 0x1a6ae0, opacity: 0.5 });
      P.emit({ map: TX.core, x: x, y: y, z: 0.3, size: 0.8, size1: 0.1, life: 0.16, color: 0x3ab8ff, opacity: 1 });
      P.emit({ map: TX.snow, x: x, y: y, z: 0.32, size: 0.95, size1: 0.12, life: 0.28, color: 0x9ee8ff, spin: 6, opacity: 0.9 });
      P.emit({ map: TX.core, x: x, y: y, z: 0.34, size: 1.35, size1: 0.18, life: 0.22, color: 0xffffff, opacity: 0.95 });
      // 冰晶爆散
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(2, 8);
        P.emit({
          map: TX.ice, x: x, y: y, z: 0.28,
          size: T.rand(0.22, 0.5), size1: 0.04, sy: T.rand(0.9, 1.6), life: T.rand(0.22, 0.46),
          opacity: T.rand(0.75, 1), color: i % 3 === 0 ? 0x3ab8ff : i % 3 === 1 ? 0x1a7ae0 : 0xd8f6ff,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 1.2, vz: T.rand(-1.3, 1.3),
          g: -5, drag: 1.5, spin: T.rand(-22, 22), rot: T.rand(-0.7, 0.7), fadePow: 1.3,
        });
      }
      // 碎冰与雪
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(2.6, 9);
        P.emit({
          map: i % 2 ? TX.snow : TX.star, x: x, y: y, z: 0.24,
          size: T.rand(0.08, 0.22), size1: 0.006, life: T.rand(0.28, 0.66),
          color: i % 3 ? 0x3ab8ff : 0xd8f6ff,
          vx: Math.cos(a) * sp + dir * 1.4, vy: Math.sin(a) * sp + 1, vz: T.rand(-1.2, 1.2),
          g: -6, drag: 1.4, spin: T.rand(-26, 26), fadePow: 1.3,
        });
      }
      // 寒霜冲击环（蓝）
      const grp = fx.group(0.38, function (f, gr, k) {
        gr.meshes[0].scale.setScalar(0.18 + T.easeOut(k) * 1.15);
        gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.85;
        gr.meshes[1].scale.setScalar(0.12 + T.easeOut(k) * 0.7);
        gr.meshes[1].material.uniforms.uOpacity.value = (1 - k) * 0.6;
      });
      fx.addRing(grp, { x: x, y: y, z: 0.3, color: "#3ab8ff", size: 0.18 });
      fx.addRing(grp, { x: x, y: y, z: 0.26, color: "#d8f6ff", size: 0.12 });
      if (T.FXlib.frostGlyph) T.FXlib.frostGlyph(fx, x, 2.0);
      T.FXlib.speedLines(fx, 0.42);
    },
    iceTrail(fx, x, y, dir) {
      const P = fx.pool, TX = T.fxTextures;
      P.emit({
        map: TX.frost, x: x - dir * 0.16, y: y, z: 0, size: 0.52, size1: 1.05, life: 0.36,
        opacity: 0.5, color: 0x3ab8ff, vx: -dir * 0.6, vy: 0.5, drag: 1.3, fadePow: 1.6,
      });
      P.emit({
        map: TX.ice, x: x - dir * 0.14, y: y + T.rand(-0.12, 0.14), z: T.rand(-0.12, 0.12),
        size: T.rand(0.24, 0.46), size1: 0.02, sy: T.rand(0.9, 1.55), life: T.rand(0.22, 0.4),
        opacity: 0.88, color: T.rand(0, 1) < 0.4 ? 0xd8f6ff : 0x3ab8ff,
        vx: -dir * T.rand(0.5, 1.5), vy: T.rand(0.3, 1.8), g: -1.5, drag: 1.4, spin: T.rand(-20, 20), fadePow: 1.3,
      });
      P.emit({
        map: TX.snow, x: x + T.rand(-0.12, 0.12), y: y + T.rand(-0.12, 0.14), z: T.rand(-0.12, 0.12),
        size: T.rand(0.08, 0.18), size1: 0.004, life: T.rand(0.26, 0.54),
        color: 0x9ee8ff, vx: -dir * T.rand(0.6, 2.2), vy: T.rand(0.4, 1.9), g: -2, drag: 1.3, spin: T.rand(-22, 22),
      });
    },

    /* ==========================================================
       升龙拳：贴地爆发 → 螺旋升腾 → 顶点龙首/冰晶冠 + 冲击环
       opts.element: "fire" | "ice" | "gel"
       ========================================================== */
    risingDragon(fx, fighter, opts) {
      opts = opts || {};
      const P = fx.pool, TX = T.fxTextures;
      const el = opts.element || "fire";
      const fire = el === "fire", ice = el === "ice";
      const c1 = fire ? 0xff8a1a : ice ? 0x3ab8ff : 0xd8ff9a;
      const c2 = fire ? 0xfff2c0 : ice ? 0xd8f6ff : 0xfff6d8;
      const dur = opts.dur || 0.62;
      const isHead = fire ? TX.dragonHead : ice ? TX.snow : TX.gel;
      const x0 = fighter.x, dir = fighter.facing;

      // ① 起手：贴地爆裂环 + 地纹
      const grpG = fx.group(0.4, function (f, gr, k) {
        gr.meshes[0].scale.setScalar(0.3 + T.easeOut(k) * 1.5);
        gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.85;
        gr.meshes[0].position.x = x0;
      });
      fx.addRing(grpG, { x: x0, y: 0.16, z: 0, rx: -Math.PI / 2, color: c1, size: 0.3 });
      if (fire && T.FXlib.groundGlyph) T.FXlib.groundGlyph(fx, x0, 0xff5a10, 1.8);
      if (ice && T.FXlib.frostGlyph) T.FXlib.frostGlyph(fx, x0, 1.7);

      // ② 升腾：螺旋粒子柱（跟随角色上升）
      fx.group(dur, function (f, gr, k) {
        const h = fighter.y + 0.12;
        const turns = k * 16;
        for (let i = 0; i < 9; i++) {
          const a = turns + i * 6.2832 / 9;
          const lift = 0.12 + ((k * 1.5 + i * 0.16) % 1) * 1.5;
          const rad = (0.42 - lift * 0.14) * (1 + Math.sin(k * 26) * 0.1);
          P.emit({
            map: fire ? TX.flame : ice ? TX.ice : TX.dot,
            x: fighter.x + Math.cos(a) * rad,
            y: h + lift,
            z: Math.sin(a) * rad * 0.7,
            size: T.rand(0.16, 0.34), size1: 0.02, sy: T.rand(0.9, 1.4),
            life: T.rand(0.2, 0.4), opacity: T.rand(0.6, 0.95),
            color: i % 2 ? c1 : c2,
            vx: Math.cos(a + 1.57) * 1.5, vy: T.rand(1.6, 3.6), vz: Math.sin(a + 1.57) * 0.9,
            g: -0.6, drag: 1.1, spin: T.rand(-16, 16), rot: T.rand(-0.5, 0.5), fadePow: 1.3,
          });
        }
        // 余烬 / 雪花
        if (Math.random() < 0.85) {
          P.emit({
            map: fire ? TX.ember : ice ? TX.snow : TX.dot,
            x: fighter.x + T.rand(-0.3, 0.3), y: h + T.rand(0.2, 1.6), z: T.rand(-0.24, 0.24),
            size: T.rand(0.06, 0.16), size1: 0.004, life: T.rand(0.26, 0.6),
            color: c2, vx: T.rand(-1.4, 1.4), vy: T.rand(1.2, 3), vz: T.rand(-0.8, 0.8),
            g: -3, drag: 1.2, spin: T.rand(-20, 20),
          });
        }
      });

      // ③ 上升光柱
      const grpP = fx.group(dur * 0.9, function (f, gr, k) {
        const m = gr.meshes[0];
        m.position.set(fighter.x, fighter.y + 0.12 + T.easeOut(k) * 1.7, 0.08);
        m.scale.set(0.62 * (1 - k * 0.5), 2.7 * (0.35 + T.easeOut(k) * 0.9), 1);
        m.material.opacity = 0.6 * (1 - k);
      });
      fx.addSprite(grpP, { map: TX.core, size: 0.62, sy: 2.7, color: c1, opacity: 0.6 });

      // ④ 顶点：龙首 / 冰冠 + 双层冲击环
      setTimeout(function () {
        const hx = fighter.x, hy = fighter.y + 1.55;
        P.emit({ map: isHead, x: hx, y: hy, z: 0.24, size: 2.25, size1: 0.4, life: 0.42, color: c2, opacity: 0.98, spin: fire ? 2 : 8 });
        P.emit({ map: TX.star, x: hx, y: hy, z: 0.28, size: 1.65, size1: 0.18, life: 0.3, color: c2, spin: 10, opacity: 0.95 });
        P.emit({ map: TX.core, x: hx, y: hy, z: 0.22, size: 1.3, size1: 0.12, life: 0.22, color: 0xffffff, opacity: 1 });
        const grp2 = fx.group(0.4, function (f, gr, k) {
          gr.meshes[0].scale.setScalar(0.25 + T.easeOut(k) * 1.5);
          gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.85;
          gr.meshes[1].scale.setScalar(0.18 + T.easeOut(k) * 0.95);
          gr.meshes[1].material.uniforms.uOpacity.value = (1 - k) * 0.6;
        });
        fx.addRing(grp2, { x: hx, y: hy, z: 0.26, color: c1, size: 0.25 });
        fx.addRing(grp2, { x: hx, y: hy, z: 0.22, color: c2, size: 0.18 });
        for (let i = 0; i < (fire ? 28 : 24); i++) {
          const a = Math.random() * 6.2832, sp = T.rand(3, 9);
          P.emit({
            map: fire ? TX.ember : ice ? TX.snow : TX.star, x: hx, y: hy, z: 0.24,
            size: T.rand(0.07, 0.2), size1: 0.006, life: T.rand(0.3, 0.7),
            color: i % 3 ? c1 : c2,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9 + 1.4, vz: T.rand(-1.6, 1.6),
            g: -8, drag: 1.5, spin: T.rand(-20, 20), fadePow: 1.3,
          });
        }
        T.FXlib.speedLines(fx, 0.3);
      }, Math.round(dur * 520));
    },

    /* 蓄力波：手心聚能光球（随蓄力等级膨胀变色） */
    chargeOrb(fx, fighter, level, element) {
      const TX = T.fxTextures;
      const fire = element === "fire";
      const c1 = fire ? 0xff7a1a : 0x7ad0ff;
      const c2 = fire ? 0xfff2c0 : 0xffffff;
      const g = fx.group(0.999, function (f, gr, k) {
        const lv = gr.level == null ? level : gr.level;
        const s = (0.24 + lv * 0.42) * (1 + Math.sin(k * 30) * 0.07);
        const ox = fighter.x + fighter.facing * (0.5 + lv * 0.12);
        const oy = fighter.y + 0.95;
        gr.meshes[0].position.set(ox, oy, 0.26);
        gr.meshes[0].scale.setScalar(s);
        gr.meshes[0].material.opacity = 0.75 + lv * 0.2;
        gr.meshes[1].position.set(ox, oy, 0.3);
        gr.meshes[1].scale.setScalar(s * 1.7);
        gr.meshes[1].material.rotation += (fire ? 0.16 : -0.16) * (1 + lv * 2);
        gr.meshes[1].material.opacity = 0.35 + lv * 0.3;
        // 环绕粒子随等级增强
        for (let i = 0; i < 3 + Math.round(lv * 6); i++) {
          const a = Math.random() * 6.2832;
          const r = T.rand(0.5, 1.5) * (1.3 - lv * 0.4);
          const px = ox + Math.cos(a) * r, py = oy + Math.sin(a) * r * 0.75;
          f.pool.emit({
            map: fire ? TX.ember : TX.snow, x: px, y: py, z: T.rand(-0.24, 0.3),
            size: T.rand(0.06, 0.17) * (0.8 + lv), size1: 0.004, life: 0.26,
            color: i % 3 === 0 ? c2 : c1,
            vx: (ox - px) * 3.8, vy: (oy - py) * 3.8, vz: -T.rand(0, 1.5), g: 0, drag: 0,
            spin: T.rand(-14, 14), fadePow: 1.2,
          });
        }
      });
      g.level = level || 0;
      fx.addSprite(g, { map: TX.core, size: 0.24, color: c1, opacity: 0.8 });
      fx.addSprite(g, { map: TX.ring, size: 0.24, color: c2, opacity: 0.5, spin: 6 });
      return g;
    },

    /* 蓄力满释放：巨型元素波（贯穿全屏） */
    chargedWave(fx, x, y, dir, element, level) {
      const P = fx.pool, TX = T.fxTextures;
      const fire = element === "fire";
      const c1 = fire ? 0xff7a1a : 0x3ab8ff;
      const c2 = fire ? 0xfff2c0 : 0xd8f6ff;
      const c3 = fire ? 0xff3a00 : 0x0a4ab8;
      const pw = 1.55 + (level || 0) * 1.05;
      FXlib.dragonHeadBlast(fx, x, y, dir, fire ? "fire" : "ice");
      // 冷/暖底盘大范围染色（史诗感的关键：整片空间被元素浸染）
      const glowMap = fire ? TX.heat : TX.frost;
      for (let i = 0; i < 9; i++) {
        P.emit({
          map: glowMap, x: x + T.rand(-0.6, 0.6), y: y + T.rand(-0.5, 0.6), z: T.rand(-0.5, 0.4),
          size: T.rand(0.9, 1.7) * pw, size1: T.rand(1.8, 2.8) * pw, life: T.rand(0.4, 0.8),
          opacity: 0.42, color: fire ? 0xff6a10 : 0x1a6ae0,
          vx: dir * T.rand(0.8, 2.4), vy: T.rand(-0.3, 1.2), g: 0, drag: 1.1, fadePow: 1.7,
        });
      }

      // 巨型核心
      P.emit({ map: TX.core, x: x, y: y, z: 0.2, size: 1.5 * pw, size1: 0.4, life: 0.24, color: c2, opacity: 1 });
      P.emit({ map: fire ? TX.flame : TX.ice, x: x, y: y, z: 0.24, size: 1.7 * pw, size1: 0.5, sy: 1.2, life: 0.32, color: c1, opacity: 0.9, vx: dir * 2 });
      // 元素簇
      for (let i = 0; i < 28; i++) {
        const back = T.rand(0, 0.8), side = T.rand(-0.5, 0.5);
        P.emit({
          map: fire ? TX.flame : TX.ice,
          x: x - dir * back, y: y + side * 1.4, z: T.rand(-0.4, 0.4),
          size: T.rand(0.4, 0.95) * pw, size1: T.rand(0.1, 0.25), sy: T.rand(0.8, 1.6),
          life: T.rand(0.3, 0.62), opacity: T.rand(0.6, 0.95),
          color: i % 3 === 0 ? c2 : i % 3 === 1 ? c1 : c3,
          vx: dir * T.rand(2, 7), vy: T.rand(-0.8, 3), vz: T.rand(-1.8, 1.8),
          g: -3, drag: 1.4, spin: T.rand(-18, 18), rot: T.rand(-0.7, 0.7), fadePow: 1.3,
        });
      }
      // 元素雨（大量）
      for (let i = 0; i < 48; i++) {
        const a = Math.random() * 6.2832, sp = T.rand(3, 11);
        P.emit({
          map: fire ? TX.ember : (i % 2 ? TX.snow : TX.star),
          x: x, y: y, z: T.rand(-0.4, 0.45),
          size: T.rand(0.08, 0.24) * pw, size1: 0.006, life: T.rand(0.34, 0.8),
          color: i % 3 ? c1 : c2,
          vx: Math.cos(a) * sp + dir * 3, vy: Math.sin(a) * sp + 1.6, vz: T.rand(-2, 2),
          g: -6, drag: 1.2, spin: T.rand(-24, 24), fadePow: 1.3,
        });
      }
      // 多重冲击环
      const grp = fx.group(0.5, function (f, gr, k) {
        for (let i = 0; i < 4; i++) {
          const m = gr.meshes[i];
          m.position.set(x + dir * T.easeOut(k) * (0.6 + i * 0.3), y, 0.06 - i * 0.04);
          m.material.rotation += (i % 2 ? -0.4 : 0.4) * (1 + i * 0.3) * (fire ? 1 : -1);
          const s = (0.5 + i * 0.38) * pw * (0.5 + T.easeOut(k) * 1.7);
          m.scale.set(s, s, 1);
          m.material.opacity = (1 - k) * (0.75 - i * 0.14);
        }
      });
      for (let i = 0; i < 4; i++) {
        fx.addSprite(grp, { map: TX.ring, x: x, y: y, z: 0.06 - i * 0.04, size: (0.5 + i * 0.38) * pw, color: i === 0 ? c2 : i === 1 ? c1 : c3, opacity: 0.75 - i * 0.14, spin: i % 2 ? -5 : 5 });
      }
      // 巨型光柱 + 地面震裂 + 速度线
      T.FXlib.pillar(fx, x, c1, 1.05 * pw);
      T.FXlib.pillar(fx, x + dir * 0.4, c2, 0.7 * pw);
      if (fire && T.FXlib.groundGlyph) T.FXlib.groundGlyph(fx, x - dir * 0.3, 0xff5a10, 3.4 * pw);
      if (!fire && T.FXlib.frostGlyph) T.FXlib.frostGlyph(fx, x - dir * 0.3, 3.3 * pw);
      T.FXlib.speedLines(fx, 0.72);
      T.FXlib.energyBurst(fx, x, y, c1, 1.65 * pw);
    },

    /* ---------- 拳皇风超必：草薙京大蛇薙 × 八神庵八稚女 ---------- */

    kofMaxFreeze(fx, fighter) {
      const x = fighter.x, y = fighter.y + 0.9;
      FXlib.chargeAura(fx, fighter, 0.42, 0xffe08a);
      const grp = fx.group(0.52, function (f, gr, k) {
        for (let i = 0; i < gr.meshes.length; i++) {
          const m = gr.meshes[i];
          const s = 0.22 + T.easeOut(k) * (1.85 + i * 0.85);
          m.scale.setScalar(s);
          if (m.material.uniforms) m.material.uniforms.uOpacity.value = (1 - k) * (0.62 - i * 0.18);
        }
      });
      fx.addRing(grp, { x: x, y: y, z: 1.4, color: "#ffe9a0", size: 0.22, front: true });
      fx.addRing(grp, { x: x, y: y, z: 1.28, color: "#ff5a28", size: 0.22, front: true });
      fx.addRing(grp, { x: x, y: 0.14, z: 0.35, rx: -Math.PI / 2, color: "#ff9a40", size: 0.55, front: true });
    },

    yaOtomeSlash(fx, x, y, dir, index) {
      const TX = T.fxTextures, P = fx.pool;
      const angs = [-1.05, 0.95, -0.42, 1.22, -1.28, 0.55];
      const ang = angs[(index || 0) % 6];
      const kyo = (index || 0) % 2 === 0;
      const col = kyo ? 0xffd88a : 0xff4a78;
      const z = 1.7;
      const grp = fx.group(0.22, function (f, gr, k) {
        const g = 1.55 + T.easeOut(k) * 1.85;
        const m0 = gr.meshes[0], m1 = gr.meshes[1];
        m0.scale.set(g * 1.25, g * 0.22, 1);
        m0.material.opacity = 0.92 * (1 - k);
        m0.position.x = x + dir * T.easeOut(k) * 0.55;
        if (m1) {
          m1.scale.set(g * 1.45, g * 0.32, 1);
          m1.material.opacity = 0.4 * (1 - k);
          m1.position.x = x + dir * T.easeOut(k) * 0.42;
        }
      });
      fx.addSprite(grp, { map: TX.kofSlash, x: x, y: y, z: z, size: 1.7, sy: 0.24, color: 0xffffff, rot: ang * (dir > 0 ? 1 : -1), opacity: 0.92, front: true });
      fx.addSprite(grp, { map: TX.kofSlash, x: x, y: y, z: z - 0.06, size: 2.05, sy: 0.32, color: col, rot: ang * (dir > 0 ? 1 : -1), opacity: 0.5, front: true });
      for (let i = 0; i < 5; i++) {
        P.emit({
          map: TX.ember, front: true,
          x: x, y: y, z: z - 0.08,
          size: T.rand(0.06, 0.14), size1: 0.008, life: T.rand(0.16, 0.28),
          color: i % 2 ? col : 0xfff2c0,
          vx: dir * T.rand(1.6, 5.5), vy: T.rand(-0.6, 3.2),
          g: -6, drag: 1.8, fadePow: 1.4,
        });
      }
    },

    orochinagiWave(fx, fighter, dur) {
      const P = fx.pool, TX = T.fxTextures;
      const dir = fighter.facing;
      const x0 = fighter.x;
      const grp = fx.group(dur || 0.95, function (f, gr, k) {
        const wx = x0 + dir * (0.35 + k * 5.6);
        const rise = 0.85 + T.easeOut(Math.min(1, k * 2.2)) * 0.7;
        if (gr.meshes[0]) {
          gr.meshes[0].position.x = wx;
          gr.meshes[0].position.y = 0.62 + rise * 0.18;
          gr.meshes[0].material.opacity = 0.9 * (1 - k * k);
          gr.meshes[0].scale.set(2.8 + k * 1.6, 0.95 + rise * 0.35, 1);
        }
        if (gr.meshes[1]) {
          gr.meshes[1].position.x = wx + dir * 0.22;
          gr.meshes[1].position.y = 0.38;
          gr.meshes[1].material.opacity = 0.42 * (1 - k);
          gr.meshes[1].scale.set(1.6 + k, 1.15, 1);
        }
        if (k < 0.86 && Math.random() < 0.65) {
          P.emit({
            map: TX.flame, front: true,
            x: wx + dir * T.rand(-0.08, 0.22),
            y: 0.22 + Math.random() * rise,
            z: 1.45,
            size: T.rand(0.35, 0.7), size1: 0.08, sy: 1.45, life: 0.22,
            color: Math.random() < 0.7 ? 0xff8a28 : 0xfff0c0,
            vx: dir * T.rand(1.2, 2.8), vy: T.rand(0.2, 1.4),
            opacity: 0.75, fadePow: 1.5,
          });
        }
        P.emit({
          map: TX.ember, front: true, x: wx, y: 0.14, z: 1.35,
          size: 0.85, size1: 0.18, sy: 0.38, life: 0.28, color: 0xff6a18, vx: dir * 0.8, opacity: 0.7,
        });
      });
      fx.addSprite(grp, { map: TX.orochiFlame, x: x0, y: 0.85, z: 1.55, size: 2.6, sy: 0.48, color: 0xffc878, opacity: 0.92, front: true });
      fx.addSprite(grp, { map: TX.bloodFlame, x: x0, y: 0.42, z: 1.42, size: 1.15, sy: 1.15, color: 0xff3a58, opacity: 0.4, front: true });
    },

    kofNaiwaSuper(fx, fighter) {
      const dir = fighter.facing;
      FXlib.kofMaxFreeze(fx, fighter);
      let slashN = 0, oro = false;
      fx.group(1.15, function (f, gr, k) {
        const t = k * 1.15;
        if (slashN < 6 && t >= 0.12 + slashN * 0.048) {
          const ox = fighter.x + dir * (0.55 + slashN * 0.2);
          const oy = fighter.y + 0.55 + (slashN % 2 ? 0.38 : 0.72);
          FXlib.yaOtomeSlash(fx, ox, oy, dir, slashN);
          slashN++;
        }
        if (!oro && t >= 0.4) {
          oro = true;
          FXlib.orochinagiWave(fx, fighter, 0.92);
        }
      });
    },

    /* 冰霜地纹（贴地冰裂） */
    frostGlyph(fx, x, scale) {
      const TX = T.fxTextures;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: TX.frostGlyph, color: 0x2a9ae0, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * 6.28;
      m.position.set(x, 0.142, 0.1);
      m.scale.setScalar(scale || 2);
      fx.scene.add(m);
      fx.decals.push({ mesh: m, t: 0, life: 1.6 });
      const grp = fx.group(0.42, function (f, gr, k) {
        const g = gr.meshes[0];
        g.material.opacity = 0.9 * (1 - k);
        g.scale.setScalar((scale || 2) * (0.55 + T.easeOut(k) * 0.6));
        g.material.rotation += 0.005;
      });
      fx.addSprite(grp, { map: TX.frostGlyph, x: x, y: 0.15, z: 0.1, size: (scale || 2) * 0.55, color: 0x5ac8ff, opacity: 0.9 });
    },

    /* ============================================================
       终极必杀 · 演出层（参考街霸6 Critical Art 的镜头语言）
       全屏速度线 + 暗场 + 角色轮廓光 + 元素染色
       opt: { element:"fire"|"void", tint, dur, power }
       ============================================================ */
    ultraIntro(fx, fighter, opt) {
      opt = opt || {};
      const TX = T.fxTextures;
      const el = opt.element || "fire";
      const isVoid = el === "void";
      const c1 = isVoid ? 0x8a2ae0 : 0xffb020;
      const c2 = isVoid ? 0xe040c0 : 0xfff2c0;
      const dur = opt.dur || 0.7;
      const x = fighter.x, y = fighter.y + 0.85;

      // ① 全屏径向速度线（两层反向旋转，制造高压感）
      const grp = fx.group(dur, function (f, gr, k) {
        const s0 = 4.2 + T.easeOut(k) * 3.4;
        gr.meshes[0].scale.set(s0, s0, 1);
        gr.meshes[0].material.opacity = 0.42 * (1 - k);
        gr.meshes[0].material.rotation += 0.006 * (isVoid ? -1 : 1);
        const s1 = 3.0 + T.easeOut(k) * 2.2;
        gr.meshes[1].scale.set(s1, s1, 1);
        gr.meshes[1].material.opacity = 0.3 * (1 - k);
        gr.meshes[1].material.rotation -= 0.011 * (isVoid ? -1 : 1);
      });
      fx.addSprite(grp, { map: TX.speed, x: x, y: 1.0, z: 1.9, size: 4.2, color: c2, opacity: 0.42, front: true });
      fx.addSprite(grp, { map: TX.speed, x: x, y: 1.0, z: 1.8, size: 3.0, color: c1, opacity: 0.3, front: true });

      // ② 角色轮廓光：三层扩散环
      const grp2 = fx.group(dur * 0.9, function (f, gr, k) {
        for (let i = 0; i < 3; i++) {
          const m = gr.meshes[i];
          const s = 0.3 + T.easeOut(k) * (1.0 + i * 0.62);
          m.scale.set(s, s, 1);
          m.material.uniforms.uOpacity.value = (1 - k) * (0.6 - i * 0.14);
        }
      });
      fx.addRing(grp2, { x: x, y: y, z: 1.7, color: isVoid ? "#c08aff" : "#fff2c0", size: 0.3, front: true });
      fx.addRing(grp2, { x: x, y: y, z: 1.66, color: isVoid ? "#7a2ad8" : "#ff9a20", size: 0.3, front: true });
      fx.addRing(grp2, { x: x, y: 0.14, z: 0.3, rx: -Math.PI / 2, color: isVoid ? "#4a0a7a" : "#ff5a10", size: 0.5, front: true });

      // ③ 元素地纹
      if (isVoid) T.FXlib.frostGlyph(fx, x, 2.2);
      else T.FXlib.groundGlyph(fx, x, 0xff7a10, 2.2);

      // ④ 聚能吸入
      T.FXlib.chargeGather(fx, fighter, dur * 0.8, c1);
      T.FXlib.elementStorm(fx, fighter, isVoid ? "ice" : "fire", dur * 0.8);
    },

    /* ---------- 奶龙 ①「九转炎龙破」---------- */
    ultraNineDragons(fx, fighter, opt) {
      opt = opt || {};
      const TX = T.fxTextures, P = fx.pool;
      const dir = fighter.facing;
      FXlib.ultraIntro(fx, fighter, { element: "fire", dur: 0.68 });

      // 九龙：依次从背后升起，沿弧线突进，每条带焰舌与冲击环
      const NINE = 9;
      for (let i = 0; i < NINE; i++) {
        const delay = 120 + i * 95;
        setTimeout(function () {
          const sx = fighter.x - dir * (0.5 + i * 0.06);
          const peakY = 0.55 + (i % 3) * 0.42 + i * 0.055;
          const grp = fx.group(0.85, function (f, gr, k) {
            const ex = sx + dir * (k * (4.6 + i * 0.28));
            const arcY = peakY + Math.sin(k * Math.PI) * 0.62 - k * 0.18;
            const m0 = gr.meshes[0], m1 = gr.meshes[1];
            m0.position.set(ex, arcY, 1.35);
            m0.material.rotation = (dir > 0 ? 1 : -1) * (-0.18 + Math.sin(k * 22) * 0.08);
            const sc = (0.85 + i * 0.045) * (1 + Math.sin(k * 26) * 0.07);
            m0.scale.set(sc * 1.25, sc * 0.8, 1);
            m0.material.opacity = (k < 0.9 ? 1 : (1 - (k - 0.9) / 0.1)) * 0.95;
            m1.position.set(ex - dir * 0.55, arcY, 1.28);
            m1.scale.set(sc * 1.5, sc * 0.7, 1);
            m1.material.opacity = 0.6 * (1 - k);
            if (k < 0.85) {
              for (let t = 0; t < 3; t++) {
                P.emit({
                  map: t % 2 ? TX.flame : TX.ember, front: true,
                  x: ex - dir * T.rand(0.1, 0.6), y: arcY + T.rand(-0.28, 0.28), z: 1.3 + T.rand(-0.2, 0.2),
                  size: T.rand(0.3, 0.62), size1: 0.05, sy: T.rand(0.9, 1.4), life: T.rand(0.18, 0.34),
                  color: t % 2 ? 0xff7a1a : 0xffe9a0,
                  vx: dir * T.rand(1.2, 3.4), vy: T.rand(-0.8, 1.6),
                  g: -2, drag: 1.6, spin: T.rand(-12, 12), fadePow: 1.3,
                });
              }
            }
          });
          fx.addSprite(grp, { map: TX.dragonHead, x: sx, y: peakY, z: 1.35, size: 1.25, color: i % 2 ? 0xffd24a : 0xff7a1a, opacity: 0.95, front: true, rot: dir > 0 ? 0 : Math.PI });
          fx.addSprite(grp, { map: TX.holyFlame, x: sx, y: peakY, z: 1.28, size: 1.9, color: 0xff5a10, opacity: 0.6, front: true });
          // 龙首爆点
          const bx = fighter.x + dir * (4.6 + i * 0.28);
          const g2 = fx.group(0.34, function (f, gr, k) {
            gr.meshes[0].scale.setScalar(0.3 + T.easeOut(k) * 1.5);
            gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.85;
          });
          fx.addRing(g2, { x: bx, y: peakY, z: 1.3, color: i % 2 ? "#fff2c0" : "#ff7a1a", size: 0.3, front: true });
          FXlib.fireBurst(fx, bx, peakY, dir);
        }, delay);
      }
      // 收尾：全屏圣炎爆裂
      setTimeout(function () {
        const bx = fighter.x + dir * 5.2;
        FXlib.energyBurst(fx, bx, 0.9, 0xffb020, 1.8);
        FXlib.dragonHeadBlast(fx, bx, 0.95, dir, "fire");
        FXlib.pillar(fx, fighter.x + dir * 1.2, 0xffd24a, 0.9);
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * 6.2832, sp = T.rand(4, 13);
          P.emit({
            map: i % 2 ? TX.flame : TX.holyFlame, front: i % 3 === 0,
            x: bx, y: 0.9, z: T.rand(-0.6, 1.1),
            size: T.rand(0.3, 0.8), size1: 0.05, sy: T.rand(0.9, 1.5), life: T.rand(0.4, 0.9),
            color: i % 3 === 0 ? 0xfff2c0 : i % 3 === 1 ? 0xff9a20 : 0xff3a00,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85 + 2.4, vz: T.rand(-2, 2),
            g: -8, drag: 1.2, spin: T.rand(-22, 22), fadePow: 1.25,
          });
        }
      }, 120 + NINE * 95 + 120);
    },

    /* ---------- 奶龙 ②「奶河焚天」---------- */
    ultraMilkFlood(fx, fighter, opt) {
      opt = opt || {};
      const TX = T.fxTextures, P = fx.pool;
      const dir = fighter.facing;
      FXlib.ultraIntro(fx, fighter, { element: "fire", dur: 0.62 });

      // ① 乳白奶河涌起（多层横向波浪）
      const grp = fx.group(1.5, function (f, gr, k) {
        for (let i = 0; i < 4; i++) {
          const m = gr.meshes[i];
          const ph = k * 1.0 + i * 0.16;
          const wx = fighter.x + dir * Math.min(5.6, k * 6.4);
          m.position.set(wx - dir * i * 0.3, 0.42 + i * 0.3 + Math.sin(ph * 12) * 0.1, 1.2 - i * 0.08);
          const sw = (2.9 + i * 0.5) * (0.35 + T.easeOut(Math.min(1, k * 2.4)));
          m.scale.set(sw, 1.15 + i * 0.22, 1);
          m.material.opacity = 0.86 * (1 - Math.pow(k, 1.6));
          m.material.rotation = dir > 0 ? -1.35 : 1.35;
        }
      });
      for (let i = 0; i < 4; i++) {
        fx.addSprite(grp, { map: TX.milk, x: fighter.x, y: 0.5 + i * 0.3, z: 1.2 - i * 0.08, size: 2.9 + i * 0.5, color: i % 2 ? 0xfffdf0 : 0xffffff, opacity: 0.86, front: true });
      }
      // ② 奶河点燃：乳白 → 金色火焰（由白转金的染色过程）
      const ignite = setTimeout(function () {}, 0);
      clearTimeout(ignite);
      for (let i = 0; i < 34; i++) {
        const dly = 260 + i * 26;
        setTimeout(function () {
          const px = fighter.x + dir * (0.3 + Math.random() * 5.2);
          P.emit({
            map: Math.random() < 0.5 ? TX.flame : TX.holyFlame, front: Math.random() < 0.3,
            x: px, y: 0.3 + Math.random() * 0.9, z: 0.6 + Math.random() * 0.9,
            size: T.rand(0.35, 0.85), size1: 0.06, sy: T.rand(0.9, 1.5), life: T.rand(0.34, 0.7),
            color: Math.random() < 0.4 ? 0xfff2d0 : Math.random() < 0.6 ? 0xffb020 : 0xff5a10,
            vx: dir * T.rand(0.6, 3.2), vy: T.rand(1.2, 4.2), vz: T.rand(-0.8, 1),
            g: -2.4, drag: 1.1, spin: T.rand(-16, 16), fadePow: 1.3,
          });
        }, dly);
      }
      // ③ 天空裂开：金色光柱降下
      const beams = [0.6, 2.4, 4.2];
      beams.forEach(function (bx, i) {
        setTimeout(function () {
          const px = fighter.x + dir * bx;
          const g2 = fx.group(0.85, function (f, gr, k) {
            const m = gr.meshes[0];
            m.position.set(px, 0.1 + T.easeOut(k) * 1.5, 1.15);
            m.scale.set(0.6 * (1 - k * 0.4), 3.4 * (0.3 + T.easeOut(k) * 0.95), 1);
            m.material.opacity = 0.78 * (1 - k);
            const r = gr.meshes[1];
            r.position.set(px, 0.16, 0.2);
            r.scale.setScalar(1.4 + k * 2.4);
            r.material.uniforms.uOpacity.value = (1 - k) * 0.7;
          });
          fx.addSprite(g2, { map: TX.holyFlame, x: px, y: 0.5, z: 1.15, size: 0.6, sy: 3.4, color: 0xffd24a, opacity: 0.78, front: true });
          fx.addRing(g2, { x: px, y: 0.16, z: 0.2, rx: -Math.PI / 2, color: "#ffb020", size: 1.4 });
          FXlib.fireBurst(fx, px, 0.55, dir);
        }, 420 + i * 130);
      });
      // ④ 收尾：全域圣炎
      setTimeout(function () {
        for (let i = 0; i < 3; i++) {
          const px = fighter.x + dir * (1 + i * 1.8);
          FXlib.energyBurst(fx, px, 1.0, 0xffd24a, 1.4);
          FXlib.pillar(fx, px, 0xffb020, 0.7);
        }
        FXlib.groundGlyph(fx, fighter.x + dir * 2.4, 0xff7a10, 3.0);
        FXlib.speedLines(fx, 0.5);
      }, 900);
    },

    /* ---------- 奶龙 ③「炎帝临世」---------- */
    ultraFlameEmperor(fx, fighter, opt) {
      opt = opt || {};
      const TX = T.fxTextures, P = fx.pool;
      const dir = fighter.facing;
      FXlib.ultraIntro(fx, fighter, { element: "fire", dur: 0.85 });

      const cx = fighter.x, cy = 0.95;

      // ① 金炎纹章展开（地面法阵）
      const sig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: TX.holySigil, color: 0xffb020, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      sig.rotation.x = -Math.PI / 2;
      sig.position.set(cx, 0.142, 0.2);
      sig.scale.setScalar(0.4);
      fx.scene.add(sig);
      fx.decals.push({ mesh: sig, t: 0, life: 2.4 });
      fx.group(1.2, function (f, gr, k) {
        sig.scale.setScalar(1.2 + T.easeOut(k) * 4.2);
        sig.material.rotation += 0.004;
        sig.material.opacity = 0.95 * (1 - k * 0.6);
      });

      // ② 炎帝法相：巨大金炎轮廓自背后升起
      const avatar = fx.group(2.0, function (f, gr, k) {
        const rise = T.easeOut(Math.min(1, k * 1.8));
        const m0 = gr.meshes[0];
        m0.position.set(cx - dir * 0.15, 0.5 + rise * 2.3, 1.6);
        const sc = 2.4 + rise * 3.4;
        m0.scale.set(sc, sc * 1.25, 1);
        m0.material.opacity = 0.5 * rise * (1 - Math.max(0, (k - 0.78) / 0.22));
        const m1 = gr.meshes[1];
        m1.position.set(cx - dir * 0.15, 0.5 + rise * 2.3, 1.55);
        m1.scale.set(sc * 1.3, sc * 1.5, 1);
        m1.material.opacity = 0.28 * rise * (1 - Math.max(0, (k - 0.72) / 0.28));
        m1.material.rotation += 0.0026;
      });
      fx.addSprite(avatar, { map: TX.holyFlame, x: cx, y: 1.5, z: 1.6, size: 2.4, color: 0xffd24a, opacity: 0, front: true });
      fx.addSprite(avatar, { map: TX.rune, x: cx, y: 1.5, z: 1.55, size: 3.1, color: 0xff7a10, opacity: 0, front: true });

      // ③ 三段太阳爆裂
      [0.42, 0.78, 1.14].forEach(function (t, i) {
        setTimeout(function () {
          const lv = 1 + i * 0.5;
          FXlib.energyBurst(fx, cx + dir * (0.7 + i * 1.1), 0.95, 0xffb020, lv);
          FXlib.pillar(fx, cx + dir * (0.6 + i * 1.0), i % 2 ? 0xfff2c0 : 0xff7a1a, 0.75);
          for (let n = 0; n < 26; n++) {
            const a = Math.random() * 6.2832, sp = T.rand(3.5, 11);
            P.emit({
              map: n % 2 ? TX.holyFlame : TX.flame, front: n % 5 === 0,
              x: cx + dir * (0.7 + i * 1.0), y: 0.95, z: T.rand(-0.5, 1.1),
              size: T.rand(0.3, 0.78), size1: 0.05, sy: T.rand(0.9, 1.5), life: T.rand(0.36, 0.8),
              color: n % 3 === 0 ? 0xfff2c0 : n % 3 === 1 ? 0xffb020 : 0xff3a00,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9 + 2.2, vz: T.rand(-1.8, 1.8),
              g: -8.5, drag: 1.25, spin: T.rand(-20, 20), fadePow: 1.25,
            });
          }
        }, t * 1000);
      });

      // ④ 终段：地面熔岩纹章 + 全屏金光
      setTimeout(function () {
        FXlib.groundGlyph(fx, cx + dir * 1.6, 0xff5a10, 3.6);
        FXlib.speedLines(fx, 0.6);
        for (let i = 0; i < 44; i++) {
          const a = Math.random() * 6.2832, sp = T.rand(2.5, 9);
          P.emit({
            map: i % 2 ? TX.flame : TX.holyFlame, front: i % 4 === 0,
            x: cx + T.rand(-1.2, 3.4), y: 0.3 + Math.random() * 2.2, z: T.rand(-0.8, 1.4),
            size: T.rand(0.3, 0.9), size1: 0.06, sy: T.rand(1, 1.7), life: T.rand(0.5, 1.1),
            color: i % 3 ? 0xffb020 : 0xfff2c0,
            vx: dir * T.rand(0.5, 4), vy: T.rand(1.5, 5), vz: T.rand(-1, 1),
            g: -3, drag: 1, spin: T.rand(-14, 14), fadePow: 1.3, opacity: 0.9,
          });
        }
      }, 1500);
    },

    /* ---------- 奶鼠 ①「紫渊吞噬」---------- */
    ultraVoidRift(fx, fighter, opt) {
      opt = opt || {};
      const TX = T.fxTextures, P = fx.pool;
      const dir = fighter.facing;
      FXlib.ultraIntro(fx, fighter, { element: "void", dur: 0.7 });

      const cx = fighter.x + dir * 2.1;

      // ① 横向撕开紫黑裂隙
      const grp = fx.group(1.45, function (f, gr, k) {
        const open = T.easeOut(Math.min(1, k * 2.6));
        const m = gr.meshes[0];
        m.position.set(cx, 1.05, 1.5);
        m.scale.set(0.25 + open * 2.5, 0.4 + open * 2.0, 1);
        m.material.opacity = 0.96 * (1 - Math.max(0, (k - 0.78) / 0.22));
        m.material.rotation = 1.5708;
        const halo = gr.meshes[1];
        halo.position.set(cx, 1.05, 1.44);
        halo.scale.set(1.2 + open * 2.9, 1.1 + open * 2.4, 1);
        halo.material.opacity = 0.6 * (1 - k);
        halo.material.rotation -= 0.004;
      });
      fx.addSprite(grp, { map: TX.rift, x: cx, y: 1.05, z: 1.5, size: 1.4, color: 0x2a0a4a, opacity: 0.96, front: true });
      fx.addSprite(grp, { map: TX.voidMist, x: cx, y: 1.05, z: 1.44, size: 1.6, color: 0x9a3ae0, opacity: 0.6, front: true });

      // ② 虚空触须伸出
      for (let i = 0; i < 7; i++) {
        setTimeout(function () {
          const ang = -0.5 + i * 0.17;
          const g2 = fx.group(0.75, function (f, gr, k) {
            const reach = T.easeOut(k) * 3.6;
            const m = gr.meshes[0];
            m.position.set(cx - dir * 0.4 + dir * reach, 1.05 + Math.sin(ang * 3) * 0.5, 1.42 + i * 0.012);
            m.scale.set(1.2 + reach * 0.35, 1.5 - i * 0.09, 1);
            m.material.rotation = ang * (dir > 0 ? 1 : -1) + (dir > 0 ? 0 : Math.PI);
            m.material.opacity = 0.9 * (1 - Math.pow(k, 2.2));
          });
          fx.addSprite(g2, { map: TX.tentacle, x: cx, y: 1.05, z: 1.42, size: 1.2, color: i % 2 ? 0x9a3ae0 : 0x6a1ab0, opacity: 0.9, front: true });
          for (let n = 0; n < 3; n++) {
            P.emit({
              map: TX.voidFlame, front: n === 0,
              x: cx + dir * T.rand(0, 3), y: 0.6 + Math.random() * 1.2, z: 1.3 + T.rand(-0.2, 0.3),
              size: T.rand(0.2, 0.5), size1: 0.04, life: T.rand(0.24, 0.48),
              color: n % 2 ? 0xc08aff : 0x7a2ad8,
              vx: -dir * T.rand(0.8, 2.6), vy: T.rand(-1.2, 1.2),
              g: -1, drag: 1.4, spin: T.rand(-14, 14), fadePow: 1.3,
            });
          }
        }, 300 + i * 70);
      }

      // ③ 万物吸入：紫黑粒子被裂隙牵引
      fx.group(1.35, function (f, gr, k) {
        const rate = 6 + Math.round(k * 14);
        for (let i = 0; i < rate; i++) {
          const a = Math.random() * 6.2832;
          const r = T.rand(1.6, 4.2);
          const px = cx + Math.cos(a) * r;
          const py = 1.05 + Math.sin(a) * r * 0.72;
          P.emit({
            map: Math.random() < 0.5 ? TX.voidOrb : TX.darkStar, front: Math.random() < 0.25,
            x: px, y: py, z: T.rand(0.1, 1.5),
            size: T.rand(0.08, 0.26), size1: 0.01, life: 0.3,
            color: Math.random() < 0.5 ? 0x9a3ae0 : 0xe040c0,
            vx: (cx - px) * 3.4, vy: (1.05 - py) * 3.4, vz: -T.rand(0.4, 1.8),
            g: 0, drag: 0, spin: T.rand(-18, 18), fadePow: 1.2,
          });
        }
      });

      // ④ 收束：黑洞内爆 + 紫黑爆散
      setTimeout(function () {
        FXlib.energyBurst(fx, cx, 1.05, 0x8a2ae0, 1.7);
        for (let i = 0; i < 46; i++) {
          const a = Math.random() * 6.2832, sp = T.rand(3, 12);
          P.emit({
            map: i % 3 === 0 ? TX.rift : (i % 3 === 1 ? TX.voidOrb : TX.darkStar), front: i % 4 === 0,
            x: cx, y: 1.05, z: T.rand(0.2, 1.5),
            size: T.rand(0.18, 0.62), size1: 0.02, life: T.rand(0.4, 0.95),
            color: i % 3 === 0 ? 0x1a0430 : i % 3 === 1 ? 0x9a3ae0 : 0xe040c0,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85, vz: T.rand(-1.6, 1.6),
            g: -2.5, drag: 1.3, spin: T.rand(-24, 24), fadePow: 1.25, opacity: 0.95,
          });
        }
        FXlib.speedLines(fx, 0.45);
      }, 1450);
    },

    /* ---------- 奶鼠 ②「暗星陨灭」---------- */
    ultraDarkMeteor(fx, fighter, opt) {
      opt = opt || {};
      const TX = T.fxTextures, P = fx.pool;
      const dir = fighter.facing;
      FXlib.ultraIntro(fx, fighter, { element: "void", dur: 0.72 });

      const total = 7;
      for (let i = 0; i < total; i++) {
        const delay = 220 + i * 135;
        setTimeout(function () {
          const tx = fighter.x + dir * (1.2 + i * 0.72);
          const startY = 5.4;
          const endY = 0.5;
          const grp = fx.group(0.72, function (f, gr, k) {
            const ky = T.easeIn(k);
            const py = startY + (endY - startY) * ky;
            const px = tx + dir * (1 - ky) * 0.55;
            const m = gr.meshes[0];
            m.position.set(px, py, 1.25);
            const sc = (0.9 + i * 0.07) * (1 - k * 0.16);
            m.scale.set(sc, sc, 1);
            m.material.rotation += 0.05;
            m.material.opacity = k < 0.95 ? 0.98 : 0;
            const trail = gr.meshes[1];
            trail.position.set(px - dir * 0.2, py + 0.75, 1.2);
            trail.scale.set(sc * 0.85, sc * 2.3, 1);
            trail.material.opacity = 0.55 * (1 - k);
            if (k < 0.9) {
              for (let t = 0; t < 2; t++) {
                P.emit({
                  map: t ? TX.voidFlame : TX.darkStar, front: t === 0 && Math.random() < 0.4,
                  x: px + T.rand(-0.24, 0.24), y: py + T.rand(0.1, 0.9), z: 1.15 + T.rand(-0.2, 0.25),
                  size: T.rand(0.16, 0.42), size1: 0.03, life: T.rand(0.22, 0.42),
                  color: t ? 0x7a2ad8 : 0xe040c0,
                  vx: -dir * T.rand(0.2, 1.2), vy: T.rand(0.4, 1.8),
                  g: -1, drag: 1.3, spin: T.rand(-16, 16), fadePow: 1.3,
                });
              }
            }
          });
          fx.addSprite(grp, { map: TX.darkStar, x: tx, y: startY, z: 1.25, size: 0.9, color: 0xffffff, opacity: 0.98, front: true });
          fx.addSprite(grp, { map: TX.voidMist, x: tx, y: startY + 0.7, z: 1.2, size: 0.8, color: 0x9a3ae0, opacity: 0.55, front: true });

          // 撞击点：紫黑冲击波 + 地平爆散
          const g2 = fx.group(0.5, function (f, gr, k) {
            gr.meshes[0].scale.setScalar(0.3 + T.easeOut(k) * 2.3);
            gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.9;
            gr.meshes[1].scale.setScalar(0.25 + T.easeOut(k) * 1.5);
            gr.meshes[1].material.uniforms.uOpacity.value = (1 - k) * 0.6;
          });
          fx.addRing(g2, { x: tx, y: 0.2, z: 0.4, rx: -Math.PI / 2, color: "#9a3ae0", size: 0.3 });
          fx.addRing(g2, { x: tx, y: 0.5, z: 1.2, color: "#e040c0", size: 0.25, front: true });
          FXlib.frostGlyph(fx, tx, 1.4);
          for (let n = 0; n < 22; n++) {
            const a = Math.random() * 6.2832, sp = T.rand(3, 10);
            P.emit({
              map: n % 3 === 0 ? TX.darkStar : TX.voidFlame, front: n % 5 === 0,
              x: tx, y: 0.35, z: T.rand(-0.3, 1.2),
              size: T.rand(0.16, 0.5), size1: 0.02, life: T.rand(0.3, 0.7),
              color: n % 3 === 0 ? 0xe040c0 : n % 3 === 1 ? 0x9a3ae0 : 0x4a0a7a,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 + 1.8, vz: T.rand(-1.4, 1.4),
              g: -9, drag: 1.25, spin: T.rand(-22, 22), fadePow: 1.3,
            });
          }
        }, delay);
      }

      // 终段：全屏暗星坍缩
      setTimeout(function () {
        const cx = fighter.x + dir * 3.2;
        FXlib.energyBurst(fx, cx, 1.0, 0x7a2ad8, 2.0);
        FXlib.pillar(fx, cx, 0xe040c0, 0.9);
        for (let i = 0; i < 54; i++) {
          const a = Math.random() * 6.2832, sp = T.rand(4, 14);
          P.emit({
            map: i % 2 ? TX.darkStar : TX.voidOrb, front: i % 4 === 0,
            x: cx + T.rand(-1.4, 1.4), y: T.rand(0.2, 2.4), z: T.rand(-0.8, 1.5),
            size: T.rand(0.2, 0.7), size1: 0.02, life: T.rand(0.5, 1.1),
            color: i % 3 ? 0x9a3ae0 : 0xe040c0,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 + 1.6, vz: T.rand(-1.6, 1.6),
            g: -5, drag: 1.15, spin: T.rand(-26, 26), fadePow: 1.25,
          });
        }
        FXlib.speedLines(fx, 0.5);
      }, 220 + total * 135 + 200);
    },

    /* ---------- 奶鼠 ③「虚空王座」---------- */
    ultraVoidThrone(fx, fighter, opt) {
      opt = opt || {};
      const TX = T.fxTextures, P = fx.pool;
      const dir = fighter.facing;
      FXlib.ultraIntro(fx, fighter, { element: "void", dur: 0.9 });

      const cx = fighter.x + dir * 1.5;

      // ① 虚空法阵展开
      const runeM = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: TX.rune, color: 0x9a3ae0, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      runeM.rotation.x = -Math.PI / 2;
      runeM.position.set(cx, 0.143, 0.2);
      runeM.scale.setScalar(0.5);
      fx.scene.add(runeM);
      fx.decals.push({ mesh: runeM, t: 0, life: 2.8 });
      fx.group(1.6, function (f, gr, k) {
        runeM.scale.setScalar(1.0 + T.easeOut(k) * 4.6);
        runeM.material.rotation -= 0.0035;
        runeM.material.opacity = 0.95 * (1 - k * 0.55);
      });

      // ② 紫黑王座升起
      const throne = fx.group(2.2, function (f, gr, k) {
        const rise = T.easeOut(Math.min(1, k * 1.6));
        const m = gr.meshes[0];
        m.position.set(cx, 0.15 + rise * 1.35, 1.45);
        const sc = 1.5 + rise * 1.9;
        m.scale.set(sc, sc * 1.5, 1);
        m.material.opacity = 0.92 * rise * (1 - Math.max(0, (k - 0.8) / 0.2));
        const g2 = gr.meshes[1];
        g2.position.set(cx, 0.15 + rise * 1.35, 1.4);
        g2.scale.set(sc * 1.35, sc * 1.7, 1);
        g2.material.opacity = 0.5 * rise * (1 - Math.max(0, (k - 0.75) / 0.25));
        g2.material.rotation += 0.003;
      });
      fx.addSprite(throne, { map: TX.voidOrb, x: cx, y: 0.4, z: 1.45, size: 1.5, sy: 1.5, color: 0x4a0a7a, opacity: 0, front: true });
      fx.addSprite(throne, { map: TX.rune, x: cx, y: 0.4, z: 1.4, size: 2.0, sy: 1.7, color: 0xc08aff, opacity: 0, front: true });

      // ③ 四周升起虚空柱
      [-2.0, -1.0, 0, 1.0, 2.0].forEach(function (off, i) {
        setTimeout(function () {
          const px = cx + off * dir;
          const g2 = fx.group(1.1, function (f, gr, k) {
            const m = gr.meshes[0];
            m.position.set(px, 0.1 + T.easeOut(k) * 1.9, 1.3 - i * 0.05);
            m.scale.set(0.42 * (1 - k * 0.35), 3.6 * (0.3 + T.easeOut(k)), 1);
            m.material.opacity = 0.82 * (1 - k);
          });
          fx.addSprite(g2, { map: TX.voidFlame, x: px, y: 0.5, z: 1.3, size: 0.42, sy: 3.6, color: 0x7a2ad8, opacity: 0.82, front: true });
          for (let n = 0; n < 6; n++) {
            P.emit({
              map: TX.voidOrb, front: n === 0,
              x: px + T.rand(-0.20, 0.20), y: T.rand(0.2, 2.2), z: 1.2,
              size: T.rand(0.1, 0.28), size1: 0.01, life: T.rand(0.3, 0.6),
              color: 0xc08aff, vx: T.rand(-0.5, 0.5), vy: T.rand(1.2, 3),
              g: -1, drag: 1.2, spin: T.rand(-16, 16), fadePow: 1.3,
            });
          }
        }, 520 + i * 90);
      });

      // ④ 紫电审判：交叉闪电
      [0.95, 1.25, 1.55].forEach(function (t, i) {
        setTimeout(function () {
          const grp = fx.group(0.3, function (f, gr, k) {
            const m = gr.meshes[0];
            m.position.set(cx + dir * (0.2 - i * 0.25), 1.7 - k * 1.0, 1.5);
            m.scale.set(0.55 + i * 0.15, 3.9 * (1 - k * 0.25), 1);
            m.material.opacity = 0.95 * (1 - k);
            m.material.rotation = (i % 2 ? 0.18 : -0.2) + Math.sin(k * 30) * 0.05;
          });
          fx.addSprite(grp, { map: TX.voidFlame, x: cx, y: 1.5, z: 1.5, size: 0.55, sy: 3.9, color: i % 2 ? 0xf0e0ff : 0xc08aff, opacity: 0.95, front: true });
          FXlib.energyBurst(fx, cx + dir * (0.2 - i * 0.25), 0.85, 0xc08aff, 1.0);
        }, t * 1000);
      });

      // ⑤ 终段：虚空坍缩 + 王座审判爆散
      setTimeout(function () {
        FXlib.energyBurst(fx, cx, 1.1, 0x7a2ad8, 2.1);
        FXlib.pillar(fx, cx, 0xe040c0, 1.0);
        for (let i = 0; i < 58; i++) {
          const a = Math.random() * 6.2832, sp = T.rand(3.5, 13);
          P.emit({
            map: i % 3 === 0 ? TX.darkStar : (i % 3 === 1 ? TX.voidFlame : TX.voidOrb), front: i % 4 === 0,
            x: cx + T.rand(-1.0, 1.0), y: T.rand(0.3, 2.6), z: T.rand(-0.8, 1.5),
            size: T.rand(0.18, 0.72), size1: 0.02, life: T.rand(0.5, 1.15),
            color: i % 3 === 0 ? 0x1a0430 : i % 3 === 1 ? 0x9a3ae0 : 0xe040c0,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 + 1.4, vz: T.rand(-1.6, 1.6),
            g: -4, drag: 1.15, spin: T.rand(-26, 26), fadePow: 1.25,
          });
        }
        FXlib.speedLines(fx, 0.55);
      }, 1900);
    },
  };

  T.FX = FX;
  T.FXlib = FXlib;
})(window.NV);

/* ============================================================
   CG 演出特效 v2 —— 挂在 FXlib 上（cinema.js 配套）
   · ultraBackdrop：大招异空间背景幕 + 地面法阵 + 光柱 + 浮尘
   · heroAura：施法者英雄光环（billboard 辉光 + 升腾粒子）
   · impactFinish：终结命中爆发（十字闪 + 三重环 + 碎片风暴）
   ============================================================ */
(function (NV) {
  "use strict";
  const T = NV;
  const FXlib = T.FXlib;
  if (!FXlib) return;

  /* 双色径向渐变幕布贴图 */
  let backdropTexCache = {};
  function backdropTex(colA, colB) {
    const key = colA + "_" + colB;
    if (backdropTexCache[key]) return backdropTexCache[key];
    const c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 112, 10, 128, 128, 128);
    grd.addColorStop(0, colA);
    grd.addColorStop(0.55, colB);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
    backdropTexCache[key] = t;
    return t;
  }

  /* 大招异空间：整片双色幕布罩住场地 + 旋转法阵 + 双光柱 + 缓升浮尘 */
  FXlib.ultraBackdrop = function (fx, f, colA, colB, dur, sigilTex) {
    dur = dur || 1.6;
    const cx = f.x;
    const grp = fx.group(dur, function (ff, gr, k, dt) {
      const s = gr.meshes;
      /* 幕布：前 12% 淡入，后 22% 淡出，中段缓慢放大 */
      const fade = k < 0.12 ? k / 0.12 : k > 0.78 ? Math.max(0, 1 - (k - 0.78) / 0.22) : 1;
      const m = s[0];
      m.material.opacity = 0.88 * fade;
      const grow = 1 + k * 0.16;
      m.scale.set(30 * grow, 14 * grow, 1);
      m.position.x = cx;
      /* 法阵旋转 + 呼吸 */
      const sg = s[1];
      sg.rotation.z += dt * 0.7;
      sg.material.opacity = (0.3 + 0.12 * Math.sin(k * 12)) * fade;
      const pulse = 4.6 + Math.sin(k * 9) * 0.35;
      sg.scale.set(pulse, pulse, 1);
      sg.position.x = cx;
      /* 双光柱呼吸 */
      for (let p = 2; p <= 3; p++) {
        s[p].material.opacity = (0.16 + 0.08 * Math.sin(k * 10 + p)) * fade;
        s[p].position.x = cx + (p === 2 ? -2.3 : 2.3);
      }
      /* 浮尘升腾 */
      if (Math.random() < 0.75) {
        fx.pool.emit({
          map: Math.random() < 0.5 ? T.fxTextures.dot : T.fxTextures.star,
          x: cx + T.rand(-4.5, 4.5), y: T.rand(0.1, 0.5), z: T.rand(-1.2, 1.2),
          size: T.rand(0.05, 0.2), size1: 0.01, life: T.rand(0.5, 1.0),
          color: Math.random() < 0.5 ? 0xffffff : 0xffe9c0,
          vy: T.rand(0.8, 2.4), vx: T.rand(-0.3, 0.3), g: 0, drag: 0.4,
          spin: T.rand(-10, 10), fadePow: 1.2,
        });
      }
    });
    fx.addPlane(grp, {
      map: backdropTex(colA, colB), x: cx, y: 2.4, z: -3.1,
      size: 30, sy: 14, opacity: 0,
      blending: "add", front: false,
    });
    fx.addPlane(grp, {
      map: sigilTex || T.fxTextures.rune, x: cx, y: 0.055, z: 0,
      rx: -Math.PI / 2, size: 4.6, opacity: 0,
      blending: "add", color: 0xffffff,
    });
    for (const off of [-2.3, 2.3]) {
      fx.addPlane(grp, {
        map: T.fxTextures.dot, x: cx + off, y: 3.4, z: -2.6,
        size: 1.5, sy: 7.4, opacity: 0,
        blending: "add", color: 0xfff2d0,
      });
    }
  };

  /* 施法者英雄光环：身后三层辉光 + 升腾元素粒 */
  FXlib.heroAura = function (fx, f, color, dur) {
    dur = dur || 1.5;
    const grp = fx.group(dur, function (ff, gr, k, dt) {
      const fade = k < 0.15 ? k / 0.15 : k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
      for (let i = 0; i < 3; i++) {
        const m = gr.meshes[i];
        const pulse = 1 + Math.sin(k * 14 + i * 1.9) * 0.07;
        const base = 1.5 + i * 0.55;
        m.scale.set(base * pulse, (base * 1.55) * pulse, 1);
        m.material.opacity = (0.34 - i * 0.09) * fade;
        m.position.set(f.x, f.y + 0.95, -0.55 - i * 0.06);
      }
      if (Math.random() < 0.8) {
        fx.pool.emit({
          map: T.fxTextures.dot,
          x: f.x + T.rand(-0.55, 0.55), y: f.y + T.rand(0.1, 0.4), z: T.rand(-0.3, 0.3),
          size: T.rand(0.06, 0.18), size1: 0.01, life: T.rand(0.4, 0.8),
          color: color, vy: T.rand(1.2, 2.8), g: 0, drag: 0.5, fadePow: 1.2,
        });
      }
    });
    for (let i = 0; i < 3; i++) {
      fx.addSprite(grp, {
        map: T.fxTextures.core, x: f.x, y: f.y + 0.95, z: -0.55 - i * 0.06,
        size: 1.5 + i * 0.55, sy: 1.55, color: color, opacity: 0,
      });
    }
  };

  /* 终结命中：十字闪 + 三重冲击环 + 碎片风暴 + 径向速度线 */
  FXlib.impactFinish = function (fx, x, y, color) {
    const P = fx.pool, TX = T.fxTextures;
    /* 白热十字闪（两个拉长面片，0/90°） */
    const cross = fx.group(0.26, function (ff, gr, k) {
      for (let i = 0; i < 2; i++) {
        const m = gr.meshes[i];
        const w = (i ? 0.5 : 5.2) * (0.6 + 0.5 * (1 - k));
        const h = (i ? 5.2 : 0.5) * (0.6 + 0.5 * (1 - k));
        m.scale.set(w, h, 1);
        m.material.opacity = Math.pow(1 - k, 1.6) * 0.92;
      }
    });
    fx.addPlane(cross, { map: TX.dot, x: x, y: y, z: 0.5, size: 5, sy: 0.09, color: 0xffffff, opacity: 0, front: true });
    fx.addPlane(cross, { map: TX.dot, x: x, y: y, z: 0.5, size: 0.09, sy: 5, color: 0xffffff, opacity: 0, front: true });
    /* 三重冲击环（错相扩散） */
    const rings = fx.group(0.55, function (ff, gr, k) {
      for (let i = 0; i < 3; i++) {
        const kk = clamp01((k - i * 0.12) / 0.76);
        if (kk <= 0) { gr.meshes[i].material.uniforms.uOpacity.value = 0; continue; }
        const m = gr.meshes[i];
        m.scale.setScalar(0.3 + T.easeOut(kk) * (3.4 - i * 0.7));
        m.material.uniforms.uOpacity.value = Math.max(0, (1 - kk) * 0.95);
      }
    });
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    for (let i = 0; i < 3; i++) {
      fx.addRing(rings, { x: x, y: y, z: 0.4, color: i === 0 ? 0xffffff : color, size: 0.3, front: true });
    }
    /* 白核爆闪 */
    P.emit({ map: TX.core, x: x, y: y, z: 0.45, size: 2.1, size1: 0.1, life: 0.3, color: 0xffffff, front: true });
    P.emit({ map: TX.core, x: x, y: y, z: 0.42, size: 1.2, size1: 0.05, life: 0.42, color: color, front: true });
    /* 径向速度线 */
    P.emit({ map: TX.speed, x: x, y: y, z: 0.3, size: 7, size1: 8.4, life: 0.34, color: color, opacity: 0.5, front: true, fadePow: 1.6 });
    /* 碎片风暴 */
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * 6.2832, sp = 3 + Math.random() * 12;
      P.emit({
        map: i % 3 === 0 ? TX.star : (i % 3 === 1 ? TX.ember : TX.dot), front: i % 5 === 0,
        x: x, y: y, z: T.rand(-0.3, 0.5),
        size: T.rand(0.07, 0.3), size1: 0.01, life: T.rand(0.35, 0.8),
        color: i % 4 === 0 ? 0xffffff : color,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.9 + 1.4, vz: T.rand(-1.8, 1.8),
        g: -8, drag: 1.5, spin: T.rand(-30, 30), fadePow: 1.3,
      });
    }
  };

  /* 大招期间持续的能量雨（命中节拍之间的填充特效） */
  FXlib.ultraRain = function (fx, x, color, dur) {
    const grp = fx.group(dur, function (ff, gr, k) {
      if (Math.random() < 0.85) {
        fx.pool.emit({
          map: T.fxTextures.dot,
          x: x + T.rand(-5.5, 5.5), y: T.rand(3.4, 4.4), z: T.rand(-1.4, 1.2),
          size: T.rand(0.04, 0.14), size1: 0.01, life: T.rand(0.4, 0.8),
          color: color, vy: T.rand(-5, -2.4), vx: T.rand(-0.4, 0.4), g: 0,
          fadePow: 1.1,
        });
      }
    });
  };
})(window.NV);
