/* ============================================================
   格斗骨架：打击判定体 + 动画混合器。
   角色外观只来自 Hunyuan GLB（js/glb.js），不再生成程序化立绘。
   ============================================================ */
(function (NV) {
  "use strict";
  const T = NV;

  function vinyl(color, opts) {
    opts = opts || {};
    return new THREE.MeshPhysicalMaterial({
      color: color,
      roughness: opts.roughness == null ? 0.4 : opts.roughness,
      metalness: 0,
      clearcoat: opts.clearcoat == null ? 0.35 : opts.clearcoat,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.4,
    });
  }

  function mesh(geo, mat, pos, rot) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  T.mesh = mesh;
  T.vinyl = vinyl;

  T.attachFightLimbs = function (model, color) {
    const mat = vinyl(color || "#f2d24a", { roughness: 0.38, clearcoat: 0.55 });
    const glow = vinyl("#fff6d0", { roughness: 0.22, clearcoat: 0.7 });
    const fist = mesh(new THREE.SphereGeometry(0.12, 18, 14), mat.clone());
    fist.scale.set(1.15, 0.82, 0.88);
    const foot = mesh(new THREE.SphereGeometry(0.13, 18, 14), mat.clone());
    foot.scale.set(1.45, 0.5, 0.92);
    const belly = mesh(new THREE.SphereGeometry(0.2, 18, 14), glow);
    belly.scale.set(1.35, 1.05, 0.72);
    [fist, foot, belly].forEach(function (m) {
      m.visible = false;
      m.castShadow = false;
      model.root.add(m);
    });
    model.limbs = { fist: fist, foot: foot, belly: belly };
    return model;
  };

  function lerpInto(dst, src, t) {
    for (const k in src) {
      const v = src[k];
      if (typeof v === "number") dst[k] = (dst[k] == null ? 0 : dst[k]) + (v - (dst[k] == null ? 0 : dst[k])) * t;
      else if (v && typeof v === "object") {
        if (!dst[k]) dst[k] = {};
        lerpInto(dst[k], v, t);
      }
    }
  }
  function rotObj(x, y, z) { return { x: x || 0, y: y || 0, z: z || 0 }; }
  T.rotObj = rotObj;

  const GUARD = {
    armL: { sh: { x: -0.28, y: 0, z: 0.16 }, fa: { x: 1.15 }, hand: { x: 0 } },
    armR: { sh: { x: -0.28, y: 0, z: -0.16 }, fa: { x: 1.15 }, hand: { x: 0 } },
  };
  T.GUARD = GUARD;

  function FighterAnim(model) {
    this.model = model;
    this.b = model.bones;
    this.base = JSON.parse(JSON.stringify(model.idle));
    this.tgt = {};
    this.clip = null;
    this.clipT = 0;
    this.clipDur = 0;
    this.clipFn = null;
    this.clipHold = false;
    this.rootY = 0;
    this.squash = 1;
    this.shake = 0;
    this._lean = 0;
    this._spin = 0;
    this.hitAtK = null;
    this.flashTimer = 0;
    this.bigHurt = false;
  }

  FighterAnim.prototype.play = function (name, fn, dur, hold) {
    this.clip = name; this.clipT = 0; this.clipDur = dur; this.clipFn = fn; this.clipHold = !!hold;
    this.hitAtK = null;
  };
  FighterAnim.prototype.stopClip = function (name) {
    if (!name || this.clip === name) this.clip = null;
  };

  FighterAnim.prototype.update = function (dt, tSec, fighter) {
    const tgt = {};
    const br = Math.sin(tSec * 2.6) * 0.5 + 0.5;
    const bounce = Math.sin(tSec * 5.2) * 0.5 + 0.5;
    tgt.body = { y: this.base.bodyY + br * 0.016 };
    tgt.torso = { x: this.base.torsoX, y: Math.sin(tSec * 0.9) * 0.05, z: 0 };
    tgt.neck = { x: this.base.neckX, y: 0, z: 0 };
    tgt.head = { x: -this.base.neckX * 0.6, y: Math.sin(tSec * 0.7) * 0.08, z: 0 };
    tgt.armL = {
      sh: rotObj(GUARD.armL.sh.x - bounce * 0.05, 0, GUARD.armL.sh.z),
      fa: rotObj(GUARD.armL.fa.x + bounce * 0.08), hand: rotObj(),
    };
    tgt.armR = {
      sh: rotObj(GUARD.armR.sh.x - (1 - bounce) * 0.05, 0, GUARD.armR.sh.z),
      fa: rotObj(GUARD.armR.fa.x + (1 - bounce) * 0.08), hand: rotObj(),
    };
    tgt.legL = { hip: rotObj(0.08, 0, 0.06), knee: rotObj(-0.14), ankle: rotObj(0.06) };
    tgt.legR = { hip: rotObj(-0.06, 0, -0.06), knee: rotObj(-0.1), ankle: rotObj(0.05) };
    tgt.rootLean = 0; tgt.rootSpin = 0; tgt.rootY = 0;
    tgt.squash = 0.97 + bounce * 0.05;
    tgt.stretch = 1.02 - bounce * 0.03;
    if (this.b.tail) tgt.tail = {
      t1: rotObj(0.1, Math.sin(tSec * 1.8) * 0.16),
      t2: rotObj(0, Math.sin(tSec * 1.8 + 0.7) * 0.2),
      t3: rotObj(0, Math.sin(tSec * 1.8 + 1.4) * 0.24),
    };

    if (fighter.state === "walk") {
      const s = Math.sin(tSec * 11), c = Math.cos(tSec * 11);
      tgt.legL.hip.x = s * 0.5; tgt.legR.hip.x = -s * 0.5;
      tgt.legL.knee.x = -Math.max(0, -s) * 0.6 - 0.12;
      tgt.legR.knee.x = -Math.max(0, s) * 0.6 - 0.12;
      tgt.armL.sh.x = GUARD.armL.sh.x - s * 0.18;
      tgt.armR.sh.x = GUARD.armR.sh.x + s * 0.18;
      tgt.body.y = br * 0.016 + Math.abs(c) * 0.04;
      tgt.torso.y = c * 0.09;
      tgt.squash = 0.92 + Math.abs(s) * 0.08;
      tgt.stretch = 1.04;
    }
    if (fighter.state === "crouch" || (fighter.crouch && fighter.y <= 0.02 && !this.clip)) {
      tgt.squash = 0.84;
      tgt.torso.x = 0.2;
      tgt.legL.hip.x = 0.42; tgt.legR.hip.x = 0.42;
      tgt.legL.knee.x = -0.65; tgt.legR.knee.x = -0.65;
      tgt.body.y = this.base.bodyY - 0.08;
    }
    if (fighter.y > 0.02 || fighter.state === "jump") {
      tgt.legL.hip.x = -0.45; tgt.legR.hip.x = -0.2;
      tgt.legL.knee.x = 0.7; tgt.legR.knee.x = 0.5;
      tgt.armL.sh.z = 0.7; tgt.armR.sh.z = -0.7;
      const up = fighter.vy > 0.4;
      tgt.squash = up ? 1.16 : 0.78;
      tgt.stretch = up ? 0.88 : 1.14;
    }
    if (fighter.state === "hurt") {
      tgt.squash = 0.72;
      tgt.stretch = 1.18;
    }

    if (this.clip && this.clipFn) {
      const k = Math.min(1, this.clipT / this.clipDur);
      this.clipFn(tgt, k, { fighter: fighter, tail: !!this.b.tail, anim: this, big: !!this.bigHurt, hitAt: this.hitAtK });
    }

    lerpInto(this.tgt, tgt, 1 - Math.exp(-16 * dt));
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 4);
      this.tgt.torso.z = (this.tgt.torso.z || 0) + Math.sin(tSec * 60) * 0.05 * this.shake;
    }
    this.clipT += dt;
    if (this.clip && this.clipT >= this.clipDur + 0.06 && !this.clipHold) this.clip = null;

    const T2 = this.tgt, B = this.b;
    B.body.position.y = this.base.bodyY + (T2.body && T2.body.y || 0) + this.rootY;
    B.torso.position.set(0, this.base.torsoY, 0);
    B.torso.rotation.set(
      (T2.torso.x || 0) * 0.22,
      (T2.torso.y || 0) * 0.12,
      (T2.torso.z || 0) * 0.22
    );
    this.squash = T2.squash == null ? this.squash : T2.squash;
    this.stretch = T2.stretch == null ? 1 : T2.stretch;
    B.torso.scale.set(1, 1, 1);
    B.neck.rotation.set(T2.neck.x || 0, T2.neck.y || 0, T2.neck.z || 0);
    B.head.rotation.set(T2.head.x || 0, T2.head.y || 0, T2.head.z || 0);
    function setArm(a, v) {
      a.sh.rotation.set(v.sh.x || 0, v.sh.y || 0, v.sh.z || 0);
      a.fa.rotation.set(v.fa.x || 0, v.fa.y || 0, v.fa.z || 0);
      if (a.hand) a.hand.rotation.set(v.hand && v.hand.x || 0, 0, 0);
    }
    setArm(B.armL, T2.armL); setArm(B.armR, T2.armR);
    function setLeg(l, v) {
      l.hip.rotation.set(v.hip.x || 0, v.hip.y || 0, v.hip.z || 0);
      l.knee.rotation.set(v.knee.x || 0, 0, 0);
      if (l.ankle) l.ankle.rotation.set(v.ankle && v.ankle.x || 0, 0, 0);
    }
    setLeg(B.legL, T2.legL); setLeg(B.legR, T2.legR);
    if (B.tail && T2.tail) {
      B.tail.t1.rotation.set(T2.tail.t1.x || 0.1, T2.tail.t1.y || 0, 0);
      B.tail.t2.rotation.set(T2.tail.t2.x || 0, T2.tail.t2.y || 0, 0);
      B.tail.t3.rotation.set(0, T2.tail.t3.y || 0, 0);
    }
    const damp = function (self, key, target, lambda) {
      const cur = self[key];
      self[key] = cur == null ? target : cur + (target - cur) * (1 - Math.exp(-lambda * dt));
    };
    damp(this, "_lean", T2.rootLean || 0, 14);
    damp(this, "_spin", T2.rootSpin || 0, 26);
  };

  FighterAnim.prototype.applyRoot = function (fighter, faceAngle) {
    this.model.root.position.set(fighter.x, fighter.y + 0.02, 0);
    this.model.root.rotation.set((this._lean || 0) * 1.15, faceAngle + (this._spin || 0) * 0.08, -(this.tgt.torso && this.tgt.torso.z || 0) * 0.08);
    if (this.b.visual) {
      const sq = this.squash == null ? 1 : this.squash;
      const st = this.stretch == null ? 1 : this.stretch;
      this.b.visual.scale.set(st, Math.max(0.7, sq), (st + 1) * 0.5);
    }
  };

  FighterAnim.prototype.flashMaterial = function (color, power) {
    const mats = this.model.mats;
    for (const k in mats) {
      const m = mats[k];
      if (!m || !m.emissive) continue;
      m.emissive.set(power > 0.001 ? color : 0x000000);
      m.emissiveIntensity = Math.min(0.22, power);
    }
  };

  T.FighterAnim = FighterAnim;
})(window.NV);
