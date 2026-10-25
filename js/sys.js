/* ============================================================
   sys.js —— 系统服务层：设置存档 / 自适应画质 / 性能面板 /
   战绩与成就 / i18n / Toast 通知
   纯脚本，挂在 window.NV 下，无第三方依赖，file:// 可用。
   ============================================================ */
window.NV = window.NV || {};   // 允许在 core.js 之前加载
(function (NV) {
  "use strict";

  /* ================= 设置（localStorage 持久化） ================= */
  var SET_KEY = "nv_settings_v1";
  var SET_DEF = {
    volMaster: 100, volSfx: 90, volMusic: 60,
    quality: "auto",            // auto | high | mid | low
    fxGrain: true, fxVig: true, fxShake: 100, fxVoice: false,
    shadows: true,
    lang: "zh",
    name: "",
  };
  var Settings = {
    data: JSON.parse(JSON.stringify(SET_DEF)),
    load: function () {
      try {
        var raw = localStorage.getItem(SET_KEY);
        if (raw) {
          var o = JSON.parse(raw);
          for (var k in SET_DEF) if (o[k] !== undefined) this.data[k] = o[k];
        }
      } catch (e) {}
      return this.data;
    },
    save: function () {
      try { localStorage.setItem(SET_KEY, JSON.stringify(this.data)); } catch (e) {}
    },
    set: function (k, v) { this.data[k] = v; this.save(); this.apply(); },
    apply: function () {
      var d = this.data;
      // 屏效开关
      var grain = document.getElementById("grain");
      if (grain) grain.style.display = d.fxGrain ? "" : "none";
      var vig = document.getElementById("vig");
      if (vig) vig.style.display = d.fxVig ? "" : "none";
      document.documentElement.style.setProperty("--shake", String(d.fxShake / 100));
      // 音量
      if (NV.SFX) NV.SFX.volumes(d.volMaster, d.volSfx, d.volMusic);
      // 语言
      if (NV.I18N) NV.I18N.apply(d.lang);
      // 画质
      if (NV.QUALITY) NV.QUALITY.setMode(d.quality);
    },
  };

  /* ================= 自适应画质 ================= */
  var Quality = {
    mode: "auto", tier: 2,          // 2 高 / 1 中 / 0 低
    _frames: 0, _acc: 0, _lowT: 0, _hiT: 0, _upgraded: false,
    _renderer: null, _camera: null, _cineDip: false,
    _lastFPS: 60,
    listeners: [],
    DPR: [1, 1.25, 1.75],           // 低 / 中 / 高 像素比上限

    init: function (renderer, camera) {
      this._renderer = renderer; this._camera = camera;
      var m = /[?&]q=(low|mid|high)/.exec(location.search);
      if (m) this.mode = m[1] === "high" ? "high" : m[1] === "mid" ? "mid" : "low";
      else this.mode = (NV.Settings && NV.Settings.data.quality) || "auto";
      // 弱机启发：核数少或无 WebGL2 直接中档起步
      if (this.mode === "auto") {
        var weak = (navigator.hardwareConcurrency || 4) <= 4 ||
          !(document.createElement("canvas").getContext("webgl2"));
        this.tier = weak ? 1 : 2;
      }
      this.apply();
    },
    setMode: function (m) { this.mode = m; this._upgraded = false; this.apply(); },
    onChange: function (fn) { this.listeners.push(fn); },
    _fire: function () { for (var i = 0; i < this.listeners.length; i++) { try { this.listeners[i](this.tier); } catch (e) {} } },
    apply: function () {
      if (this.mode === "high") this.tier = 2;
      else if (this.mode === "mid") this.tier = 1;
      else if (this.mode === "low") this.tier = 0;
      var r = this._renderer;
      if (r) {
        var dpr = Math.min(window.devicePixelRatio || 1, this.DPR[this.tier]);
        if (this._cineDip && this.tier === 2) dpr = Math.min(dpr, 1.3);
        r.setPixelRatio(dpr);
      }
      var b = document.body;
      b.classList.toggle("q-low", this.tier === 0);
      b.classList.toggle("q-mid", this.tier === 1);
      // 低画质关掉 canvas 滤镜与阴影
      var shadowsOn = this.tier >= 2 && (!NV.Settings || NV.Settings.data.shadows);
      if (r) { r.shadowMap.enabled = shadowsOn; r.shadowMap.needsUpdate = true; }
      this._fire();
    },
    cineDip: function (on) {
      if (this._cineDip === on) return;
      this._cineDip = on; this.apply();
    },
    tick: function (rawDt) {
      this._frames++; this._acc += rawDt;
      if (this._acc >= 1) {
        this._lastFPS = this._frames / this._acc;
        this._frames = 0; this._acc = 0;
        if (this.mode !== "auto") return;
        if (this._lastFPS < 45) { this._lowT++; this._hiT = 0; } 
        else if (this._lastFPS > 58) { this._hiT++; this._lowT = 0; } 
        else { this._lowT = 0; this._hiT = 0; }
        if (this._lowT >= 3 && this.tier > 0) {
          this.tier--; this._lowT = 0; this.apply();
          if (NV.toast) NV.toast(this.tier === 1 ? "已自动调整为【中】画质" : "已自动调整为【低】画质", "perf");
        } else if (this._hiT >= 10 && this.tier < 2 && !this._upgraded) {
          this.tier++; this._upgraded = true; this.apply();
          if (NV.toast) NV.toast("性能良好，已回升画质", "perf");
        }
      }
    },
    pscale: function () { return [0.4, 0.7, 1][this.tier]; },
    fps: function () { return this._lastFPS; },
  };

  /* ================= 性能面板（?perf） ================= */
  var Perf = {
    enabled: /[?&]perf/.test(location.search),
    el: null, _t: 0,
    ensure: function () {
      if (this.el || !this.enabled) return;
      var d = document.createElement("div");
      d.id = "perf-panel";
      d.innerHTML = "<b>PERF</b><span></span>";
      document.body.appendChild(d);
      this.el = d;
    },
    tick: function (rawDt, renderer) {
      if (!this.enabled) return;
      this.ensure();
      this._t += rawDt;
      if (this._t < 0.25 || !this.el) return;
      this._t = 0;
      var i = renderer.info;
      this.el.querySelector("span").textContent =
        " " + (NV.QUALITY ? NV.QUALITY.fps().toFixed(0) : 60) + "fps · q" +
        (NV.QUALITY ? NV.QUALITY.tier : "?") + " · draw " + i.render.calls +
        " · tri " + (i.render.triangles / 1000).toFixed(0) + "k" +
        " · tex " + i.memory.textures + " · geo " + i.memory.geometries;
    },
  };

  /* ================= 战绩 & 成就 ================= */
  var STAT_KEY = "nv_stats_v1";
  var Stats = {
    d: { games: 0, wins: 0, maxCombo: 0, charWins: { naiwa: 0, meishu: 0 }, ach: {}, shots: [] },
    load: function () {
      try {
        var raw = localStorage.getItem(STAT_KEY);
        if (raw) { var o = JSON.parse(raw); for (var k in this.d) if (o[k] !== undefined) this.d[k] = o[k]; }
      } catch (e) {}
    },
    save: function () { try { localStorage.setItem(STAT_KEY, JSON.stringify(this.d)); } catch (e) {} },
    addWin: function (charId, diff, maxComboThisMatch, perfect) {
      this.d.games++; this.d.wins++;
      this.d.charWins[charId] = (this.d.charWins[charId] || 0) + 1;
      if (maxComboThisMatch > this.d.maxCombo) this.d.maxCombo = maxComboThisMatch;
      this.unlock("first_win");
      if (this.d.wins >= 10) this.unlock("ten_wins");
      if (perfect) this.unlock("perfect");
      if (maxComboThisMatch >= 8) this.unlock("combo8");
      this.save();
    },
    addLoss: function (maxComboThisMatch) {
      this.d.games++;
      if (maxComboThisMatch > this.d.maxCombo) this.d.maxCombo = maxComboThisMatch;
      this.save();
    },
    shot: function (dataUrl) {
      this.d.shots.unshift(dataUrl);
      if (this.d.shots.length > 8) this.d.shots.pop();
      this.save();
    },
    achDef: {
      first_win: { name: "初出茅庐", desc: "获得第一场胜利" },
      ten_wins: { name: "百战不殆", desc: "累计获胜 10 场" },
      perfect: { name: "完美无伤", desc: "满血拿下回合" },
      combo8: { name: "连段大师", desc: "达成 8 Hits 以上连段" },
      ultra_all: { name: "炎与虚", desc: "两名角色都赢过对局" },
      rain_win: { name: "雨中即景", desc: "在雨巷霓虹取胜" },
    },
    unlock: function (id) {
      if (this.d.ach[id]) return;
      this.d.ach[id] = Date.now();
      this.save();
      var def = this.achDef[id];
      if (def && NV.toast) NV.toast("🏆 成就解锁 · " + def.name + " — " + def.desc, "ach", 3.2);
    },
  };

  /* ================= i18n（菜单 / HUD / 播报） ================= */
  var I18N = {
    zh: {
      arcade: "开始对战", online: "联机对战", gallery: "角色鉴赏", help: "操作说明", settings: "设置",
      press: "PRESS START", mode: "MODE", fight: "开始对战", back: "返回", train: "训练",
      round: "回合", qi: "气", superBtn: "超必 O", nextRound: "下一回合", again: "再战一场", home: "返回标题",
      announceFight: "FIGHT!", roundTag: "ROUND", wins: "获胜",
    },
    en: {
      arcade: "ARCADE", online: "ONLINE", gallery: "GALLERY", help: "HELP", settings: "SETTINGS",
      press: "PRESS START", mode: "MODE", fight: "FIGHT", back: "BACK", train: "TRAINING",
      round: "Round", qi: "GAUGE", superBtn: "SUPER O", nextRound: "NEXT ROUND", again: "REMATCH", home: "TITLE",
      announceFight: "FIGHT!", roundTag: "ROUND", wins: "WINS",
    },
    lang: "zh",
    t: function (k) { return (this[this.lang] && this[this.lang][k]) || this.zh[k] || k; },
    apply: function (lang) {
      this.lang = lang || this.lang;
      var els = document.querySelectorAll("[data-i18n]");
      for (var i = 0; i < els.length; i++) {
        var k = els[i].getAttribute("data-i18n");
        els[i].childNodes[0].nodeValue = this.t(k);
      }
    },
  };

  /* ================= Toast 通知 ================= */
  var toastBox = null;
  function toast(msg, kind, dur) {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.id = "toast-box";
      document.body.appendChild(toastBox);
    }
    var t = document.createElement("div");
    t.className = "toast" + (kind ? " " + kind : "");
    t.textContent = msg;
    toastBox.appendChild(t);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 350);
    }, (dur || 2.4) * 1000);
  }

  /* ================= 挂载 ================= */
  Settings.load();
  Stats.load();
  NV.Settings = Settings;
  NV.QUALITY = Quality;
  NV.PERF = Perf;
  NV.Stats = Stats;
  NV.I18N = I18N;
  NV.toast = toast;
})(window.NV);
