/* ============================================================
   bootfx.js v2 —— 加载页 Canvas 演出（绚丽背景版）
   背景：双色能量对撞（左金焰/右紫渊）+ 星云团漂移 + 旋转光束
        + 闪电弧 + 流星能量划痕 + 中央冲击环，强度随进度提升
   前景：旋转双重法阵 + 角色徽章（阶段切换交叉淡化）+ 能量束进度
   挂在 window.NV.BootFX。
   ============================================================ */
window.NV = window.NV || {};
(function (NV) {
  "use strict";

  var GOLD = [255, 170, 70];
  var VIOLET = [150, 90, 255];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  var BootFX = {
    _cv: null, _g: null, _raf: 0, _t0: 0, _run: false, _d: 1,
    _pct: 0, _kind: "naiwa", _prevKind: "naiwa", _fade: 1,
    _imgs: { naiwa: null, meishu: null },
    _getPct: null, _getKind: null,

    /* 背景元素池 */
    _clouds: [], _embers: [], _streaks: [], _arcs: [],
    _ringT: 0, _streakT: 0, _arcT: 0,
    _beams: [{ a: -0.5, sp: 0.11, w: 0.16 }, { a: 0, sp: -0.08, w: 0.2 }, { a: 0.5, sp: 0.07, w: 0.13 }],

    start: function (canvas, getters) {
      this._cv = canvas;
      this._g = canvas.getContext("2d");
      this._getPct = getters && getters.pct || function () { return 0; };
      this._getKind = getters && getters.kind || function () { return "naiwa"; };
      this._live3d = !!(getters && getters.live3d);
      this._loadImg("naiwa");
      this._loadImg("meishu");
      var self = this;
      function fit() {
        if (!self._cv) return;
        var d = Math.min(window.devicePixelRatio || 1, 2);
        self._cv.width = innerWidth * d;
        self._cv.height = innerHeight * d;
        self._d = d;
      }
      this._fit = fit;
      fit();
      window.addEventListener("resize", fit);
      /* 星云团：8 个大团，两色系 */
      this._clouds.length = 0;
      for (var i = 0; i < 9; i++) {
        this._clouds.push({
          x: Math.random(), y: rnd(0.15, 0.9),
          r: rnd(0.16, 0.34),
          hue: i % 3 === 2 ? 1 : 0,
          ph: rnd(0, 6.28), sp: rnd(0.02, 0.06),
          a: rnd(0.10, 0.18),
        });
      }
      /* 余烬：80 颗，三种形态（光点/星芒/波景） */
      this._embers.length = 0;
      for (i = 0; i < 80; i++) { var em = this._mkEmber(true); em.hue = em.x < 0.5 ? (Math.random() < 0.8 ? 0 : 1) : (Math.random() < 0.75 ? 1 : 0); this._embers.push(em); }
      this._streaks.length = 0;
      this._arcs.length = 0;
      this._streakT = 0.4; this._arcT = 0.9; this._ringT = 0;
      this._t0 = performance.now();
      this._run = true;
      var loop = function (ts) {
        if (!self._run) return;
        self._draw(ts);
        self._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    },

    stop: function () {
      this._run = false;
      cancelAnimationFrame(this._raf);
      window.removeEventListener("resize", this._fit);
      if (this._cv) this._cv.style.display = "none";
    },

    _loadImg: function (kind) {
      var self = this;
      var im = new Image();
      im.onload = function () { self._imgs[kind] = im; };
      im.src = kind === "naiwa" ? "assets/naiwa-portrait.jpg?v=p2" : "assets/meishu-portrait.jpg?v=p2";
    },

    _mkEmber: function (anyY) {
      var r = Math.random();
      return {
        x: Math.random(), y: anyY ? Math.random() : 1.06,
        r: r < 0.72 ? rnd(0.9, 2.4) : r < 0.9 ? rnd(2.6, 4.4) : rnd(5, 9),
        v: rnd(0.05, 0.16),
        sw: rnd(0.4, 1.5), ph: rnd(0, 6.28),
        a: rnd(0.34, 0.68),
        type: r < 0.72 ? 0 : r < 0.9 ? 1 : 2,   // 0 光点 1 星芒 2 波景
        hue: 0,
      };
    },

    _draw: function (ts) {
      var cv = this._cv, g = this._g, d = this._d;
      if (!cv || !g) return;
      var W = cv.width, H = cv.height, t = (ts - this._t0) / 1000;
      g.clearRect(0, 0, W, H);

      this._pct = this._getPct();
      var kind = this._getKind();
      if (kind !== this._kind) { this._prevKind = this._kind; this._kind = kind; this._fade = 0; }
      this._fade = Math.min(1, this._fade + 0.04);

      var p = Math.max(0, Math.min(1, this._pct / 100));
      var I = 1.0 + p * 0.35;                        // 开场即绚丽，进度再加分
      var Ibg = I * (this._live3d ? 0.45 : 1);       // live 3D 模式：背景层让位给真实舞台

      g.globalCompositeOperation = "lighter";

      /* ============ 1. 双色能量对撞（左金 / 右紫） ============ */
      var aw = W * (0.16 + 0.03 * Math.sin(t * 1.1));
      this._sideAura(g, 0, H, aw, GOLD, t, Ibg);
      this._sideAura(g, W, H, aw, VIOLET, t + 2.4, Ibg);
      /* 底部地面能量辉光：左金右紫向中间汇聚上扬 */
      var grL = g.createLinearGradient(0, H, 0, H * 0.58);
      grL.addColorStop(0, rgba(GOLD, 0.30 * Ibg));
      grL.addColorStop(1, rgba(GOLD, 0));
      g.fillStyle = grL;
      g.fillRect(0, H * 0.58, W / 2, H * 0.42);
      var grR = g.createLinearGradient(0, H, 0, H * 0.58);
      grR.addColorStop(0, rgba(VIOLET, 0.30 * Ibg));
      grR.addColorStop(1, rgba(VIOLET, 0));
      g.fillStyle = grR;
      g.fillRect(W / 2, H * 0.58, W / 2, H * 0.42);
      /* 中央贴地能量池：双色交汇的能量汇聚感 */
      var pool = g.createRadialGradient(W / 2, H * 0.97, 0, W / 2, H * 0.97, W * 0.4);
      pool.addColorStop(0, rgba([255, 205, 140], 0.18 * Ibg));
      pool.addColorStop(0.45, rgba([215, 150, 255], 0.11 * Ibg));
      pool.addColorStop(1, [0, 0, 0, 0]);
      g.fillStyle = pool;
      g.fillRect(W * 0.1, H * 0.62, W * 0.8, H * 0.38);
      /* 中线交汇辉光 */
      var clash = g.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.24);
      clash.addColorStop(0, rgba(GOLD, 0.16 * I));
      clash.addColorStop(0.5, rgba(VIOLET, 0.12 * I));
      clash.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = clash;
      g.fillRect(0, 0, W, H);

      /* ============ 2. 星云团漂移 ============ */
      for (var i = 0; i < this._clouds.length; i++) {
        var c = this._clouds[i];
        var cx = (c.x + Math.sin(t * c.sp + c.ph) * 0.05) * W;
        var cy = (c.y + Math.cos(t * c.sp * 0.8 + c.ph) * 0.03) * H;
        var cr = c.r * Math.min(W, H) * (1 + 0.12 * Math.sin(t * 0.5 + c.ph));
        var col = c.hue ? VIOLET : GOLD;
        var cg = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
        cg.addColorStop(0, rgba(col, c.a * Ibg));
        cg.addColorStop(1, rgba(col, 0));
        g.fillStyle = cg;
        g.beginPath(); g.arc(cx, cy, cr, 0, 6.2832); g.fill();
      }

      /* 角落呼吸光斑（增强纵深） */
      var corners = [[0.06, 0.12, 0], [0.94, 0.1, 1], [0.08, 0.88, 1], [0.92, 0.9, 0]];
      for (i = 0; i < corners.length; i++) {
        var co = corners[i];
        var cxx = co[0] * W, cyy = co[1] * H;
        var crr = Math.min(W, H) * 0.13 * (1 + 0.18 * Math.sin(t * 0.8 + i * 1.7));
        var cc = co[2] ? VIOLET : GOLD;
        var cog = g.createRadialGradient(cxx, cyy, 0, cxx, cyy, crr);
        cog.addColorStop(0, rgba(cc, 0.10 * Ibg));
        cog.addColorStop(1, rgba(cc, 0));
        g.fillStyle = cog;
        g.beginPath(); g.arc(cxx, cyy, crr, 0, 6.2832); g.fill();
      }

      /* ============ 3. 顶部旋转光束 ============ */
      g.save();
      g.translate(W / 2, -H * 0.05);
      for (i = 0; i < this._beams.length; i++) {
        var b = this._beams[i];
        var a = b.a + Math.sin(t * b.sp) * 0.35;
        var len = H * 1.35, wHalf = len * b.w * 0.5;
        var dx = Math.sin(a), dy = Math.cos(a);
        var px = -dy, py = dx;
        var bg = g.createLinearGradient(0, 0, dx * len, dy * len);
        var bc = i === 1 ? [255, 220, 150] : (i === 0 ? GOLD : VIOLET);
        bg.addColorStop(0, rgba(bc, 0.16 * I));
        bg.addColorStop(1, rgba(bc, 0));
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(dx * len + px * wHalf, dy * len + py * wHalf);
        g.lineTo(dx * len - px * wHalf, dy * len - py * wHalf);
        g.closePath(); g.fill();
      }
      g.restore();

      /* ============ 4. 中央冲击环（每 1.6s 一发） ============ */
      this._ringT += 1 / 60;
      if (this._ringT > 1.6) this._ringT = 0;
      var rk = this._ringT / 1.6;
      if (rk < 0.7) {
        var rr = rk / 0.7;
        var ra = (1 - rr) * 0.26 * I;
        g.strokeStyle = rgba([255, 225, 170], ra);
        g.lineWidth = (2.5 - rr * 1.8) * d;
        g.beginPath();
        g.arc(W / 2, H * 0.42, Math.min(W, H) * (0.1 + rr * 0.42), 0, 6.2832);
        g.stroke();
      }

      /* ============ 5. 流星能量划痕 ============ */
      this._streakT -= 1 / 60;
      if (this._streakT <= 0) {
        this._streakT = rnd(0.5, 1.3);
        var fromL = Math.random() < 0.5;
        this._streaks.push({
          x: fromL ? rnd(0.02, 0.3) : rnd(0.7, 0.98),
          y: rnd(-0.05, 0.25),
          vx: (fromL ? 1 : -1) * rnd(0.25, 0.5),
          vy: rnd(0.35, 0.6),
          life: rnd(0.5, 0.8), t: 0,
          hue: Math.random() < 0.55 ? 0 : 1,
        });
      }
      for (i = this._streaks.length - 1; i >= 0; i--) {
        var s = this._streaks[i];
        s.t += 1 / 60;
        if (s.t >= s.life) { this._streaks.splice(i, 1); continue; }
        var sk = s.t / s.life;
        var sx = s.x * W, sy = s.y * H;
        var tailX = sx - s.vx * W * 0.05, tailY = sy - s.vy * H * 0.05;
        var sg = g.createLinearGradient(tailX, tailY, sx, sy);
        var sc = s.hue ? VIOLET : GOLD;
        sg.addColorStop(0, rgba(sc, 0));
        sg.addColorStop(1, rgba([255, 245, 220], (1 - sk) * 0.75));
        g.strokeStyle = sg;
        g.lineWidth = 2.2 * d * (1 - sk * 0.6);
        g.beginPath(); g.moveTo(tailX, tailY); g.lineTo(sx, sy); g.stroke();
        s.x += s.vx / 60; s.y += s.vy / 60;
        var hg = g.createRadialGradient(sx, sy, 0, sx, sy, 10 * d);
        hg.addColorStop(0, rgba([255, 250, 235], (1 - sk) * 0.8));
        hg.addColorStop(1, rgba(sc, 0));
        g.fillStyle = hg;
        g.beginPath(); g.arc(sx, sy, 10 * d, 0, 6.2832); g.fill();
      }

      /* ============ 6. 闪电能量弧 ============ */
      this._arcT -= 1 / 60;
      if (this._arcT <= 0) {
        this._arcT = rnd(0.6, 1.4);
        var side = Math.random() < 0.5;
        var ax0 = side ? rnd(0.03, 0.16) : rnd(0.84, 0.97);
        var ay0 = rnd(0.15, 0.6);
        var ax1 = W / 2 + (side ? 1 : -1) * rnd(0.05, 0.22) * W;
        var ay1 = rnd(0.3, 0.62);
        var pts = [];
        var SEG = 9;
        for (var k2 = 0; k2 <= SEG; k2++) {
          var kk = k2 / SEG;
          var jx = (Math.random() - 0.5) * W * 0.03 * Math.sin(kk * Math.PI);
          var jy = (Math.random() - 0.5) * H * 0.05 * Math.sin(kk * Math.PI);
          pts.push([ax0 * W + (ax1 - ax0 * W) * kk + jx, ay0 * H + (ay1 - ay0 * H) * kk + jy]);
        }
        this._arcs.push({ pts: pts, t: 0, life: 0.22, hue: side ? 0 : 1 });
      }
      for (i = this._arcs.length - 1; i >= 0; i--) {
        var arc = this._arcs[i];
        arc.t += 1 / 60;
        if (arc.t >= arc.life) { this._arcs.splice(i, 1); continue; }
        var ak = 1 - arc.t / arc.life;
        var ac = arc.hue ? VIOLET : GOLD;
        g.strokeStyle = rgba([235, 220, 255], ak * 0.7);
        g.lineWidth = 1.6 * d;
        g.beginPath();
        g.moveTo(arc.pts[0][0], arc.pts[0][1]);
        for (k2 = 1; k2 < arc.pts.length; k2++) g.lineTo(arc.pts[k2][0], arc.pts[k2][1]);
        g.stroke();
        /* 辉光层 */
        g.strokeStyle = rgba(ac, ak * 0.4);
        g.lineWidth = 5 * d;
        g.stroke();
      }

      /* ============ 7. 余烬粒子（三形态） ============ */
      for (i = 0; i < this._embers.length; i++) {
        var e = this._embers[i];
        e.y -= e.v * 0.004 * (e.type === 2 ? 0.5 : 1);
        if (e.y < -0.06) { var em2 = this._mkEmber(false); em2.hue = em2.x < 0.5 ? (Math.random() < 0.8 ? 0 : 1) : (Math.random() < 0.75 ? 1 : 0); this._embers[i] = em2; continue; }
        var ex = (e.x + Math.sin(t * e.sw + e.ph) * 0.014) * W;
        var ey = e.y * H;
        var col = e.hue ? VIOLET : GOLD;
        var tw = 0.75 + 0.25 * Math.sin(t * 4 + e.ph * 3);      // 闪烁
        if (e.type === 1) {
          /* 星芒：十字 */
          var L = e.r * d * 3 * tw;
          g.strokeStyle = rgba([255, 246, 225], e.a * tw * 0.8);
          g.lineWidth = 1.2 * d;
          g.beginPath();
          g.moveTo(ex - L, ey); g.lineTo(ex + L, ey);
          g.moveTo(ex, ey - L); g.lineTo(ex, ey + L);
          g.stroke();
          var sg2 = g.createRadialGradient(ex, ey, 0, ex, ey, L);
          sg2.addColorStop(0, rgba(col, e.a * tw));
          sg2.addColorStop(1, rgba(col, 0));
          g.fillStyle = sg2;
          g.beginPath(); g.arc(ex, ey, L, 0, 6.2832); g.fill();
        } else {
          var rr2 = e.r * d * (1 + Math.sin(t * 3 + e.ph) * 0.22) * tw;
          var eg = g.createRadialGradient(ex, ey, 0, ex, ey, rr2 * (e.type === 2 ? 5 : 4));
          eg.addColorStop(0, rgba(e.type === 2 ? col : [255, 236, 190], e.a * tw));
          eg.addColorStop(1, rgba(col, 0));
          g.fillStyle = eg;
          g.beginPath(); g.arc(ex, ey, rr2 * (e.type === 2 ? 5 : 4), 0, 6.2832); g.fill();
        }
      }

      /* ============ 8. 前景：法阵 + 徽章 + 能量束 ============ */
      this._drawSigil(g, W, H, t, d, I);
      g.globalCompositeOperation = "source-over";
    },

    /* 左右能量柱：竖向渐变 + 波动边缘 + 上升微粒 */
    _sideAura: function (g, x0, H, w, col, t, I) {
      var g2 = this._g;
      var side = x0 === 0 ? 1 : -1;
      var steps = 7;
      for (var i = 0; i < steps; i++) {
        var yy = H * (i / steps);
        var hh = H / steps + 2;
        var ww = w * (0.65 + 0.35 * Math.sin(t * 1.6 + i * 0.9));
        var lx = x0 === 0 ? 0 : x0 - ww;
        var lg = g2.createLinearGradient(x0 === 0 ? 0 : x0, 0, x0 === 0 ? ww : x0 - ww, 0);
        lg.addColorStop(0, rgba(col, 0.22 * I));
        lg.addColorStop(0.7, rgba(col, 0.09 * I));
        lg.addColorStop(1, rgba(col, 0));
        g2.fillStyle = lg;
        g2.fillRect(lx, yy, ww, hh);
      }
    },

    _drawSigil: function (g, W, H, t, d, I) {
      var cx = W / 2, cy = H * 0.42;
      var R = Math.min(W, H) * 0.215;
      var p = Math.max(0, Math.min(1, this._pct / 100));

      /* 双重旋转环 */
      g.save();
      g.translate(cx, cy);
      g.lineWidth = 2 * d;
      g.strokeStyle = "rgba(255,190,110,0.6)";
      g.beginPath(); g.arc(0, 0, R, 0, 6.2832); g.stroke();
      g.rotate(t * 0.35);
      g.setLineDash([R * 0.28, R * 0.14]);
      g.strokeStyle = "rgba(255,225,160,0.85)";
      g.lineWidth = 2.4 * d;
      g.beginPath(); g.arc(0, 0, R * 0.88, 0, 6.2832); g.stroke();
      g.setLineDash([]);
      g.rotate(-t * 0.91);
      g.strokeStyle = "rgba(255,200,120,0.55)";
      g.lineWidth = 2 * d;
      for (var k = 0; k < 36; k++) {
        var a = k / 36 * 6.2832;
        var long = k % 3 === 0;
        g.beginPath();
        g.moveTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97);
        g.lineTo(Math.cos(a) * R * (long ? 1.06 : 1.02), Math.sin(a) * R * (long ? 1.06 : 1.02));
        g.stroke();
      }
      /* 进度弧（双弧：金 + 紫跟随时差） */
      g.strokeStyle = "rgba(255,238,190,0.95)";
      g.lineWidth = 3.6 * d;
      g.beginPath();
      g.arc(0, 0, R * 1.12, -1.5708, -1.5708 + 6.2832 * p);
      g.stroke();
      g.strokeStyle = "rgba(190,130,255,0.45)";
      g.lineWidth = 2.2 * d;
      g.beginPath();
      g.arc(0, 0, R * 1.2, -1.5708, -1.5708 + 6.2832 * Math.max(0, p - 0.035));
      g.stroke();
      g.restore();

      /* 角色徽章 */
      g.save();
      var glow = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.55);
      glow.addColorStop(0, "rgba(255,205,130," + (0.3 * I) + ")");
      glow.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = glow;
      g.fillRect(cx - R * 1.6, cy - R * 1.6, R * 3.2, R * 3.2);
      g.beginPath(); g.arc(cx, cy, R * 0.7, 0, 6.2832); g.clip();
      g.fillStyle = "#140c08";
      g.fillRect(cx - R, cy - R, R * 2, R * 2);
      this._drawPortrait(g, this._prevKind, cx, cy, R, 1 - this._fade);
      this._drawPortrait(g, this._kind, cx, cy, R, this._fade);
      g.restore();
      g.strokeStyle = "rgba(255,228,165,0.95)";
      g.lineWidth = 3 * d;
      g.beginPath(); g.arc(cx, cy, R * 0.7, 0, 6.2832); g.stroke();
      /* 徽章顶点小灯 */
      var la = t * 2.2;
      g.fillStyle = "rgba(255,250,230,0.95)";
      g.beginPath();
      g.arc(cx + Math.cos(la) * R * 0.7, cy + Math.sin(la) * R * 0.7, 3 * d, 0, 6.2832);
      g.fill();

      /* 能量束进度条 */
      var bw = Math.min(W * 0.52, 560 * d), bh = 7 * d;
      var bx = cx - bw / 2, by = cy + R * 1.32 + 26 * d;
      g.globalCompositeOperation = "source-over";
      g.fillStyle = "rgba(46,32,18,0.85)";
      this._rr(g, bx - 3 * d, by - 3 * d, bw + 6 * d, bh + 6 * d, 5 * d);
      g.fill();
      g.strokeStyle = "rgba(255,200,120,0.35)";
      g.lineWidth = 1.2 * d;
      g.stroke();
      g.globalCompositeOperation = "lighter";
      /* 常亮能量通道：低进度时轨道也不会显得空槽 */
      var shim = 0.5 + 0.5 * Math.sin(t * 2.4);
      var chg = g.createLinearGradient(bx, by, bx + bw, by);
      chg.addColorStop(0, rgba([255, 150, 60], 0.06 + 0.05 * shim));
      chg.addColorStop(0.5, rgba([255, 215, 140], 0.08 + 0.06 * shim));
      chg.addColorStop(1, rgba([205, 145, 255], 0.06 + 0.05 * shim));
      g.fillStyle = chg;
      this._rr(g, bx, by, bw, bh, 4 * d);
      g.fill();
      var pf = Math.max(p, 0.05);               // 最低可见填充，起步不空槽
      if (p > 0.003) {
        var beam = g.createLinearGradient(bx, by, bx + bw, by);
        beam.addColorStop(0, "rgba(255,110,40,0.95)");
        beam.addColorStop(0.55, "rgba(255,190,80,0.95)");
        beam.addColorStop(0.85, "rgba(255,240,190,1)");
        beam.addColorStop(1, "rgba(210,140,255,1)");
        g.fillStyle = beam;
        this._rr(g, bx, by, bw * pf, bh, 4 * d);
        g.fill();
        if (!this._beads) {
          this._beads = [];
          for (var i2 = 0; i2 < 14; i2++) this._beads.push({ p: i2 / 14, sp: rnd(0.6, 1.3) });
        }
        for (i2 = 0; i2 < this._beads.length; i2++) {
          var bd = this._beads[i2];
          bd.p += bd.sp * 0.0035;
          if (bd.p > 1) bd.p -= 1;
          var bxp = bx + bw * pf * bd.p;
          var brd = (2 + Math.sin(t * 6 + i2) * 1.2) * d;
          var bg2 = g.createRadialGradient(bxp, by + bh / 2, 0, bxp, by + bh / 2, brd * 3);
          bg2.addColorStop(0, "rgba(255,252,235,0.95)");
          bg2.addColorStop(1, "rgba(255,200,90,0)");
          g.fillStyle = bg2;
          g.beginPath(); g.arc(bxp, by + bh / 2, brd * 3, 0, 6.2832); g.fill();
        }
        var lx2 = bx + bw * pf;
        var lg2 = g.createRadialGradient(lx2, by + bh / 2, 0, lx2, by + bh / 2, 18 * d);
        lg2.addColorStop(0, "rgba(255,255,245,1)");
        lg2.addColorStop(0.3, "rgba(255,225,140,0.9)");
        lg2.addColorStop(1, "rgba(255,150,60,0)");
        g.fillStyle = lg2;
        g.beginPath(); g.arc(lx2, by + bh / 2, 18 * d, 0, 6.2832); g.fill();
      }
      g.globalCompositeOperation = "source-over";
    },

    _drawPortrait: function (g, kind, cx, cy, R, alpha) {
      if (alpha <= 0.01) return;
      var im = this._imgs[kind];
      if (!im || !(im.width > 0)) return;
      g.globalAlpha = alpha;
      var s = R * 2.35;
      var fx = kind === "naiwa" ? 0.47 : 0.5, fy = kind === "naiwa" ? 0.26 : 0.24;
      g.drawImage(im, cx - s * fx, cy - s * fy, s, s);
      g.globalAlpha = 1;
    },

    _rr: function (g, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    },
  };

  NV.BootFX = BootFX;
})(window.NV);
