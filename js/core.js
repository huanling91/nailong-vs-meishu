/* ============================================================
   核心工具：命名空间 / 数学 / 程序化贴图 / 环境光照
   纯脚本（无 ES Module），兼容旧内核浏览器与 file:// 直开。
   ============================================================ */
window.NV = window.NV || {};

(function (NV) {
  "use strict";

  const TEX = {};   // 贴图缓存

  /* ---------- 数学 ---------- */
  NV.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  NV.lerp = (a, b, t) => a + (b - a) * t;
  NV.ramp = (k, a, b) => (k <= a ? 0 : k >= b ? 1 : (k - a) / (b - a));
  NV.bell = (k, a, b, c, d) => Math.min(NV.ramp(k, a, b), 1 - NV.ramp(k, c, d));
  NV.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  NV.easeIn = (t) => t * t * t;
  NV.easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  NV.rand = (a, b) => a + Math.random() * (b - a);
  /* 拳皇式长场地：半宽（世界单位）。对局可走约 2.5 屏，两端才是墙角。 */
  NV.STAGE_HALF = 12.6;

  /* ---------- Canvas 工具 ---------- */
  function cv(w, h) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  NV.canvas = cv;

  function tex(canvas, srgb = true) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  NV.canvasTex = tex;

  /* ---------- 特效贴图（加法混合用） ---------- */
  NV.fxTextures = {};
  function ensureFxTextures() {
    if (NV.fxTextures.dot) return NV.fxTextures;
    const T = NV.fxTextures;

    // 柔光点
    let c = cv(128, 128), g = c.getContext("2d");
    let grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.28, "rgba(255,255,255,0.72)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    T.dot = tex(c);

    // 硬光核
    c = cv(128, 128); g = c.getContext("2d");
    grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.5, "rgba(255,240,200,0.35)");
    grd.addColorStop(1, "rgba(255,180,60,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    T.core = tex(c);

    // 冲击环
    c = cv(256, 256); g = c.getContext("2d");
    g.strokeStyle = "#fff";
    for (let i = 0; i < 3; i++) {
      g.lineWidth = 10 - i * 3;
      g.globalAlpha = 0.9 - i * 0.28;
      g.beginPath(); g.arc(128, 128, 96 - i * 7, 0, 6.2832); g.stroke();
    }
    g.globalAlpha = 1;
    T.ring = tex(c);

    // 星芒
    c = cv(256, 256); g = c.getContext("2d");
    g.translate(128, 128);
    g.fillStyle = "#fff";
    for (let i = 0; i < 4; i++) {
      g.rotate(Math.PI / 4);
      g.beginPath();
      g.moveTo(0, -120); g.lineTo(11, 0); g.lineTo(0, 120); g.lineTo(-11, 0);
      g.closePath(); g.fill();
    }
    g.rotate(Math.PI / 4);
    grd = g.createRadialGradient(0, 0, 0, 0, 0, 46);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, 46, 0, 6.2832); g.fill();
    T.star = tex(c);

    // 斩击弧
    c = cv(256, 256); g = c.getContext("2d");
    g.translate(128, 128);
    for (let i = 0; i < 26; i++) {
      const a = -0.9 + i * 0.07;
      g.globalAlpha = 0.9 * (1 - Math.abs(i - 13) / 15);
      g.strokeStyle = "#fff";
      g.lineWidth = 2 + 16 * (1 - Math.abs(i - 13) / 14);
      g.beginPath();
      g.arc(0, 0, 104, a, a + 0.05);
      g.stroke();
    }
    T.arc = tex(c);

    // 烟尘
    c = cv(128, 128); g = c.getContext("2d");
    for (let i = 0; i < 26; i++) {
      const x = 64 + (Math.random() - 0.5) * 52, y = 64 + (Math.random() - 0.5) * 52;
      const r = 14 + Math.random() * 26;
      grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,255,255,0.30)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    T.smoke = tex(c);

    // 地面裂纹
    c = cv(256, 256); g = c.getContext("2d");
    g.translate(128, 128);
    g.strokeStyle = "rgba(255,255,255,0.95)";
    for (let i = 0; i < 9; i++) {
      g.save();
      g.rotate(i * 0.7 + Math.random() * 0.4);
      g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(0, 0);
      let x = 0, y = 0;
      for (let s = 0; s < 6; s++) {
        x += 16 + Math.random() * 12; y += (Math.random() - 0.5) * 22;
        g.lineTo(x, y);
        if (Math.random() < 0.5) {
          g.moveTo(x, y);
          g.lineTo(x + 10 + Math.random() * 12, y + (Math.random() - 0.5) * 26);
          g.moveTo(x, y);
        }
      }
      g.stroke();
      g.restore();
    }
    T.crack = tex(c);

    // 能量球
    c = cv(128, 128); g = c.getContext("2d");
    grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(190,255,140,0.85)");
    grd.addColorStop(1, "rgba(60,180,40,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    T.gel = tex(c);

    // 奶滴
    c = cv(128, 128); g = c.getContext("2d");
    grd = g.createRadialGradient(56, 52, 4, 64, 64, 62);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.55, "rgba(255,242,205,0.8)");
    grd.addColorStop(1, "rgba(255,215,120,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    T.milk = tex(c);

    // ============ 火焰专用贴图 ============
    // 焰舌：水滴形火焰，核心白热、外缘橙红
    c = cv(192, 192); g = c.getContext("2d");
    g.translate(96, 108);
    for (let i = 0; i < 3; i++) {
      const sc = 1 - i * 0.24, al = 0.5 + i * 0.22;
      g.globalAlpha = al;
      grd = g.createRadialGradient(0, 18 * sc, 2, 0, 4 * sc, 78 * sc);
      grd.addColorStop(0, i === 2 ? "#ffffff" : i === 1 ? "#ffe9a0" : "#ff8a1a");
      grd.addColorStop(0.45, i === 2 ? "#fff2c0" : i === 1 ? "#ff9a2a" : "#e84a08");
      grd.addColorStop(1, "rgba(120,16,0,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, -78 * sc);
      g.bezierCurveTo(52 * sc, -30 * sc, 62 * sc, 32 * sc, 0, 72 * sc);
      g.bezierCurveTo(-62 * sc, 32 * sc, -52 * sc, -30 * sc, 0, -78 * sc);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    T.flame = tex(c);

    // 余烬：小小的发光火星
    c = cv(64, 64); g = c.getContext("2d");
    grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.3, "rgba(255,200,90,0.95)");
    grd.addColorStop(0.65, "rgba(255,110,20,0.5)");
    grd.addColorStop(1, "rgba(180,40,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    T.ember = tex(c);

    // 热浪：扭曲上升的暖雾
    c = cv(128, 128); g = c.getContext("2d");
    for (let i = 0; i < 16; i++) {
      const x = 64 + (Math.random() - 0.5) * 46, y = 64 + (Math.random() - 0.5) * 60;
      const r = 12 + Math.random() * 30;
      grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(255,190,120,0.26)");
      grd.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    T.heat = tex(c);

    // 龙首：火焰龙形轮廓（升龙拳用）
    c = cv(256, 256); g = c.getContext("2d");
    g.translate(128, 128);
    g.globalAlpha = 0.95;
    grd = g.createRadialGradient(0, 0, 6, 0, 0, 118);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.35, "#ffe08a");
    grd.addColorStop(0.72, "#ff7a14");
    grd.addColorStop(1, "rgba(200,40,0,0)");
    g.fillStyle = grd;
    // 龙首主体
    g.beginPath();
    g.moveTo(-96, 26);
    g.bezierCurveTo(-52, -34, 14, -62, 86, -30);
    g.bezierCurveTo(112, -18, 118, 6, 96, 22);
    g.bezierCurveTo(60, 44, 4, 52, -60, 46);
    g.closePath(); g.fill();
    // 龙角
    g.beginPath();
    g.moveTo(18, -48); g.lineTo(44, -104); g.lineTo(52, -44); g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(-24, -44); g.lineTo(-8, -96); g.lineTo(16, -40); g.closePath(); g.fill();
    // 龙目
    g.globalAlpha = 1;
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath(); g.arc(48, -20, 11, 0, 6.2832); g.fill();
    g.fillStyle = "rgba(60,10,0,0.85)";
    g.beginPath(); g.arc(50, -20, 5, 0, 6.2832); g.fill();
    g.globalAlpha = 1;
    T.dragonHead = tex(c);

    // ============ 寒冰专用贴图 ============
    // 冰晶：尖锐六棱晶体
    c = cv(192, 192); g = c.getContext("2d");
    g.translate(96, 96);
    for (let i = 0; i < 3; i++) {
      g.save();
      g.rotate(i * Math.PI / 3);
      grd = g.createLinearGradient(0, -84, 0, 84);
      grd.addColorStop(0, "rgba(255,255,255,0.98)");
      grd.addColorStop(0.42, "rgba(180,240,255,0.9)");
      grd.addColorStop(1, "rgba(70,170,255,0.12)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, -88); g.lineTo(17, -16); g.lineTo(9, 74); g.lineTo(-9, 74); g.lineTo(-17, -16);
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 2; g.stroke();
      g.restore();
    }
    T.ice = tex(c);

    // 雪花：六角对称
    c = cv(192, 192); g = c.getContext("2d");
    g.translate(96, 96);
    g.strokeStyle = "rgba(235,250,255,0.95)";
    g.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      g.save(); g.rotate(i * Math.PI / 3);
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -76); g.stroke();
      g.lineWidth = 3.6;
      g.beginPath(); g.moveTo(0, -44); g.lineTo(-20, -60); g.stroke();
      g.beginPath(); g.moveTo(0, -44); g.lineTo(20, -60); g.stroke();
      g.beginPath(); g.moveTo(0, -66); g.lineTo(-13, -78); g.stroke();
      g.beginPath(); g.moveTo(0, -66); g.lineTo(13, -78); g.stroke();
      g.restore();
    }
    grd = g.createRadialGradient(0, 0, 0, 0, 0, 40);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(1, "rgba(200,240,255,0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, 40, 0, 6.2832); g.fill();
    T.snow = tex(c);

    // 霜雾：冷冽白雾
    c = cv(128, 128); g = c.getContext("2d");
    for (let i = 0; i < 20; i++) {
      const x = 64 + (Math.random() - 0.5) * 56, y = 64 + (Math.random() - 0.5) * 56;
      const r = 12 + Math.random() * 28;
      grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(220,245,255,0.3)");
      grd.addColorStop(1, "rgba(150,215,255,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    T.frost = tex(c);

    // 冰霜地纹：贴地扩散的冰裂纹
    c = cv(256, 256); g = c.getContext("2d");
    g.translate(128, 128);
    g.strokeStyle = "rgba(200,245,255,0.92)";
    for (let i = 0; i < 12; i++) {
      g.save();
      g.rotate(i * 0.524 + Math.random() * 0.2);
      g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(6, 0);
      let x = 6, y = 0;
      for (let s = 0; s < 5; s++) {
        x += 16 + Math.random() * 14; y += (Math.random() - 0.5) * 18;
        g.lineTo(x, y);
        if (Math.random() < 0.6) {
          g.moveTo(x, y);
          g.lineTo(x + 9 + Math.random() * 10, y + (Math.random() - 0.5) * 24);
          g.moveTo(x, y);
        }
      }
      g.stroke();
      g.restore();
    }
    T.frostGlyph = tex(c);

    // 速度线（径向）
    c = cv(512, 512); g = c.getContext("2d");
    g.translate(256, 256);
    for (let i = 0; i < 130; i++) {
      const a = Math.random() * 6.2832;
      const r0 = 90 + Math.random() * 120, r1 = r0 + 60 + Math.random() * 150;
      g.strokeStyle = "rgba(255,255,255," + (0.25 + Math.random() * 0.6) + ")";
      g.lineWidth = 1 + Math.random() * 3.4;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.stroke();
    }
    T.speed = tex(c);

    // 接触阴影
    c = cv(128, 128); g = c.getContext("2d");
    grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(0.55, "rgba(0,0,0,0.22)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    T.shadow = tex(c);

    // 火焰贴图：只画圆形焰核，画布四角保持透明，避免精灵白框
    c = cv(128, 128); g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    grd = g.createRadialGradient(64, 72, 2, 64, 58, 58);
    grd.addColorStop(0, "rgba(255,255,220,1)");
    grd.addColorStop(0.2, "rgba(255,200,50,0.9)");
    grd.addColorStop(0.5, "rgba(255,90,20,0.45)");
    grd.addColorStop(0.78, "rgba(180,20,0,0.12)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(64, 64, 58, 0, 6.2832); g.fill();
    T.flame = tex(c, false);
    T.flame.premultiplyAlpha = true;
    T.flame.needsUpdate = true;

    // 霜晶贴图：圆形柔光，不描到画布边缘
    c = cv(128, 128); g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    grd = g.createRadialGradient(64, 64, 2, 64, 64, 56);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.22, "rgba(180,240,255,0.85)");
    grd.addColorStop(0.55, "rgba(80,180,255,0.35)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(64, 64, 56, 0, 6.2832); g.fill();
    g.save();
    g.beginPath(); g.arc(64, 64, 40, 0, 6.2832); g.clip();
    g.strokeStyle = "rgba(230,255,255,0.45)";
    g.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785;
      g.beginPath();
      g.moveTo(64, 64);
      g.lineTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38);
      g.stroke();
    }
    g.restore();
    T.frost = tex(c, false);
    T.frost.premultiplyAlpha = true;
    T.frost.needsUpdate = true;

    /* 拳皇风：斜向爪斩（八稚女） */
    c = cv(256, 256); g = c.getContext("2d");
    g.clearRect(0, 0, 256, 256);
    g.translate(128, 128);
    g.rotate(-0.62);
    for (let i = 0; i < 5; i++) {
      const w = 18 - i * 3.2, al = 0.22 + i * 0.18;
      grd = g.createLinearGradient(-118, 0, 118, 0);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.18, "rgba(255,240,220," + al + ")");
      grd.addColorStop(0.5, "rgba(255,255,255," + Math.min(1, al + 0.35) + ")");
      grd.addColorStop(0.82, "rgba(255,200,160," + al + ")");
      grd.addColorStop(1, "rgba(255,80,40,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(-120, -w * 0.15);
      g.quadraticCurveTo(0, -w, 122, -w * 0.08);
      g.lineTo(122, w * 0.08);
      g.quadraticCurveTo(0, w, -120, w * 0.15);
      g.closePath();
      g.fill();
    }
    T.kofSlash = tex(c, false);

    /* 拳皇风：血焰（八神紫红） */
    c = cv(160, 160); g = c.getContext("2d");
    g.clearRect(0, 0, 160, 160);
    g.translate(80, 92);
    for (let i = 0; i < 3; i++) {
      const sc = 1 - i * 0.26, al = 0.42 + i * 0.22;
      g.globalAlpha = al;
      grd = g.createRadialGradient(0, 14 * sc, 2, 0, 2 * sc, 68 * sc);
      grd.addColorStop(0, i === 2 ? "#ffffff" : i === 1 ? "#ffb0d0" : "#ff2a68");
      grd.addColorStop(0.42, i === 2 ? "#ffd0e8" : "#c01060");
      grd.addColorStop(1, "rgba(60,0,30,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, -70 * sc);
      g.bezierCurveTo(46 * sc, -24 * sc, 54 * sc, 28 * sc, 0, 62 * sc);
      g.bezierCurveTo(-54 * sc, 28 * sc, -46 * sc, -24 * sc, 0, -70 * sc);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    T.bloodFlame = tex(c, false);

    /* 拳皇风：大蛇薙横向火蛇 */
    c = cv(512, 192); g = c.getContext("2d");
    g.clearRect(0, 0, 512, 192);
    for (let i = 0; i < 7; i++) {
      const y = 96 + Math.sin(i * 1.1) * 18;
      const h = 70 - i * 7;
      grd = g.createLinearGradient(8, y, 500, y);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.12, "rgba(255,240,180," + (0.15 + i * 0.06) + ")");
      grd.addColorStop(0.4, "rgba(255,150,40," + (0.45 + i * 0.06) + ")");
      grd.addColorStop(0.72, "rgba(255,60,10," + (0.5 - i * 0.04) + ")");
      grd.addColorStop(1, "rgba(80,0,0,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(12, y);
      g.bezierCurveTo(90, y - h, 210, y + h * 0.55, 340, y - h * 0.35);
      g.bezierCurveTo(420, y - h * 0.7, 480, y + 8, 508, y);
      g.bezierCurveTo(470, y + h * 0.55, 360, y + h * 0.8, 220, y + h * 0.2);
      g.bezierCurveTo(120, y - h * 0.15, 40, y + h * 0.4, 12, y);
      g.closePath();
      g.fill();
    }
    T.orochiFlame = tex(c, false);

    /* ============================================================
       终极必杀专用贴图
       奶鼠：紫黑虚空系（Violet / Magenta / Void-Black）
       奶龙：金红圣炎系（Gold / Crimson / White-hot）
       ============================================================ */

    // 虚空焰：紫黑核心 + 品红/紫罗兰外缘
    c = cv(192, 192); g = c.getContext("2d");
    g.clearRect(0, 0, 192, 192);
    g.translate(96, 108);
    for (let i = 0; i < 3; i++) {
      const sc = 1 - i * 0.24, al = 0.46 + i * 0.24;
      g.globalAlpha = al;
      grd = g.createRadialGradient(0, 18 * sc, 2, 0, 4 * sc, 78 * sc);
      grd.addColorStop(0, i === 2 ? "#f0e0ff" : i === 1 ? "#c08aff" : "#7a2ad8");
      grd.addColorStop(0.4, i === 2 ? "#d8a8ff" : i === 1 ? "#9a3ae0" : "#4a0a7a");
      grd.addColorStop(0.78, "#2a0a4a");
      grd.addColorStop(1, "rgba(10,0,25,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(0, -78 * sc);
      g.bezierCurveTo(52 * sc, -30 * sc, 62 * sc, 32 * sc, 0, 72 * sc);
      g.bezierCurveTo(-62 * sc, 32 * sc, -52 * sc, -30 * sc, 0, -78 * sc);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    T.voidFlame = tex(c, false);

    // 虚空核：黑心 + 亮紫环
    c = cv(128, 128); g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, "#000000");
    grd.addColorStop(0.3, "#2a0a4a");
    grd.addColorStop(0.55, "#7a2ad8");
    grd.addColorStop(0.8, "#e040c0");
    grd.addColorStop(1, "rgba(200,120,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    T.voidOrb = tex(c, false);

    // 暗星：黑核 + 紫色日冕尖芒
    c = cv(256, 256); g = c.getContext("2d");
    g.clearRect(0, 0, 256, 256);
    g.translate(128, 128);
    for (let i = 0; i < 8; i++) {
      g.save(); g.rotate(i * 0.785);
      const lg = g.createLinearGradient(0, -120, 0, 0);
      lg.addColorStop(0, "rgba(200,120,255,0)");
      lg.addColorStop(0.55, "rgba(160,60,230,0.55)");
      lg.addColorStop(1, "rgba(230,150,255,0.85)");
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(-9, 0); g.lineTo(0, -122); g.lineTo(9, 0); g.closePath();
      g.fill();
      g.restore();
    }
    grd = g.createRadialGradient(0, 0, 2, 0, 0, 54);
    grd.addColorStop(0, "#000000");
    grd.addColorStop(0.55, "#1a0430");
    grd.addColorStop(0.84, "#7a2ad8");
    grd.addColorStop(1, "rgba(220,140,255,0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, 54, 0, 6.2832); g.fill();
    T.darkStar = tex(c, false);

    // 虚空符文法阵：双环 + 三角 + 刻度
    c = cv(512, 512); g = c.getContext("2d");
    g.clearRect(0, 0, 512, 512);
    g.translate(256, 256);
    g.strokeStyle = "rgba(200,130,255,0.9)";
    g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, 232, 0, 6.2832); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 205, 0, 6.2832); g.stroke();
    g.beginPath(); g.arc(0, 0, 120, 0, 6.2832); g.stroke();
    // 内部三角
    g.lineWidth = 3;
    g.strokeStyle = "rgba(230,150,255,0.85)";
    for (let t = 0; t < 2; t++) {
      g.save(); g.rotate(t * Math.PI / 3);
      g.beginPath();
      g.moveTo(0, -168); g.lineTo(145, 84); g.lineTo(-145, 84); g.closePath();
      g.stroke();
      g.restore();
    }
    // 刻度
    g.strokeStyle = "rgba(180,90,240,0.75)";
    g.lineWidth = 5;
    for (let i = 0; i < 24; i++) {
      g.save(); g.rotate(i * Math.PI / 12);
      g.beginPath(); g.moveTo(0, -232); g.lineTo(0, -208); g.stroke();
      g.restore();
    }
    T.rune = tex(c, false);

    // 虚空裂隙：纵向撕裂的黑色裂缝 + 紫边
    c = cv(256, 512); g = c.getContext("2d");
    g.clearRect(0, 0, 256, 512);
    const midX = 128;
    g.beginPath();
    g.moveTo(midX, 6);
    const steps = 26;
    for (let i = 1; i <= steps; i++) {
      const yy = 6 + (500 * i) / steps;
      const off = Math.sin(i * 1.7) * 26 + (Math.random() - 0.5) * 22;
      g.lineTo(midX + off, yy);
    }
    for (let i = steps; i >= 0; i--) {
      const yy = 6 + (500 * i) / steps;
      const off = Math.sin(i * 1.7) * 26 + (Math.random() - 0.5) * 22;
      g.lineTo(midX + off + 46, yy);
    }
    g.closePath();
    grd = g.createLinearGradient(midX - 40, 0, midX + 90, 0);
    grd.addColorStop(0, "rgba(120,20,200,0.15)");
    grd.addColorStop(0.32, "rgba(200,90,255,0.9)");
    grd.addColorStop(0.5, "rgba(10,0,20,1)");
    grd.addColorStop(0.68, "rgba(200,90,255,0.9)");
    grd.addColorStop(1, "rgba(120,20,200,0.15)");
    g.fillStyle = grd; g.fill();
    g.strokeStyle = "rgba(240,200,255,0.92)";
    g.lineWidth = 2.5; g.stroke();
    T.rift = tex(c, false);

    // 虚空触须：弯曲渐细的暗紫触手
    c = cv(256, 256); g = c.getContext("2d");
    g.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 5; i++) {
      const yy = 34 + i * 26;
      g.beginPath();
      g.moveTo(4, yy);
      g.bezierCurveTo(90, yy - 26, 168, yy + 22, 250, yy - 12);
      g.lineWidth = 15 - i * 1.6;
      g.strokeStyle = "rgba(190,110,250," + (0.75 - i * 0.1) + ")";
      g.lineCap = "round";
      g.stroke();
      g.lineWidth = 6 - i * 0.7;
      g.strokeStyle = "rgba(240,200,255," + (0.5 - i * 0.07) + ")";
      g.stroke();
    }
    T.tentacle = tex(c, false);

    // 紫黑雾
    c = cv(128, 128); g = c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 20; i++) {
      const x = 64 + (Math.random() - 0.5) * 58, y = 64 + (Math.random() - 0.5) * 58;
      const r = 14 + Math.random() * 30;
      grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgba(150,60,220,0.34)");
      grd.addColorStop(0.6, "rgba(60,10,110,0.2)");
      grd.addColorStop(1, "rgba(20,0,40,0)");
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    T.voidMist = tex(c, false);

    // 圣炎核（奶龙终极）：白热心 + 金红环
    c = cv(192, 192); g = c.getContext("2d");
    g.clearRect(0, 0, 192, 192);
    grd = g.createRadialGradient(96, 96, 2, 96, 96, 94);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.26, "#fff0b0");
    grd.addColorStop(0.52, "#ffb020");
    grd.addColorStop(0.78, "#ff4a08");
    grd.addColorStop(1, "rgba(160,20,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 192, 192);
    T.holyFlame = tex(c, false);

    // 金炎纹章（奶龙终极地面法阵）
    c = cv(512, 512); g = c.getContext("2d");
    g.clearRect(0, 0, 512, 512);
    g.translate(256, 256);
    g.strokeStyle = "rgba(255,200,90,0.95)";
    g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, 230, 0, 6.2832); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 186, 0, 6.2832); g.stroke();
    // 八角星
    g.strokeStyle = "rgba(255,150,40,0.9)";
    g.lineWidth = 3.4;
    for (let s = 0; s < 2; s++) {
      g.save(); g.rotate(s * Math.PI / 8);
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.2832;
        const r = i % 2 ? 92 : 176;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath(); g.stroke();
      g.restore();
    }
    g.strokeStyle = "rgba(255,220,140,0.8)";
    g.lineWidth = 5;
    for (let i = 0; i < 32; i++) {
      g.save(); g.rotate(i * Math.PI / 16);
      g.beginPath(); g.moveTo(0, -230); g.lineTo(0, -206); g.stroke();
      g.restore();
    }
    T.holySigil = tex(c, false);

    return T;
  }
  NV.ensureFxTextures = ensureFxTextures;

  /* ---------- 环境探测 ---------- */
  NV.detectWebGL = function () {
    try {
      const c = cv(8, 8);
      return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) { return false; }
  };

})(window.NV);
