/* ============================================================
   sfx.js —— 音频引擎：离线渲染音效库 + 程序化 BGM
   · 首次用户手势时用 OfflineAudioContext 批量渲染采样
     （多层谐波 + 噪声塑形 + 短混响尾），零外部资源
   · 播放层：音高随机防机枪感、连段音调爬升、每帧限流
   · BGM：标题/战斗/结算三套程序化循环，战斗低血量切低通紧张感
   挂在 window.NV.SFX。
   ============================================================ */
window.NV = window.NV || {};   // 允许在 core.js 之前加载
(function (NV) {
  "use strict";

  var ctx = null, master = null, sfxBus = null, musBus = null, musLP = null;
  var bank = {};              // name -> AudioBuffer
  var ready = false, rendering = false;
  var vol = { m: 1, s: 0.9, mu: 0.6 };
  var framePlays = 0;
  var music = { mood: null, timer: 0, step: 0, bpm: 126, on: true };
  var tensionLP = null;

  function ensureCtx() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    master = ctx.createGain();
    musLP = ctx.createBiquadFilter(); musLP.type = "lowpass"; musLP.frequency.value = 20000;
    sfxBus = ctx.createGain();
    musBus = ctx.createGain();
    sfxBus.connect(master); musBus.connect(musLP); musLP.connect(master);
    master.connect(ctx.destination);
    applyVol();
    return ctx;
  }
  function applyVol() {
    if (!ctx) return;
    master.gain.value = vol.m;
    sfxBus.gain.value = vol.s;
    musBus.gain.value = vol.mu * 0.9;
  }

  /* ---------- 离线渲染采样 ---------- */
  function offline(dur) {
    var sr = 22050;
    var oc = new OfflineAudioContext(1, Math.ceil(dur * sr), sr);
    oc._sr = sr;
    return oc;
  }
  function oTone(oc, opt) {
    // 谐波振荡器：{type,f0,f1,t,d,g,harmonics}
    var t = opt.t || 0, d = opt.d || 0.2;
    var o = oc.createOscillator(), g = oc.createGain();
    o.type = opt.type || "sine";
    o.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opt.g || 0.3, t + (opt.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(oc.__out || oc.destination);
    if (opt.detune) o.detune.value = opt.detune;
    o.start(t); o.stop(t + d + 0.02);
    // 泛音层
    var n = opt.harmonics || 0;
    for (var i = 1; i <= n; i++) {
      var o2 = oc.createOscillator(), g2 = oc.createGain();
      o2.type = opt.type || "sine";
      o2.frequency.setValueAtTime(opt.f0 * (i + 1), t);
      if (opt.f1) o2.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1 * (i + 1)), t + d);
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime((opt.g || 0.3) / (i * 2.2), t + (opt.a || 0.004));
      g2.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o2.connect(g2); g2.connect(oc.__out || oc.destination);
      o2.start(t); o2.stop(t + d + 0.02);
    }
  }
  function oNoise(oc, opt) {
    // 噪声塑形：{t,d,g,type,f,q,f1,sr}
    var sr = oc._sr || 22050;
    var t = opt.t || 0, d = opt.d || 0.15;
    var len = Math.max(8, Math.floor((d + 0.05) * sr));
    var buf = oc.createBuffer(1, len, sr);
    var ch = buf.getChannelData(0);
    for (var i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    var src = oc.createBufferSource(); src.buffer = buf;
    var f = oc.createBiquadFilter();
    f.type = opt.type || "bandpass"; f.frequency.value = opt.f || 1200; f.Q.value = opt.q || 1;
    if (opt.f1) f.frequency.exponentialRampToValueAtTime(opt.f1, t + d);
    var g = oc.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opt.g || 0.3, t + (opt.a || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(oc.__out || oc.destination);
    src.start(t);
  }
  function tail(oc, dur, g0) {
    // 全曲短混响尾：极短噪声脉冲 + 全通近似
    oNoise(oc, { t: 0, d: 0.03, g: g0 || 0.05, type: "highpass", f: 3000 });
  }

  function renderBank() {
    if (rendering || ready) return;
    rendering = true;
    var jobs = [];
    function make(name, dur, fn) {
      jobs.push(function () {
        var oc = offline(dur);
        oc.__out = oc.destination;
        fn(oc);
        return oc.startRendering().then(function (buf) { bank[name] = buf; });
      });
    }
    /* 打击系 */
    make("hit_l", 0.22, function (oc) {
      oTone(oc, { type: "triangle", f0: 320, f1: 90, d: 0.1, g: 0.5, harmonics: 2 });
      oNoise(oc, { d: 0.07, g: 0.5, type: "bandpass", f: 2600, q: 1.2, f1: 900 });
      tail(oc, 0.2, 0.04);
    });
    make("hit_h", 0.4, function (oc) {
      oTone(oc, { type: "square", f0: 160, f1: 42, d: 0.22, g: 0.55, harmonics: 3 });
      oTone(oc, { type: "sine", f0: 70, f1: 34, d: 0.3, g: 0.6 });
      oNoise(oc, { d: 0.16, g: 0.55, type: "lowpass", f: 2400, f1: 300 });
      tail(oc, 0.35, 0.06);
    });
    make("ultra_hit", 0.5, function (oc) {
      oTone(oc, { type: "sawtooth", f0: 220, f1: 40, d: 0.3, g: 0.5, harmonics: 2 });
      oTone(oc, { type: "sine", f0: 58, f1: 26, d: 0.42, g: 0.7 });
      oNoise(oc, { d: 0.2, g: 0.4, type: "bandpass", f: 1800, q: 0.8, f1: 260 });
    });
    make("block", 0.18, function (oc) {
      oTone(oc, { type: "square", f0: 720, f1: 500, d: 0.06, g: 0.32 });
      oNoise(oc, { d: 0.05, g: 0.3, type: "highpass", f: 3800 });
    });
    make("whiff", 0.2, function (oc) {
      oNoise(oc, { d: 0.14, g: 0.24, type: "bandpass", f: 900, q: 2.4, f1: 2600 });
    });
    /* 机动系 */
    make("jump", 0.18, function (oc) {
      oTone(oc, { type: "triangle", f0: 260, f1: 620, d: 0.13, g: 0.24 });
    });
    make("land", 0.24, function (oc) {
      oTone(oc, { type: "sine", f0: 120, f1: 46, d: 0.16, g: 0.45 });
      oNoise(oc, { d: 0.1, g: 0.3, type: "lowpass", f: 800 });
    });
    make("dash", 0.24, function (oc) {
      oNoise(oc, { d: 0.18, g: 0.3, type: "bandpass", f: 500, q: 1.4, f1: 3200 });
    });
    /* 元素系 */
    make("fire", 0.5, function (oc) {
      oNoise(oc, { d: 0.34, g: 0.5, type: "lowpass", f: 3200, f1: 500 });
      oTone(oc, { type: "sawtooth", f0: 180, f1: 70, d: 0.3, g: 0.3, harmonics: 2 });
      tail(oc, 0.4, 0.05);
    });
    make("ice", 0.5, function (oc) {
      oTone(oc, { type: "sine", f0: 1400, f1: 640, d: 0.24, g: 0.26, harmonics: 3 });
      oNoise(oc, { d: 0.2, g: 0.28, type: "highpass", f: 5200 });
    });
    make("charge_full", 0.5, function (oc) {
      oTone(oc, { type: "triangle", f0: 300, f1: 1200, d: 0.3, g: 0.34 });
      oTone(oc, { type: "sine", f0: 600, f1: 2400, d: 0.3, g: 0.2, harmonics: 2 });
    });
    /* 必杀系 */
    make("super", 0.8, function (oc) {
      oTone(oc, { type: "sawtooth", f0: 120, f1: 480, d: 0.42, g: 0.4, harmonics: 2 });
      oTone(oc, { type: "sine", f0: 60, f1: 30, d: 0.7, g: 0.5 });
      oNoise(oc, { d: 0.5, g: 0.34, type: "bandpass", f: 700, q: 0.7, f1: 4000 });
    });
    make("quake", 0.9, function (oc) {
      oTone(oc, { type: "sine", f0: 46, f1: 22, d: 0.8, g: 0.75 });
      oNoise(oc, { d: 0.5, g: 0.4, type: "lowpass", f: 500, f1: 120 });
    });
    make("ko", 1.2, function (oc) {
      oTone(oc, { type: "sine", f0: 90, f1: 24, d: 1.0, g: 0.85 });
      oTone(oc, { type: "sawtooth", f0: 300, f1: 50, d: 0.5, g: 0.4, harmonics: 2 });
      oNoise(oc, { d: 0.6, g: 0.5, type: "lowpass", f: 3000, f1: 200 });
      tail(oc, 1.1, 0.07);
    });
    make("bell", 1.4, function (oc) {
      oTone(oc, { type: "sine", f0: 1568, d: 0.9, g: 0.3, harmonics: 4 });
      oTone(oc, { type: "sine", f0: 2093, t: 0.16, d: 1.1, g: 0.24, harmonics: 3 });
    });
    make("win", 1.6, function (oc) {
      var seq = [523, 659, 784, 1047];
      for (var i = 0; i < seq.length; i++)
        oTone(oc, { type: "triangle", f0: seq[i], t: i * 0.14, d: 0.3, g: 0.3, harmonics: 2 });
    });
    make("select", 0.15, function (oc) {
      oTone(oc, { type: "square", f0: 880, f1: 1200, d: 0.07, g: 0.18 });
    });
    make("freeze", 0.6, function (oc) {
      oTone(oc, { type: "sine", f0: 2200, f1: 500, d: 0.4, g: 0.3, harmonics: 4 });
      oNoise(oc, { d: 0.3, g: 0.2, type: "highpass", f: 6000 });
    });

    var p = Promise.resolve();
    jobs.forEach(function (j) { p = p.then(j); });
    p.then(function () { ready = true; }).catch(function () { ready = false; }).then(function () { rendering = false; });
  }

  /* ---------- 播放 ---------- */
  function play(name, opt) {
    if (!ctx || !ready || !bank[name]) return false;
    if (framePlays >= 4) return false;
    framePlays++;
    opt = opt || {};
    var src = ctx.createBufferSource();
    src.buffer = bank[name];
    var rate = 1 + (Math.random() - 0.5) * 0.12;
    if (opt.combo) rate += Math.min(opt.combo, 8) * 0.028;
    src.playbackRate.value = rate;
    var g = ctx.createGain();
    g.gain.value = opt.gain == null ? 1 : opt.gain;
    src.connect(g); g.connect(sfxBus);
    src.start();
    return true;
  }

  /* ---------- 程序化 BGM ---------- */
  var SCALE = [0, 3, 5, 7, 10];  // 小调五声
  function noteHz(semi, oct) { return 220 * Math.pow(2, (semi + oct * 12) / 12); }
  function musNote(f, t, d, g, type) {
    var o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type || "triangle"; o.frequency.value = f;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(g, t + 0.02);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(musBus);
    o.start(t); o.stop(t + d + 0.05);
  }
  function musDrum(t, kick) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(kick ? 130 : 900, t);
    o.frequency.exponentialRampToValueAtTime(kick ? 40 : 500, t + 0.1);
    g.gain.setValueAtTime(kick ? 0.5 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kick ? 0.16 : 0.05));
    o.connect(g); g.connect(musBus);
    o.start(t); o.stop(t + 0.2);
  }
  function scheduleMusic() {
    if (!ctx || !music.on || !music.mood) return;
    var lookahead = 0.35, stepDur = 60 / music.bpm / 2;
    while (music.timer < ctx.currentTime + lookahead) {
      var t = Math.max(music.timer, ctx.currentTime + 0.02);
      var s = music.step;
      if (music.mood === "title") {
        if (s % 8 === 0) musNote(noteHz(SCALE[(s / 8) % 5], 0), t, 1.6, 0.2, "sine");
        if (s % 8 === 4) musNote(noteHz(SCALE[(s / 8 + 2) % 5], 1), t, 1.4, 0.12, "sine");
        if (s % 16 === 12) musNote(noteHz(SCALE[4], 1), t, 0.9, 0.1, "triangle");
      } else if (music.mood === "fight") {
        if (s % 2 === 0) musDrum(t, s % 8 === 0 || s % 8 === 6);
        if (s % 4 === 2) musDrum(t, false);
        var bassSeq = [0, 0, 3, 0, 5, 5, 3, 2];
        musNote(noteHz(bassSeq[s % 8], -2), t, stepDur * 0.9, 0.3, "square");
        if (s % 2 === 1) musNote(noteHz(SCALE[(s * 3) % 5], 1), t, stepDur * 0.8, 0.09, "sawtooth");
        if (s % 16 === 14) musNote(noteHz(SCALE[(s % 5)], 2), t, stepDur * 2, 0.08, "triangle");
      } else if (music.mood === "result") {
        if (s < 8) {
          var fan = [0, 4, 7, 12, 7, 12, 16, 19];
          musNote(noteHz(fan[s], 1), t, 0.36, 0.22, "triangle");
          if (s % 2 === 0) musDrum(t, true);
        }
      }
      music.timer += stepDur;
      music.step++;
      if (music.mood === "result" && music.step >= 16) { music.mood = null; return; }
    }
  }
  function setMood(mood) {
    if (music.mood === mood) return;
    music.mood = mood; music.step = 0;
    if (ctx) music.timer = ctx.currentTime + 0.05;
  }

  /* ---------- 对外接口 ---------- */
  var SFX = {
    unlock: function () {
      if (!ensureCtx()) return;
      if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
      renderBank();
    },
    isReady: function () { return ready; },
    play: play,
    frame: function () { framePlays = 0; },
    volumes: function (m, s, mu) {
      vol.m = (m == null ? 100 : m) / 100;
      vol.s = (s == null ? 90 : s) / 100;
      vol.mu = (mu == null ? 60 : mu) / 100;
      applyVol();
    },
    music: setMood,
    duck: function (on) { if (musBus && ctx) musBus.gain.setTargetAtTime(on ? vol.mu * 0.25 : vol.mu * 0.9, ctx.currentTime, 0.08); },
    tension: function (v) { if (musLP && ctx) musLP.frequency.setTargetAtTime(20000 - 17000 * Math.max(0, Math.min(1, v)), ctx.currentTime, 0.3); },
    tick: function () { if (ctx && music.mood) scheduleMusic(); },
  };
  NV.SFX = SFX;
})(window.NV);
