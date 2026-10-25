/* ============================================================
   CG 演出导演 —— 大招电影运镜 / KO 定格 / 回合入场长镜头
   · 关键帧轨道：机位(相对施法者) + 注视点 + FOV + 滚转
   · 手持噪声：确定性问题噪声，帧率无关
   · 顺带修复：FOV 冲击此前从未应用到相机
   纯脚本，挂在 window.NV.Cinema。
   ============================================================ */
(function (T) {
  "use strict";
  const clamp = T.clamp;
  const BASE_FOV = 40;

  function pseudoNoise(t, seed) {
    const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }
  function segEase(k) {
    return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  }

  /* ---------- 机位轨道库 ----------
     key: { t, p:[前向偏移, 高度, 屏前距离], l:[前向偏移, 高度], fov, roll }
     前向偏移以施法者朝向为正（面向敌人一侧）。 */
  var TRACKS = {
    /* 回合开场：高机位横移推近 → 落回格斗机位 */
    intro: {
      dur: 1.15,
      keys: [
        { t: 0, p: [-4.4, 2.7, 6.6], l: [0, 0.55], fov: 47, roll: 0.05 },
        { t: 0.55, p: [-1.1, 1.7, 5.0], l: [0, 0.85], fov: 42, roll: 0.015 },
        { t: 1, p: [0, 1.38, 5.65], l: [0, 0.92], fov: 40, roll: 0 },
      ],
    },
    /* 奶龙·超必（50 气）：快推贴脸 */
    superNaiwa: {
      dur: 0.6,
      keys: [
        { t: 0, p: [-1.6, 1.6, 3.6], l: [0.2, 0.95], fov: 43, roll: 0.02 },
        { t: 0.6, p: [0.9, 1.0, 2.5], l: [0.2, 0.9], fov: 37, roll: -0.035 },
      ],
    },
    /* 美鼠·超必（50 气）：环绕甩尾跟拍 */
    superMeishu: {
      dur: 0.62,
      keys: [
        { t: 0, p: [-2.0, 1.4, 3.2], l: [0.1, 0.9], fov: 43, roll: -0.02 },
        { t: 0.6, p: [1.1, 1.1, 2.6], l: [0.15, 0.85], fov: 37, roll: 0.04 },
      ],
    },
    /* 奶龙·壹「九转炎龙破」：侧高位弧线 → 正面低位贴脸 → 拉回 */
    naiwaU1: {
      dur: 0.95,
      keys: [
        { t: 0, p: [-1.9, 1.8, 3.4], l: [0.3, 0.95], fov: 44, roll: 0.03 },
        { t: 0.52, p: [1.0, 0.78, 2.1], l: [0.15, 0.92], fov: 35, roll: -0.055 },
        { t: 1, p: [1.6, 1.15, 4.8], l: [0.25, 0.9], fov: 46, roll: 0 },
      ],
    },
    /* 奶龙·贰「奶河焚天」：贴地仰拍托天 → 缓升 → 拉回 */
    naiwaU2: {
      dur: 0.95,
      keys: [
        { t: 0, p: [1.15, 0.3, 2.35], l: [0, 1.6], fov: 40, roll: -0.03 },
        { t: 0.55, p: [0.7, 0.88, 1.95], l: [0, 1.72], fov: 34, roll: 0.035 },
        { t: 1, p: [1.2, 1.12, 4.6], l: [0, 1.2], fov: 46, roll: 0 },
      ],
    },
    /* 奶龙·叁「炎帝临世」：顶轨俯瞰 → 直冲贴脸 → 极低位英雄机位 → 拉回 */
    naiwaU3: {
      dur: 1.35,
      keys: [
        { t: 0, p: [-2.6, 3.5, 5.6], l: [0, 0.45], fov: 48, roll: 0.06 },
        { t: 0.42, p: [1.4, 1.0, 2.4], l: [0.1, 1.0], fov: 36, roll: -0.04 },
        { t: 0.72, p: [0.85, 0.42, 1.95], l: [0, 1.4], fov: 33, roll: 0.075 },
        { t: 1, p: [1.7, 1.3, 5.0], l: [0.2, 1.0], fov: 46, roll: 0 },
      ],
    },
    /* 美鼠·壹「紫渊吞噬」：越肩看向裂隙 → 侧移 → 拉回 */
    meishuU1: {
      dur: 0.95,
      keys: [
        { t: 0, p: [-1.35, 1.5, 2.6], l: [1.7, 1.0], fov: 42, roll: 0.025 },
        { t: 0.5, p: [-0.9, 1.15, 2.2], l: [1.35, 0.95], fov: 36, roll: -0.03 },
        { t: 1, p: [1.5, 1.15, 4.7], l: [0.5, 0.9], fov: 46, roll: 0 },
      ],
    },
    /* 美鼠·贰「暗星陨灭」：仰拍追星 → 甩镜落地 → 拉回 */
    meishuU2: {
      dur: 1.05,
      keys: [
        { t: 0, p: [1.2, 0.68, 2.6], l: [0.3, 2.7], fov: 40, roll: 0.03 },
        { t: 0.5, p: [0.9, 0.92, 2.3], l: [0.5, 3.3], fov: 35, roll: -0.025 },
        { t: 0.78, p: [1.0, 1.65, 3.0], l: [1.3, 0.25], fov: 44, roll: -0.06 },
        { t: 1, p: [1.6, 1.2, 4.8], l: [0.6, 0.7], fov: 46, roll: 0 },
      ],
    },
    /* 美鼠·叁「虚空王座」：正面对称缓推 → 微滚 → 拉回 */
    meishuU3: {
      dur: 1.3,
      keys: [
        { t: 0, p: [0, 1.5, 6.1], l: [0, 1.0], fov: 44, roll: 0.05 },
        { t: 0.55, p: [0.35, 1.32, 3.1], l: [0, 1.05], fov: 36, roll: -0.035 },
        { t: 0.8, p: [0.5, 1.0, 2.6], l: [0, 1.15], fov: 34, roll: 0.05 },
        { t: 1, p: [1.5, 1.2, 4.8], l: [0.2, 0.95], fov: 46, roll: 0 },
      ],
    },
    /* KO 定格：侧向移轴掠过倒地者 */
    ko: {
      dur: 1.05,
      keys: [
        { t: 0, p: [-1.45, 1.5, 2.9], l: [0.3, 0.9], fov: 38, roll: 0.04 },
        { t: 0.55, p: [0.9, 0.98, 2.3], l: [0.2, 0.85], fov: 34, roll: -0.06 },
        { t: 1, p: [2.0, 1.25, 5.0], l: [0.4, 0.9], fov: 46, roll: 0 },
      ],
    },
  };

  function Cinema() {
    this.active = false;
    this.kind = "";
    this.t = 0;
    this.track = null;
    this.subject = null;
    this.face = 1;
    this.settle = 0;
    this._endFov = 40;
    this._introProxy = null;
  }

  Cinema.prototype._start = function (kind, subject, face) {
    const tr = TRACKS[kind];
    if (!tr || !subject) return;
    this.active = true;
    this.kind = kind;
    this.track = tr;
    this.subject = subject;
    this.face = face == null ? 1 : face;
    this.t = 0;
    this.settle = 0.32;
    this._endFov = tr.keys[tr.keys.length - 1].fov;
    document.body.classList.add("cine");
  };

  Cinema.prototype.playUltra = function (f, tier) {
    const key = f.id + "U" + tier;
    if (!TRACKS[key]) return false;
    this._start(key, f, f.facing);
    return true;
  };
  Cinema.prototype.playSuper = function (f) {
    this._start(f.id === "naiwa" ? "superNaiwa" : "superMeishu", f, f.facing);
  };
  Cinema.prototype.playKO = function (loser) {
    this._start("ko", loser, loser.facing);
  };
  Cinema.prototype.playIntro = function (midProxy) {
    this._introProxy = midProxy;
    this._start("intro", midProxy, 1);
  };
  Cinema.prototype.stop = function () {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove("cine");
  };

  /* 每帧应用：未激活时只做回落缓动；激活时完全接管机位 */
  Cinema.prototype.apply = function (camera, raw, elapsed) {
    if (this.active) {
      this.t += raw;
      const dur = this.track.dur;
      if (this.t >= dur || !this.subject) {
        this.active = false;
        document.body.classList.remove("cine");
      } else {
        const keys = this.track.keys;
        let i = 0;
        while (i < keys.length - 2 && this.t >= keys[i + 1].t * dur) i++;
        const a = keys[i], b = keys[i + 1];
        const k = clamp((this.t - a.t * dur) / Math.max(1e-4, (b.t - a.t) * dur), 0, 1);
        const e = segEase(k);
        const sx = this.subject.x || 0;
        const sy = this.subject.y || 0;
        const f = this.face;
        const px = sx + f * (a.p[0] + (b.p[0] - a.p[0]) * e);
        const py = (a.p[1] + (b.p[1] - a.p[1]) * e);
        const pz = a.p[2] + (b.p[2] - a.p[2]) * e;
        const lx = sx + f * (a.l[0] + (b.l[0] - a.l[0]) * e);
        const ly = sy + (a.l[1] + (b.l[1] - a.l[1]) * e);
        const fov = a.fov + (b.fov - a.fov) * e;
        const roll = a.roll + (b.roll - a.roll) * e;
        /* 手持呼吸噪声：小幅度，绝不干扰读帧 */
        const nz = this.kind === "intro" ? 0.4 : 1;
        const nx = pseudoNoise(elapsed * 9, 1) * 0.02 * nz;
        const ny = pseudoNoise(elapsed * 7.4, 2) * 0.016 * nz;
        camera.position.set(px + nx, Math.max(0.24, py + ny), pz);
        camera.lookAt(lx, ly, 0);
        camera.rotateZ(roll + pseudoNoise(elapsed * 5.6, 3) * 0.006);
        camera.fov = clamp(fov, 24, 60);
        camera.updateProjectionMatrix();
        return;
      }
    }
    /* 回落：轨道末端 FOV 平滑回基准（普通机位在 game.js 每帧重写位置） */
    if (this.settle > 0) {
      this.settle = Math.max(0, this.settle - raw);
      const k = this.settle / 0.32;
      camera.fov = clamp(BASE_FOV + (this._endFov - BASE_FOV) * k, 24, 60);
      camera.updateProjectionMatrix();
    }
  };

  /* 是否正在接管 FOV（game.js 据此跳过自己的 FOV 写入） */
  Cinema.prototype.holdsFov = function () {
    return this.active || this.settle > 0;
  };

  T.Cinema = new Cinema();
})(window.NV);
