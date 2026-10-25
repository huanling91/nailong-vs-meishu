/* ============================================================
   奶娃 VS 美鼠 —— 格斗引擎 v3
   · 无模块纯脚本，兼容旧内核浏览器与 file:// 直开
   · 加载看门狗：WebGL 不可用 / 立绘超时会降级继续，绝不卡在读条
   · 关键帧动画 + 指数阻尼混合（打断连贯）
   · 华丽特效：命中顿帧、镜头震动、慢镜、粒子、斩击弧、龙卷、地裂、弹道
   · 格挡 / 疾冲 / 链式取消 / 多段必杀 / 三局两胜
   ============================================================ */
(function (NV) {
  "use strict";
  const T = NV;
  const $ = function (id) { return document.getElementById(id); };
  const clamp = T.clamp;

  /* ---------------- 招式表（拳皇式：轻/重、蹲、跳、必杀、超必） ---------------- */
  const GAT_LIGHT = ["lk", "hp", "hk", "skill", "skill2", "super", "ultra1", "ultra2", "ultra3"];
  const GAT_MED = ["hp", "hk", "skill", "skill2", "super", "ultra1", "ultra2", "ultra3"];
  const GAT_HEAVY = ["skill", "skill2", "super", "ultra1", "ultra2", "ultra3"];
  const GAT_SP = ["super", "ultra1", "ultra2", "ultra3"];

  const MOVES = {
    naiwa: {
      lp: { name: "焰息轻波", dmg: 5, range: 4.4, startup: 0.09, active: 0.08, rec: 0.18, meter: 6, hitstop: 0.07, knock: 1.8, stun: 0.22, blockstun: 0.14, cancel: GAT_LIGHT, fx: "fire", limb: "fist", hitY: 0.92, limbLen: 0.7, proj: "fire", projSpeed: 8.2, projLife: 1.15 },
      lk: { name: "霜踢轻波", dmg: 6, range: 4.6, startup: 0.1, active: 0.08, rec: 0.2, meter: 7, hitstop: 0.08, knock: 2.1, stun: 0.28, blockstun: 0.16, cancel: GAT_MED, fx: "ice", limb: "foot", hitY: 0.48, limbLen: 0.85, proj: "ice", projSpeed: 7.4, projLife: 1.2, low: true },
      hp: { name: "炎龙波", dmg: 12, range: 5.2, startup: 0.14, active: 0.1, rec: 0.28, meter: 12, hitstop: 0.12, knock: 3.6, stun: 0.38, blockstun: 0.22, cancel: GAT_HEAVY, fx: "fire", limb: "fist", hitY: 0.98, limbLen: 0.85, proj: "fire", projSpeed: 7.0, projLife: 1.35, projScale: 1.35 },
      hk: { name: "寒冰波", dmg: 13, range: 5.4, startup: 0.16, active: 0.1, rec: 0.3, meter: 14, hitstop: 0.13, knock: 4.4, stun: 0.48, blockstun: 0.24, cancel: GAT_HEAVY, fx: "ice", limb: "foot", hitY: 0.7, limbLen: 1.0, proj: "ice", projSpeed: 6.4, projLife: 1.4, projScale: 1.4 },
      crlp: { name: "下焰波", dmg: 4, range: 4.2, startup: 0.08, active: 0.08, rec: 0.16, meter: 5, hitstop: 0.06, knock: 1.3, stun: 0.2, low: true, cancel: GAT_LIGHT, fx: "fire", limb: "fist", hitY: 0.42, limbLen: 0.7, proj: "fire", projSpeed: 7.8, projLife: 1.05 },
      crlk: { name: "地冰波", dmg: 8, range: 4.8, startup: 0.12, active: 0.1, rec: 0.22, meter: 8, hitstop: 0.09, knock: 2.4, stun: 0.34, low: true, cancel: GAT_MED, fx: "ice", limb: "foot", hitY: 0.22, limbLen: 1.05, proj: "ice", projSpeed: 7.2, projLife: 1.15 },
      crhp: { name: "升炎波", dmg: 11, range: 4.0, startup: 0.13, active: 0.1, rec: 0.26, meter: 12, hitstop: 0.12, knock: 3.2, stun: 0.4, launcher: true, cancel: GAT_HEAVY, fx: "fire", limb: "fist", hitY: 1.12, limbLen: 0.8, proj: "fire", projSpeed: 6.2, projLife: 1.1, projLift: 3.4 },
      jlp: { name: "空焰波", dmg: 6, range: 4.2, startup: 0.08, active: 0.16, rec: 0.1, meter: 6, hitstop: 0.07, knock: 1.8, stun: 0.2, air: true, fx: "fire", limb: "fist", hitY: 0.85, limbLen: 0.75, proj: "fire", projSpeed: 7.6, projLife: 0.95 },
      jhk: { name: "空霜波", dmg: 11, range: 4.6, startup: 0.12, active: 0.16, rec: 0.12, meter: 11, hitstop: 0.1, knock: 3.4, stun: 0.32, air: true, fx: "ice", limb: "foot", hitY: 0.55, limbLen: 0.95, proj: "ice", projSpeed: 6.8, projLife: 1.05 },
      throw: { name: "抱抱摔", dmg: 14, range: 0.92, startup: 0.08, active: 0.1, rec: 0.32, meter: 10, hitstop: 0.14, knock: 6.4, stun: 0.5, throw: true, fx: "belly", limb: "belly", hitY: 0.7, limbLen: 0.55 },
      skill: { name: "泰山压顶", dmg: 16, range: 1.72, startup: 0.12, active: 0.36, rec: 0.26, meter: 8, hitstop: 0.13, knock: 5.0, stun: 0.4, jump: 6.2, slam: true, cancel: GAT_SP, fx: "slam", limb: "belly", hitY: 0.35, limbLen: 0.7 },
      skill2: { name: "凝胶升龙", dmg: 8, range: 1.55, startup: 0.08, active: 0.42, rec: 0.28, meter: 10, hitstop: 0.08, knock: 3.8, stun: 0.36, hits: 3, hitGap: 0.1, jump: 7.4, launcher: true, invul: [0, 0.22], cancel: GAT_SP, fx: "upper", limb: "fist", hitY: 1.25, limbLen: 1.15 },
      super: { name: "奶龙咆哮", dmg: 8, range: 2.45, startup: 0.16, active: 0.78, rec: 0.32, meter: 0, hitstop: 0.07, knock: 5.2, stun: 0.4, cost: 50, quake: true, hits: 6, hitGap: 0.1, invul: [0, 0.48], fx: "quake", limb: "belly", hitY: 0.72, limbLen: 1.5 , hitReach: 2.4},
      ultra1: { name: "九转炎龙破", dmg: 7, range: 5.4, startup: 0.18, active: 1.05, rec: 0.36, meter: 0, hitstop: 0.08, knock: 4.8, stun: 0.42, cost: 50, hits: 9, hitGap: 0.1, invul: [0, 0.55], fx: "ultra1", limb: "fist", hitY: 0.95, limbLen: 1.6, lunge: 0.8 , hitReach: 4.2},
      ultra2: { name: "奶河焚天", dmg: 11, range: 4.8, startup: 0.22, active: 0.92, rec: 0.4, meter: 0, hitstop: 0.1, knock: 6.2, stun: 0.5, cost: 50, hits: 7, hitGap: 0.11, invul: [0, 0.5], fx: "ultra2", limb: "belly", hitY: 0.7, limbLen: 1.7 , hitReach: 4.6},
      ultra3: { name: "炎帝临世", dmg: 14, range: 5.8, startup: 0.26, active: 1.18, rec: 0.46, meter: 0, hitstop: 0.12, knock: 7.4, stun: 0.62, cost: 100, hits: 8, hitGap: 0.12, invul: [0, 0.72], fx: "ultra3", limb: "fist", hitY: 1.05, limbLen: 1.85, quake: true , hitReach: 4.8},
    },
    meishu: {
      lp: { name: "袋鼠刺拳", dmg: 4, range: 1.42, startup: 0.04, active: 0.06, rec: 0.11, meter: 5, hitstop: 0.05, knock: 1.4, stun: 0.2, blockstun: 0.11, lunge: 1.2, cancel: GAT_LIGHT, fx: "jab", limb: "fist", hitY: 0.95, limbLen: 1.05 },
      lk: { name: "袋鼠轻踢", dmg: 5, range: 1.58, startup: 0.06, active: 0.07, rec: 0.13, meter: 6, hitstop: 0.06, knock: 1.8, stun: 0.22, lunge: 1.0, cancel: GAT_MED, fx: "kick", limb: "foot", hitY: 0.48, limbLen: 1.22 },
      hp: { name: "袋鼠重拳", dmg: 10, range: 1.55, startup: 0.09, active: 0.1, rec: 0.2, meter: 10, hitstop: 0.1, knock: 3.0, stun: 0.36, lunge: 1.5, cancel: GAT_HEAVY, fx: "jab", limb: "fist", hitY: 1.02, limbLen: 1.22 },
      hk: { name: "袋鼠踢", dmg: 12, range: 1.88, startup: 0.11, active: 0.12, rec: 0.24, meter: 12, hitstop: 0.11, knock: 4.4, stun: 0.4, launcher: true, cancel: GAT_HEAVY, fx: "kick", limb: "foot", hitY: 0.82, limbLen: 1.42 },
      crlp: { name: "蹲刺", dmg: 4, range: 1.36, startup: 0.04, active: 0.06, rec: 0.11, meter: 5, hitstop: 0.05, knock: 1.1, stun: 0.18, low: true, cancel: GAT_LIGHT, fx: "jab", limb: "fist", hitY: 0.5, limbLen: 0.92 },
      crlk: { name: "滑踢", dmg: 8, range: 1.78, startup: 0.09, active: 0.12, rec: 0.2, meter: 8, hitstop: 0.08, knock: 2.6, stun: 0.3, low: true, dash: 2.2, cancel: GAT_MED, fx: "kick", limb: "foot", hitY: 0.2, limbLen: 1.38 },
      crhp: { name: "上勾拳", dmg: 11, range: 1.4, startup: 0.1, active: 0.1, rec: 0.22, meter: 11, hitstop: 0.11, knock: 2.8, stun: 0.38, launcher: true, cancel: GAT_HEAVY, fx: "jab", limb: "fist", hitY: 1.18, limbLen: 1.08 },
      jlp: { name: "空刺", dmg: 5, range: 1.38, startup: 0.05, active: 0.16, rec: 0.08, meter: 5, hitstop: 0.05, knock: 1.6, stun: 0.18, air: true, fx: "jab", limb: "fist", hitY: 0.88, limbLen: 0.98 },
      jhk: { name: "空中落踢", dmg: 11, range: 1.68, startup: 0.09, active: 0.18, rec: 0.1, meter: 10, hitstop: 0.09, knock: 3.4, stun: 0.26, air: true, fx: "kick", limb: "foot", hitY: 0.52, limbLen: 1.28 },
      throw: { name: "袋装抛投", dmg: 13, range: 0.95, startup: 0.07, active: 0.1, rec: 0.3, meter: 10, hitstop: 0.13, knock: 6.8, stun: 0.48, throw: true, fx: "kick", limb: "belly", hitY: 0.68, limbLen: 0.58 },
      skill: { name: "旋风弹跳", dmg: 6, range: 1.62, startup: 0.12, active: 0.44, rec: 0.24, meter: 0, hitstop: 0.05, knock: 3.0, stun: 0.28, hits: 4, hitGap: 0.11, dash: 3.6, air: true, cancel: GAT_SP, fx: "tornado", limb: "foot", hitY: 0.7, limbLen: 1.1 },
      skill2: { name: "袋鼠升龙", dmg: 7, range: 1.5, startup: 0.07, active: 0.4, rec: 0.28, meter: 9, hitstop: 0.07, knock: 3.6, stun: 0.34, hits: 3, hitGap: 0.1, jump: 7.6, launcher: true, invul: [0, 0.2], cancel: GAT_SP, fx: "upper", limb: "fist", hitY: 1.28, limbLen: 1.18 },
      super: { name: "暴走尾旋", dmg: 8, range: 1.95, startup: 0.15, active: 0.64, rec: 0.32, meter: 0, hitstop: 0.055, knock: 5.5, stun: 0.46, hits: 6, hitGap: 0.1, cost: 50, dash: 2.4, invul: [0.04, 0.3], fx: "tailstorm", limb: "foot", hitY: 0.75, limbLen: 1.25 , hitReach: 2.0},
      ultra1: { name: "紫渊吞噬", dmg: 8, range: 4.6, startup: 0.2, active: 0.98, rec: 0.38, meter: 0, hitstop: 0.09, knock: 5.0, stun: 0.48, cost: 50, hits: 7, hitGap: 0.11, invul: [0, 0.52], fx: "ultra1", limb: "fist", hitY: 0.9, limbLen: 1.55 , hitReach: 3.8},
      ultra2: { name: "暗星陨灭", dmg: 12, range: 5.2, startup: 0.24, active: 1.02, rec: 0.42, meter: 0, hitstop: 0.11, knock: 6.6, stun: 0.55, cost: 50, hits: 6, hitGap: 0.12, invul: [0, 0.5], fx: "ultra2", limb: "foot", hitY: 0.55, limbLen: 1.7 , hitReach: 4.2},
      ultra3: { name: "虚空王座", dmg: 15, range: 5.6, startup: 0.28, active: 1.22, rec: 0.48, meter: 0, hitstop: 0.13, knock: 7.8, stun: 0.7, cost: 100, hits: 8, hitGap: 0.12, invul: [0, 0.75], fx: "ultra3", limb: "belly", hitY: 0.88, limbLen: 1.9, quake: true , hitReach: 4.4},
    },
  };
  MOVES.naiwa.punch = MOVES.naiwa.hp;
  MOVES.naiwa.kick = MOVES.naiwa.hk;
  MOVES.meishu.punch = MOVES.meishu.lp;
  MOVES.meishu.kick = MOVES.meishu.hk;

  /* 蓄力波（长按 U/I 蓄力后释放的强化版） */
  MOVES.naiwa.hpCharge = {
    name: "炎龙咆哮波", dmg: 20, range: 7.4, startup: 0.16, active: 0.12, rec: 0.34,
    meter: 16, hitstop: 0.16, knock: 6.0, stun: 0.55, blockstun: 0.3, cancel: GAT_SP,
    fx: "fire", limb: "fist", hitY: 1.0, limbLen: 1.0,
    proj: "fire", projSpeed: 9.6, projLife: 1.9, projScale: 2.3, charged: 1, pierce: true,
  };
  MOVES.naiwa.hkCharge = {
    name: "绝对零度波", dmg: 21, range: 7.6, startup: 0.18, active: 0.12, rec: 0.36,
    meter: 18, hitstop: 0.17, knock: 6.4, stun: 0.85, blockstun: 0.34, cancel: GAT_SP,
    fx: "ice", limb: "foot", hitY: 0.66, limbLen: 1.1,
    proj: "ice", projSpeed: 8.6, projLife: 2.0, projScale: 2.4, charged: 1, pierce: true, freeze: true,
  };

  /* ---------------- 音效（程序合成） ---------------- */
  let AC = null;
  function audio() {
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; }
    }
    if (AC && AC.state === "suspended") { try { AC.resume(); } catch (e) {} }
    if (T.SFX) T.SFX.unlock();   // 首次手势：解锁并离线渲染音效库
    return AC;
  }
  function tone(freq, dur, type, gain, freq2) {
    const c = audio();
    if (!c) return;
    try {
      const t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (freq2) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq2), t + dur);
      g.gain.setValueAtTime(gain || 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  function noise(dur, gain, filterHz) {
    const c = audio();
    if (!c) return;
    try {
      const t = c.currentTime;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const n = c.createBufferSource(); n.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = filterHz || 1400;
      const g = c.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(c.destination);
      n.start(t);
    } catch (e) {}
  }
  function sfx(kind, extra) {
    /* 优先走离线渲染音效库（sfx.js），失败回退到即时合成 */
    if (T.SFX && T.SFX.isReady()) {
      const map = {
        whiff: "whiff", jab: "hit_l", hit: "hit_l", heavy: "hit_h", block: "block",
        jump: "jump", land: "land", dash: "dash", skill: "super", super: "super",
        quake: "quake", ko: "ko", bell: "bell", select: "select",
        fire: "fire", ice: "ice", charge: "charge_full", chargeMax: "charge_full",
        freeze: "freeze", win: "win",
      };
      const name = map[kind];
      if (name && T.SFX.play(name, { combo: extra && extra.combo })) return;
    }
    switch (kind) {
      case "whiff": tone(300, 0.08, "triangle", 0.022, 160); break;
      case "jab": noise(0.07, 0.05, 2600); tone(420, 0.06, "square", 0.03, 200); break;
      case "hit": noise(0.1, 0.075, 1500); tone(150, 0.09, "square", 0.05, 70); break;
      case "heavy": noise(0.18, 0.11, 900); tone(90, 0.15, "sawtooth", 0.07, 40); tone(180, 0.08, "square", 0.04, 60); break;
      case "block": tone(760, 0.05, "square", 0.035, 500); noise(0.05, 0.04, 4200); break;
      case "jump": tone(300, 0.11, "sine", 0.03, 620); break;
      case "land": noise(0.1, 0.07, 700); tone(110, 0.08, "sine", 0.05, 55); break;
      case "dash": noise(0.12, 0.05, 3000); tone(240, 0.1, "triangle", 0.025, 420); break;
      case "skill": tone(280, 0.16, "triangle", 0.045, 560); noise(0.1, 0.035, 2200); break;
      case "super": tone(200, 0.55, "sawtooth", 0.055, 55); tone(400, 0.4, "square", 0.028, 90); noise(0.4, 0.05, 800); break;
      case "quake": tone(70, 0.5, "sawtooth", 0.08, 32); noise(0.45, 0.09, 420); break;
      case "ko": tone(220, 0.9, "triangle", 0.075, 45); noise(0.5, 0.07, 900); break;
      case "bell": tone(880, 0.32, "sine", 0.05); tone(1320, 0.28, "sine", 0.028); break;
      case "select": tone(520, 0.06, "square", 0.032, 700); break;
      case "fire": noise(0.16, 0.08, 1800); tone(180, 0.18, "sawtooth", 0.05, 70); tone(420, 0.1, "square", 0.03, 160); break;
      case "ice": noise(0.14, 0.06, 3200); tone(740, 0.16, "sine", 0.045, 420); tone(1180, 0.1, "triangle", 0.025, 900); break;
      case "charge": tone(140, 0.4, "sawtooth", 0.03, 320); tone(220, 0.4, "sine", 0.02, 460); break;
      case "chargeMax": tone(320, 0.5, "square", 0.04, 900); tone(640, 0.4, "sine", 0.03, 1280); noise(0.18, 0.05, 2600); break;
      case "freeze": noise(0.4, 0.09, 900); tone(120, 0.5, "sawtooth", 0.06, 40); tone(1600, 0.3, "sine", 0.03, 300); break;
      case "win": [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, "triangle", 0.04); }, i * 110); }); break;
    }
  }

  /* ---------------- 全局 ---------------- */
  let scene, camera, renderer, clock, arena, fx;
  let p1, p2, m1, m2, a1, a2;
  let naiwaModel = null, meishuModel = null;
  let pickP1 = "naiwa", pickP2 = "meishu", pickStage = "duel";
  let state = "boot";
  let vsCpu = true;
  let netPlay = false;
  let net = null;
  let remoteBits = 0, remotePrev = 0;
  let snapAcc = 0;
  let lastSnap = null;
  let ghostBolts = [];
  let round = 1, wins = [0, 0];
  const KEY = Object.create(null);
  const PRESSED = Object.create(null);
  let timer = 99, timerAcc = 0;
  let elapsed = 0;
  let hitstopT = 0, slowmo = 1, shakeT = 0, shakeAmp = 0, shakeRot = 0;
  let roundOver = false, flashT = 0, flashColor = "#fff";
  let announceT = 0, dtMove = 0;
  let introT = 0;
  let camPunch = 0;
  let hitFxCount = 0;
  let paused = false;
  let trainMode = false, trainCpu = "idle", trainComboDmg = 0, trainMaxHits = 0, trainLastCombo = 0;
  let cpuDiff = 0.62;
  let matchMaxCombo = 0;
  const inputHist = [];
  let modelsReady = false;
  let galChar = "naiwa", galYaw = 0.5, galAnim = null, galAutoT = 0;
  const galFake = { x: 0, y: 0, vx: 0, vy: 0, crouch: false, state: "idle", viewYaw: 0.5 };
  /* 主菜单看板演出：灯组 / 接触影 / 能量垫 / 光柱 / 尘埃 */
  let menuRig = null, menuBlobs = null, menuPad = null, menuShafts = null, menuMotes = null;
  let menuKey = null, menuRim = null, menuFill = null, menuBounce = null;
  let menuGlow = 0, menuLightK = 1;

  /* ============================================================
     打击感核心（依据 threejs-gameplay-systems / game-feel.md）
     · Trauma 震屏：trauma² 曲线，线性衰减，硬上限
     · FOV 冲击：命中瞬间推 FOV，指数回弹，必须 updateProjectionMatrix
     · 噪声用累积游戏时间驱动（确定性），帧率无关
     ============================================================ */
  const TRAUMA_MAX = 1.0;       // 创伤上限
  const TRAUMA_DECAY = 1.4;     // 每秒衰减（trauma 单位）
  const MAX_OFFSET = 0.30;      // 满震屏时相机位移（世界单位）
  const MAX_ROLL = 0.075;       // 满震屏时相机滚转（弧度）
  const MAX_FOV = 6.0;          // 满 FOV 冲击（度）
  const FOV_DECAY = 6.2;        // FOV 回弹速度（指数）
  let trauma = 0;
  let fovKick = 0;
  function addTrauma(v) { trauma = Math.min(TRAUMA_MAX, trauma + v); }
  function addFov(v) { fovKick = Math.min(MAX_FOV, Math.max(fovKick, v)); }
  /* 确定性伪噪声 [-1,1]，每轴独立种子 */
  function pseudoNoise(t, seed) {
    const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }
  const BUSY = ["lp", "lk", "hp", "hk", "crlp", "crlk", "crhp", "jlp", "jhk", "punch", "kick", "skill", "skill2", "super", "throw", "ultra1", "ultra2", "ultra3"];

  const SHOT = (function () {
    const m = /[?&]shot=([a-zA-Z0-9]+)/.exec(location.search);
    return m ? m[1] : null;
  })();

  /* 美鼠默认脸朝镜头，+facing 看右。
     奶龙 GLB 默认背朝镜头，先 +π 把脸转过来，再取反左右（导出轴向与美鼠相反）。 */
  function worldYaw(face) {
    return (face >= 0 ? 1 : -1) * 0.48;
  }
  function naiwaYaw(y) {
    return Math.PI - y;
  }
  function yawOf(f, face) {
    const y = worldYaw(face);
    return f && f.id === "naiwa" ? naiwaYaw(y) : y;
  }
  function modelPoseYaw(model, y) {
    const kind = model && model.root && model.root.userData && model.root.userData.kind;
    return kind === "naiwa" ? naiwaYaw(y) : y;
  }

  function makeFighter(id, name, x, facing) {
    return {
      id: id, name: name, x: x, y: 0, vx: 0, vy: 0, facing: facing,
      hp: 100, meter: 80,
      state: "idle", stateT: 0, atk: null, atkKey: null,
      hitDone: 0, nextHitT: 0, connected: false,
      combo: 0, comboT: 0, blocking: false, invulT: 0,
      dashT: 0, dashCdT: 0, lastTapDir: 0, lastTapT: -9,
      kvx: 0, crouch: false, stunT: 0, motion: [], _lastPad: 5,
      charge: null, chargeCd: 0,
      input: { left: false, right: false },
      color: id === "naiwa" ? 0xb8e04a : 0xffd24a,
      cpu: null,
      viewYaw: id === "naiwa" ? naiwaYaw(worldYaw(facing)) : worldYaw(facing),
    };
  }

  function animOf(f) { return f === p1 ? a1 : a2; }
  function modelOf(f) { return f === p1 ? m1 : m2; }
  function foeOf(f) { return f === p1 ? p2 : p1; }

  /* ============================================================
     招式特效派发
     ============================================================ */
  function emitAttackFx(f, mv, phase) {
    const dir = f.facing;
    const cx = f.x + dir * ((mv.limbLen || 1.1) * 0.55);
    const cy = f.y + (mv.hitY != null ? mv.hitY : 0.95);
    if (phase === "startup") {
      if (mv.fx === "fire") {
        T.FXlib.chargeAura(fx, f, 0.28, 0xff7a1a);
        T.FXlib.chargeGather(fx, f, 0.32, 0xff7a1a);
        T.FXlib.airShock(fx, f.x + dir * 0.35, cy, dir, 0xffd88a, 0.85);
        T.FXlib.elementStorm(fx, f, "fire", Math.max(0.28, mv.startup + 0.08));
      }
      if (mv.fx === "ice") {
        T.FXlib.chargeAura(fx, f, 0.28, 0x8ad8ff);
        T.FXlib.chargeGather(fx, f, 0.32, 0x8ad8ff);
        T.FXlib.airShock(fx, f.x + dir * 0.35, cy, dir, 0xd8f6ff, 0.85);
        T.FXlib.elementStorm(fx, f, "ice", Math.max(0.28, mv.startup + 0.08));
      }
      if (mv.fx === "jab" || mv.fx === "slap") {
        // 起手：掌/拳蓄势，前推气浪
        fx.pool.emit({ map: T.fxTextures.dot, x: cx, y: cy, z: 0.3, size: 0.14, size1: 0.02, life: 0.16, color: f.color, vx: dir * 2 });
        T.FXlib.airShock(fx, f.x + dir * 0.4, cy, dir, 0xfff2c0, 0.55);
      }
      if (mv.fx === "belly") {
        T.FXlib.dust(fx, f.x, dir, 0.6);
        T.FXlib.gelDrip(fx, f.x, 0.9, 3);
        T.FXlib.chargeGather(fx, f, 0.24, 0xb8e04a);
        if (f.id === "naiwa") {
          T.FXlib.fireBurst(fx, f.x + dir * 0.3, cy, dir);
          T.FXlib.elementStorm(fx, f, "fire", 0.4);
        }
      }
      if (mv.fx === "slam") {
        T.FXlib.chargeAura(fx, f, 0.22, 0xb8e04a);
        T.FXlib.chargeGather(fx, f, 0.3, 0xd8ff9a);
        if (f.id === "naiwa") {
          T.FXlib.chargeAura(fx, f, 0.4, 0xff7a1a);
          T.FXlib.elementStorm(fx, f, "fire", mv.startup + mv.active);
          T.FXlib.dragonHeadBlast(fx, f.x, f.y + 0.4, dir, "fire");
        }
      }
      if (mv.fx === "tornado") {
        T.FXlib.tornado(fx, f, mv.startup + mv.active);
        T.FXlib.helixRise(fx, f, mv.startup + mv.active, { color: 0xffd24a, radius: 0.6, turns: 11, rise: 1.3 });
      }
      if (mv.fx === "tailstorm") {
        T.FXlib.superIntro(fx, f);
        T.FXlib.speedLines(fx, 0.55);
        T.FXlib.tornado(fx, f, mv.startup + mv.active);
        T.FXlib.helixRise(fx, f, mv.startup + mv.active, { color: 0xffd24a, radius: 0.72, turns: 14, rise: 1.6, rate: 6 });
      }
      if (mv.fx === "quake") {
        T.FXlib.kofNaiwaSuper(fx, f);
      }
      if (mv.fx === "ultra1") {
        if (f.id === "naiwa") T.FXlib.ultraNineDragons(fx, f);
        else T.FXlib.ultraVoidRift(fx, f);
      }
      if (mv.fx === "ultra2") {
        if (f.id === "naiwa") T.FXlib.ultraMilkFlood(fx, f);
        else T.FXlib.ultraDarkMeteor(fx, f);
      }
      if (mv.fx === "ultra3") {
        if (f.id === "naiwa") T.FXlib.ultraFlameEmperor(fx, f);
        else T.FXlib.ultraVoidThrone(fx, f);
      }
      if (mv.fx === "slam") {
        T.FXlib.meteorTrail(fx, f, mv.startup + mv.active);
      }
      if (mv.fx === "upper") {
        const el = f.id === "naiwa" ? (mv.proj === "ice" ? "ice" : "fire") : "gel";
        T.FXlib.risingDragon(fx, f, { element: el, dur: mv.startup + mv.active });
        T.FXlib.chargeAura(fx, f, 0.32, f.color);
        T.FXlib.airShock(fx, f.x + dir * 0.3, cy, dir, 0xfff2c0, 1.05);
        if (f.id === "naiwa") {
          T.FXlib.elementStorm(fx, f, el, mv.startup + mv.active);
          T.FXlib.helixRise(fx, f, mv.startup + mv.active, { color: el === "ice" ? 0x6ad0ff : 0xff7a1a, radius: 0.78, turns: 18, rise: 2.1, rate: 10 });
        }
      }
    }
    if (phase === "active" && f.stateT % 0.06 < 0.017) {
      if (f.id === "naiwa") {
        const lx = f.x + dir * ((mv.limbLen || 1.1) * 0.72);
        const ly = f.y + (mv.hitY != null ? mv.hitY : 0.9);
        const ice = mv.fx === "ice" || mv.proj === "ice";
        if (ice) T.FXlib.iceTrail(fx, lx, ly, dir);
        else T.FXlib.fireTrail(fx, lx, ly, dir);
        if (mv.fx === "upper") {
          T.FXlib.fireTrail(fx, lx, ly + 0.35, dir);
          T.FXlib.fireTrail(fx, lx, ly + 0.7, dir);
        }
        T.FXlib.starTrail(fx, lx, ly, dir, ice ? 0x7ad0ff : 0xff9a28, 4);
      }
      if (mv.fx === "fire") T.FXlib.fireWave(fx, cx, cy, dir, (mv.projScale || 1) * (mv.charged ? 1.25 : 1));
      if (mv.fx === "ice") T.FXlib.iceWave(fx, cx, cy, dir, (mv.projScale || 1) * (mv.charged ? 1.25 : 1));
      if (mv.fx === "jab") {
        T.FXlib.slash(fx, cx + dir * 0.35, cy, dir, 0xfff2c0, 0.7);
        T.FXlib.starTrail(fx, cx + dir * 0.5, cy, dir, 0xffd24a, 2);
      }
      if (mv.fx === "slap") {
        T.FXlib.slash(fx, cx + dir * 0.3, cy, dir, 0xd8ff9a, 0.85);
        T.FXlib.starTrail(fx, cx + dir * 0.45, cy, dir, 0xb8e04a, 3);
      }
      if (mv.fx === "kick") {
        T.FXlib.slash(fx, f.x + dir * 0.9, f.y + 0.6, dir, 0xffd24a, 1.15);
        T.FXlib.trail(fx, f.x + dir * 0.8, f.y + 0.55, f.color);
        T.FXlib.starTrail(fx, f.x + dir * 0.85, f.y + 0.6, dir, 0xffd24a, 3);
      }
      if (mv.fx === "belly") {
        T.FXlib.gelDrip(fx, f.x + dir * 0.5, 0.85, 2);
        fx.pool.emit({ map: T.fxTextures.ring, x: f.x + dir * 0.5, y: 0.85, z: 0.2, size: 0.5, size1: 0.9, life: 0.2, color: 0xb8e04a, spin: 2 });
        T.FXlib.airShock(fx, f.x + dir * 0.55, f.y + 0.75, dir, 0xd8ff9a, 0.8);
      }
      if (mv.fx === "tailstorm") {
        T.FXlib.trail(fx, f.x + dir * 0.6, f.y + T.rand(0.4, 1.2), 0xffd24a);
        T.FXlib.milkSpray(fx, f.x, f.y + 0.9, dir, 3);
        T.FXlib.starTrail(fx, f.x + T.rand(-0.3, 0.3), f.y + T.rand(0.3, 1.4), dir, 0xffd24a, 2);
      }
      if (mv.fx === "quake") {
        T.FXlib.fireTrail(fx, f.x + dir * 0.75, f.y + 0.7, dir);
      }
    }
  }

  function emitHitFx(atk, def, mv, x, y, blocked) {
    if (blocked) {
      T.FXlib.blockHit(fx, x, y);
      // 奶龙格挡火花也带火
      if (atk.id === "naiwa") {
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * 6.2832, sp = 2.4 + Math.random() * 5.5;
          fx.pool.emit({
            map: i % 2 ? T.fxTextures.ember : T.fxTextures.flame, x: x, y: y, z: 0.3,
            size: 0.06 + Math.random() * 0.14, size1: 0.004, life: 0.26 + Math.random() * 0.24,
            color: Math.random() < 0.5 ? 0xffc040 : 0xff6a18,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.8, g: -7, drag: 2.6, spin: 14,
          });
        }
      }
      return;
    }
    const heavy = mv.dmg >= 10 || mv.hits > 1;
    const mega = mv.hits > 1 || mv.cost || mv.charged;
    const fiery = atk.id === "naiwa";
    if (mega) T.FXlib.energyBurst(fx, x, y, fiery ? 0xff9a28 : atk.color, 1.15 + (mv.charged ? 0.5 : 0));
    else if (heavy) T.FXlib.heavyHit(fx, x, y, atk.facing);
    else T.FXlib.hit(fx, x, y, fiery ? 0xffb040 : atk.color);
    // 高级粒子：星尘拖尾 + 空冲击波
    T.FXlib.starTrail(fx, x, y, atk.facing, fiery ? 0xff9a28 : atk.color, heavy ? 6 : 3);
    if (heavy) T.FXlib.airShock(fx, x, y, atk.facing, fiery ? 0xffd88a : 0xfff2c0, 1.1);
    // ★ 奶龙打击：火焰特效（普通拳脚也有）
    if (fiery && mv.fx !== "ice" && mv.proj !== "ice") {
      T.FXlib.fireBurst(fx, x, y, atk.facing);
      T.FXlib.dragonHeadBlast(fx, x, y, atk.facing, "fire");
      for (let i = 0; i < (heavy ? 24 : 14); i++) {
        const a = Math.random() * 6.2832, sp = 2.4 + Math.random() * (heavy ? 11 : 7);
        fx.pool.emit({
          map: i % 2 ? T.fxTextures.ember : T.fxTextures.flame,
          x: x, y: y, z: 0.28,
          size: (i % 2 ? 0.07 + Math.random() * 0.14 : 0.24 + Math.random() * 0.36),
          size1: 0.02, sy: 0.9 + Math.random() * 0.7, life: 0.3 + Math.random() * 0.4,
          color: i % 3 ? 0xff7a1a : 0xffe9a0,
          vx: Math.cos(a) * sp + atk.facing * 1.8, vy: Math.sin(a) * sp + 1.8, vz: (Math.random() - 0.5) * 2.6,
          g: -9, drag: 1.4, spin: (Math.random() - 0.5) * 28, rot: (Math.random() - 0.5) * 0.8, fadePow: 1.3,
        });
      }
      if (heavy) T.FXlib.groundGlyph(fx, def.x, 0xff5a10, 1.9);
    }
    if (mv.fx === "fire" || mv.proj === "fire") T.FXlib.fireBurst(fx, x, y, atk.facing);
    if (mv.fx === "ice" || mv.proj === "ice") {
      T.FXlib.iceBurst(fx, x, y, atk.facing);
      T.FXlib.dragonHeadBlast(fx, x, y, atk.facing, "ice");
      T.FXlib.frostGlyph(fx, def.x, 1.85);
    }
    // 升龙命中：顶点追加龙首/冰冠爆发
    if (mv.fx === "upper") {
      T.FXlib.risingDragon(fx, def, { element: fiery ? "fire" : "gel", dur: 0.32 });
    }
    if (mv.fx === "slap" || mv.fx === "belly") T.FXlib.gelDrip(fx, x, y, heavy ? 8 : 4);
    if (mv.fx === "quake") T.FXlib.yaOtomeSlash(fx, x, y, atk.facing, atk.hitDone || 0);
    if (mv.fx === "tailstorm" || mv.fx === "jab") T.FXlib.milkSpray(fx, x, y, atk.facing, heavy ? 8 : 4);
    if (mv.fx === "kick") T.FXlib.slash(fx, x, y, atk.facing, 0xffd24a, 1.3);
    if (mv.launcher) T.FXlib.dust(fx, def.x, atk.facing, 0.8);
    // 受击者闪白
    const an = animOf(def);
    an.flashTimer = 0.12;
    hitFxCount++;
  }

  /* ============================================================
     战斗核心
     ============================================================ */
  function showCutin(f, mv) {
    const box = $("letterbox");
    const cut = $("cutin");
    if (!box || !cut) return;
    box.classList.remove("hidden");
    box.classList.toggle("kof", f.id === "naiwa");
    cut.classList.remove("hidden");
    cut.classList.toggle("kof", f.id === "naiwa");
    $("cutin-name").textContent = f.name;
    $("cutin-skill").textContent = mv.name;
    cut.classList.remove("play");
    void cut.offsetWidth;
    cut.classList.add("play");
    clearTimeout(showCutin._t);
    showCutin._t = setTimeout(function () {
      box.classList.add("hidden");
      cut.classList.add("hidden");
      cut.classList.remove("play");
    }, f.id === "naiwa" ? 1100 : 980);
  }

  function spawnDragonQuake(f) {
    orochiWave(f.x + f.facing * 0.85, f.facing, f);
    T.FXlib.crack(fx, f.x + f.facing * 0.4, 3.2);
    T.FXlib.groundGlyph(fx, f.x + f.facing * 0.5, 0xff5a14, 3.4);
    addTrauma(0.85); addFov(5.0);
    flashColor = "#ffb060"; flashT = 0.12;
    camPunch = Math.max(camPunch, 0.42);
    sfx("quake");
  }

  function announce(txt, t, cls) {
    const el = $("announce");
    el.textContent = txt;
    el.className = "announce" + (cls ? " " + cls : "");
    void el.offsetWidth;
    el.classList.add("pop");
    announceT = t;
    /* 播报员语音（可关） */
    if (T.Settings && T.Settings.data.fxVoice && window.speechSynthesis &&
        /^(FIGHT|K\.O\.|PERFECT|ROUND \d|TIME UP)/i.test(txt)) {
      try {
        const u = new SpeechSynthesisUtterance(txt.replace(".", ""));
        u.lang = "en-US"; u.rate = 1.05; u.pitch = 0.82; u.volume = 0.9;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (e) {}
    }
  }

  /* ============================================================
     蓄力波系统
     CHARGE_MIN 以下算普通攻击；CHARGE_MAX 满蓄自动发射
     ============================================================ */
  const CHARGE_MIN = 0.34;    // 低于此值松手 = 普通波
  const CHARGE_MAX = 1.30;    // 满蓄时间
  const CHARGE_SLOW = 0.42;   // 蓄力时移动倍率

  function beginCharge(f, kind) {
    const lv = 0;
    f.charge = { kind: kind, t: 0, lv: 0, orb: null };
    f.state = "charge";
    f.stateT = 0;
    animOf(f).play("charge", T.COMMON.charge, 0.3);
    const el = kind === "fire" ? 0xff7a1a : 0x7ad0ff;
    T.FXlib.chargeAura(fx, f, 0.62, el);
    T.FXlib.chargeGather(fx, f, 0.58, el);
    T.FXlib.elementStorm(fx, f, kind, 0.55);
    T.FXlib.helixRise(fx, f, 0.5, { color: el, radius: 0.7, turns: 12, rise: 1.5, rate: 8 });
    if (kind === "fire") T.FXlib.groundGlyph(fx, f.x, 0xff5a10, 1.8);
    else T.FXlib.frostGlyph(fx, f.x, 1.7);
    sfx("charge");
    if (f === p1) announce("蓄力 · " + (kind === "fire" ? "炎龙咆哮波" : "绝对零度波"), 0.9);
  }

  function endCharge(f, released) {
    const c = f.charge;
    if (!c) return;
    if (c.orb) { c.orb.life = 0.02; c.orb = null; }
    f.charge = null;
    f.chargeCd = 0.12;
    if (released) { /* 已在 releaseCharge 处理 */ }
    else if (f.state === "charge") { f.state = "idle"; animOf(f).stopClip("charge"); }
  }

  /* 松手释放：按蓄力等级决定威力 */
  function releaseCharge(f) {
    const c = f.charge;
    if (!c) return;
    const kind = c.kind;
    const ratio = Math.max(0, Math.min(1, (c.t - CHARGE_MIN) / (CHARGE_MAX - CHARGE_MIN)));
    const lv = Math.round(ratio);                 // 0 = 强化，1 = 满蓄
    const key = kind === "fire" ? "hpCharge" : "hkCharge";
    const base = MOVES[f.id][key];
    if (c.orb) { c.orb.life = 0.02; c.orb = null; }
    f.charge = null;
    f.chargeCd = 0.28;
    f.state = "idle";
    animOf(f).stopClip("charge");
    if (!base) return;

    // 生成强化招式实例（按等级提升伤害/速度/尺寸）
    const mv = Object.assign({}, base);
    mv.dmg = Math.round(base.dmg * (0.82 + 0.18 * ratio + 0.35 * ratio * ratio));
    mv.projScale = (base.projScale || 2.2) * (0.72 + 0.4 * lv);
    mv.projSpeed = (base.projSpeed || 9) * (0.8 + 0.3 * lv);
    mv.chargeLv = lv;
    mv.chargeRatio = ratio;
    f.mvOverride = mv;
    const ok = startAtk(f, key);
    f.mvOverride = null;
    if (ok) {
      // 释放瞬间的史诗级演出
      const dir = f.facing;
      const x = f.x + dir * 0.6, y = f.y + (base.hitY || 0.95);
      T.FXlib.chargedWave(fx, x, y, dir, kind, Math.max(lv, 1));
      T.FXlib.dragonHeadBlast(fx, x, y, dir, kind);
      T.FXlib.elementStorm(fx, f, kind, 0.55);
      flashColor = kind === "fire" ? "#ffe0a0" : "#d8f4ff";
      flashT = 0.32;
      addTrauma(1.0); addFov(6.0);
      camPunch = 0.7 + lv * 0.4;
      hitstopT = Math.max(hitstopT, 0.1);
      slowmo = 0.5;
      setTimeout(function () { slowmo = 1; }, 200);
      sfx(kind === "fire" ? "super" : "freeze");
      if (f === p1) announce(mv.name + (lv ? " · 满蓄" : " · 强化"), 1.1);
    }
  }

  function startAtk(f, key) {
    const mv = f.mvOverride || MOVES[f.id][key];
    if (!mv) return false;
    if (f.state === "ko" || f.state === "win" || f.state === "hurt") return false;
    if (mv.cost && f.meter < mv.cost) {
      if (f === p1 || !vsCpu) {
        sfx("block");
        flashMeter(f === p1 ? "mt-p1" : "mt-p2");
        announce("气槽不足", 0.55);
      }
      return false;
    }
    if (BUSY.includes(f.state)) {
      const gat = f.connected && f.atk && f.atk.cancel && f.atk.cancel.indexOf(key) >= 0;
      if (!gat) return false;
    } else if ((f.state === "jump" || f.y > 0.05) && !(mv.air || mv.jump)) {
      return false;
    }
    if (mv.throw) {
      const o = foeOf(f);
      if (Math.abs(f.x - o.x) > mv.range || o.y > 0.15 || o.invulT > 0 || o.state === "hurt" || o.state === "ko") return false;
    }
    if (mv.cost) f.meter -= mv.cost;
    f.state = key;
    f.stateT = 0;
    f.atk = mv;
    f.atkKey = key;
    f.hitDone = 0;
    f.nextHitT = mv.startup;
    f.connected = false;
    f.blocking = false;
    f.quakeSpawned = false;
    f.projSpawned = false;
    const an = animOf(f);
    // 蓄力波复用普通波的施法动作，但按蓄力等级放大
    const clipKey = key === "skill" && f.id === "meishu" && f.y > 0.05 ? "skillAir"
      : key === "hpCharge" ? "hp" : key === "hkCharge" ? "hk" : key;
    const totalDur = mv.startup + mv.active + mv.rec;
    an.play(key, T.clipFor(f.id, clipKey), totalDur);
    an.chargeLv = mv.chargeRatio == null ? 0 : mv.chargeRatio;
    if (mv.lunge && f.y <= 0.02) f.x += f.facing * mv.lunge * 0.06;
    // 预设命中时刻（命中瞬间的归一化时间），让出拳动作在接触点回收
    an.hitAtK = totalDur > 0 ? mv.startup / totalDur : 0.4;
    an.fxPhase = "startup";
    if (mv.dash) f.vx = f.facing * mv.dash;
    if (mv.jump) { f.vy = mv.jump; f.y = 0.01; }
    if (mv.invul) f.invulT = mv.invul[1] - mv.invul[0];
    emitAttackFx(f, mv, "startup");
    const isUltra = key === "ultra1" || key === "ultra2" || key === "ultra3";
    sfx(key === "super" || isUltra ? "super" : (key === "skill" || key === "skill2") ? "skill" : key === "throw" ? "heavy" : mv.proj === "fire" ? "fire" : mv.proj === "ice" ? "ice" : "whiff");
    if (key === "skill2") announce(mv.name, 0.7);
    if (key === "super" || isUltra) {
      flashColor = isUltra
        ? (f.id === "naiwa" ? "#ffd080" : "#c08aff")
        : (f.id === "naiwa" ? "#ff8a3c" : "#ffe9b0");
      flashT = isUltra ? 0.22 : (f.id === "naiwa" ? 0.1 : 0.38);
      slowmo = isUltra ? 0.18 : (f.id === "naiwa" ? 0.28 : 0.22);
      setTimeout(function () { slowmo = 1; }, isUltra ? 980 : (f.id === "naiwa" ? 720 : 420));
      addTrauma(isUltra ? 1.25 : 0.95); addFov(isUltra ? 7.2 : 5.6);
      announce(mv.name, isUltra ? 1.55 : (f.id === "naiwa" ? 1.15 : 1.7), "super-call");
      T.FXlib.pillar(fx, f.x, isUltra && f.id !== "naiwa" ? 0x7a2ad8 : f.color, isUltra ? 1.15 : (f.id === "naiwa" ? 0.7 : 0.95));
      /* ===== CG 演出层：专属运镜 + 异空间背景 + 英雄光环 ===== */
      const totalDur = mv.startup + mv.active + mv.rec;
      if (isUltra) {
        T.Cinema.playUltra(f, Number(key.slice(-1)));
        if (T.Bloom) { T.Bloom.boost(0.6); setTimeout(function () { T.Bloom.boost(0); }, 1500); }
        T.FXlib.ultraBackdrop(fx, f,
          f.id === "naiwa" ? "#ffe2a0" : "#e2b4ff",
          f.id === "naiwa" ? "#c23a08" : "#38105e",
          totalDur * 1.25,
          f.id === "naiwa" ? T.fxTextures.holySigil : T.fxTextures.rune);
        T.FXlib.heroAura(fx, f, f.id === "naiwa" ? 0xffb050 : 0xb06aff, totalDur * 1.1);
        T.FXlib.ultraRain(fx, f.x, f.id === "naiwa" ? 0xffc060 : 0xc080ff, totalDur);
      } else {
        T.Cinema.playSuper(f);
      }
      if (f.id !== "naiwa") showCutin(f, mv);
      else {
        const box = $("letterbox");
        if (box) {
          box.classList.remove("hidden");
          box.classList.add("kof");
          clearTimeout(showCutin._t);
          showCutin._t = setTimeout(function () { box.classList.add("hidden"); box.classList.remove("kof"); }, isUltra ? 1200 : 900);
        }
        camPunch = isUltra ? 0.82 : 0.55;
      }
    } else if (key === "skill") {
      announce(mv.name, 0.85);
      if (f.id === "naiwa") {
        T.FXlib.meteorTrail(fx, f, 0.85);
        T.FXlib.elementStorm(fx, f, "fire", 0.7);
        T.FXlib.chargeAura(fx, f, 0.4, 0xff7a1a);
      }
    }
    return true;
  }

  let meterFlash = {};
  function flashMeter(id) {
    const el = $(id);
    if (!el || meterFlash[id]) return;
    el.parentNode.classList.add("deny");
    meterFlash[id] = setTimeout(function () {
      el.parentNode.classList.remove("deny");
      meterFlash[id] = 0;
    }, 260);
  }

  function hitFighter(atk, def, mv, hx) {
    if (def.state === "ko" || def.invulT > 0) return;
    const x = hx !== undefined ? hx : (atk.x + atk.facing * ((mv.limbLen || 1.1) * 0.7) + def.x) / 2;
    const y = (atk.y + (mv.hitY != null ? mv.hitY : 0.9) + def.y + 0.85) * 0.5;
    const standBlock = def.blocking && !def.crouch;
    const crouchBlock = def.blocking && def.crouch;
    const blocked = !mv.throw && ((standBlock && !mv.low) || (crouchBlock));
    if (blocked) {
      def.hp = Math.max(1, def.hp - mv.dmg * 0.12);
      def.meter = Math.min(100, def.meter + 4);
      def.kvx = atk.facing * 2.2;
      def.stunT = mv.blockstun || 0.16;
      def.state = "block"; def.stateT = 0;
      hitstopT = Math.max(hitstopT, 0.05);
      addTrauma(0.20); addFov(1.2);
      emitHitFx(atk, def, mv, x, y, true);
      sfx("block");
      return;
    }
    def.hp = Math.max(0, def.hp - mv.dmg);
    def.meter = Math.min(100, def.meter + mv.dmg * 0.36);
    atk.meter = Math.min(100, atk.meter + (mv.meter || 6));
    atk.connected = true;
    atk.combo += 1;
    atk.comboT = 1.5;
    matchMaxCombo = Math.max(matchMaxCombo, atk.combo);
    if (trainMode && atk === p1) trainComboDmg += mv.dmg;
    def.combo = 0;
    const heavy = mv.dmg >= 10;
    // —— 打击感三件套：顿帧 / 命中回弹 / 镜头前顶 ——
    hitstopT = Math.max(hitstopT, (mv.hitstop || 0.09) * (heavy ? 1.35 : 1.15) * (mv.cost ? 1.35 : 1));
    addTrauma((heavy ? 0.88 : 0.46) + (mv.cost ? 0.22 : 0));
    addFov((heavy ? 5.0 : 2.4) + (mv.cost ? 2.2 : 0));
    shakeRot = (Math.random() - 0.5) * (heavy ? 0.03 : 0.014) * (mv.cost ? 1.6 : 1);
    camPunch = heavy ? 0.42 : 0.2;
    /* 大招每一Hit都叠一圈扩散环，读出节拍 */
    if (mv.cost) {
      const rc = atk.id === "naiwa" ? 0xffc860 : 0xc090ff;
      fx.pool.emit({ map: T.fxTextures.ring, x: x, y: y, z: 0.4, size: 0.5, size1: 2.3, life: 0.3, color: rc, opacity: 0.85, front: true });
    }
    // 出拳臂命中回弹（动画层读取归一化时刻）
    const aan = animOf(atk);
    if (atk.atk && mv.startup && aan.clip === atk.atkKey) {
      aan.hitAtK = Math.min(1, atk.stateT / (mv.startup + mv.active + mv.rec));
    }
    // 攻击者微前踏（拳拳到肉的跟进感）
    if (!mv.dash && !mv.jump) atk.x += atk.facing * (heavy ? 0.16 : 0.1);
    if (heavy) { flashColor = mv.proj === "ice" ? "#d8f6ff" : "#fff6d8"; flashT = Math.max(flashT, 0.1); }
    emitHitFx(atk, def, mv, x, y, false);
    sfx(heavy ? "heavy" : "hit", { combo: atk.combo });
    showDamageNumber(x, y, mv.dmg, atk, heavy);
    if (def.hp <= 0) { koFighter(atk, def); return; }
    def.state = "hurt";
    def.stateT = 0;
    def.atk = null;
    def.stunT = (mv.stun || 0.32) * (mv.proj === "ice" ? 1.18 : 1);
    const an = animOf(def);
    an.stopClip();
    an.play("hurt", T.COMMON.hurt, Math.max(0.28, def.stunT));
    an.shake = heavy ? 1.35 : 0.9;
    an.bigHurt = heavy;
    an.squash = heavy ? 0.68 : 0.78;
    an.stretch = heavy ? 1.22 : 1.12;
    an.flashTimer = heavy ? 0.14 : 0.08;
    // 击退改为速度冲量：受击者被"打飞"再摩擦减速
    // 大招多段命中：超必锁体（大幅衰减击退 + 吸附回位），保证 CG 连段完整演出
    const lock = mv.cost && (mv.hits || 1) > 1;
    def.kvx = atk.facing * (mv.knock || 2.4) * (lock ? 0.14 : 1);
    if (lock && Math.abs(def.x - atk.x) > 2.55) {
      def.x = atk.x + atk.facing * 2.4;
      def.kvx = 0;
    }
    if (heavy && def.y <= 0.02) { def.vy = 1.7; def.y = 0.01; }   // 重击微弹起
    if (mv.launcher && def.y <= 0.02) { def.vy = 5.2; def.y = 0.01; }
    if (mv.push) { atk.kvx = -atk.facing * 2.2; }
    updateCombo();
  }

  /* 飘伤害数字 */
  const dmgNums = [];
  function showDamageNumber(x, y, dmg, atk, heavy) {
    const el = document.createElement("div");
    el.className = "dmgnum" + (heavy ? " big" : "");
    el.textContent = Math.round(dmg);
    $("dmg-layer").appendChild(el);
    dmgNums.push({ el: el, t: 0, x: x, y: y, life: heavy ? 0.9 : 0.7, vx: (Math.random() - 0.5) * 0.6 });
    if (dmgNums.length > 14) {
      const old = dmgNums.shift();
      if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
  }
  function projectToScreen(x, y) {
    camera.getWorldDirection(tmpDir);
    tmpV.set(x, y, 0).project(camera);
    return {
      sx: (tmpV.x * 0.5 + 0.5) * innerWidth,
      sy: (-tmpV.y * 0.5 + 0.5) * innerHeight,
    };
  }
  const tmpV = new THREE.Vector3(), tmpDir = new THREE.Vector3();
  function updateDamageNumbers(dt) {
    for (let i = dmgNums.length - 1; i >= 0; i--) {
      const d = dmgNums[i];
      d.t += dt;
      const k = d.t / d.life;
      if (k >= 1) {
        if (d.el.parentNode) d.el.parentNode.removeChild(d.el);
        dmgNums.splice(i, 1);
        continue;
      }
      const p = projectToScreen(d.x + d.vx * k, d.y + k * 0.9 - k * k * 0.5);
      const sc = k < 0.18 ? k / 0.18 * 1.25 : 1.25 - (k - 0.18) * 0.3;
      d.el.style.transform = "translate(" + p.sx.toFixed(0) + "px," + p.sy.toFixed(0) + "px) scale(" + sc.toFixed(2) + ") rotate(" + (d.vx * 12).toFixed(1) + "deg)";
      d.el.style.opacity = k > 0.6 ? String(1 - (k - 0.6) / 0.4) : "1";
    }
  }

  function koFighter(atk, def) {
    def.state = "ko"; def.stateT = 0; def.atk = null;
    def.vy = 5.2; def.y = 0.01;
    def.kvx = atk.facing * 5.2;
    def.x += atk.facing * 0.2;
    const an = animOf(def);
    an.stopClip();
    an.play("ko", T.COMMON.ko, 1.6, true);
    atk.state = "win"; atk.atk = null;
    const aan = animOf(atk);
    aan.stopClip();
    aan.play("win", T.COMMON.win, 2.4, true);
    slowmo = 0.22;
    hitstopT = 0.45;
    addTrauma(1.0); addFov(6.0);
    flashColor = "#ffffff"; flashT = 0.4;
    /* 终结演出：十字闪爆发 + 侧向移轴掠镜 */
    T.FXlib.impactFinish(fx, def.x, def.y + 0.9, atk.id === "naiwa" ? 0xffb050 : atk.color);
    T.Cinema.playKO(def);
    T.FXlib.koBurst(fx, def.x, def.y + 0.9);
    T.FXlib.crack(fx, def.x, 2.4);
    T.FXlib.dust(fx, def.x, atk.facing, 1.6);
    sfx("ko");
    announce("K.O.", 1.6, "ko-call");
    if (trainMode) {
      setTimeout(trainReset, 1600);
      if (!SHOT) setTimeout(function () { startReplay(); }, 620);   // 训练里也可复盘
      return;
    }
    if (!netPlay && !SHOT) {
      wantShot = true;                                   // KO 定帧截图（战绩册）
      setTimeout(function () { startReplay(); }, 640);   // 终结回放
    }
    endRound(atk);
  }

  function updateCombo() {
    const el = $("combo");
    const c = Math.max(p1.combo, p2.combo);
    const mine = p1.combo >= 2 ? p1 : p2.combo >= 2 ? p2 : null;
    if (mine && c >= 2) {
      el.innerHTML = "<b>" + c + "</b> HITS";
      el.style.color = c >= 6 ? "#ffdf6a" : c >= 4 ? "#fff" : "#e9dcbf";
      el.classList.remove("pop");
      void el.offsetWidth;
      el.classList.add("pop");
    } else el.innerHTML = "";
  }

  function hurtbox(o) {
    const crouch = !!(o.crouch || o.state === "crouch") && o.y <= 0.08;
    return {
      x: o.x,
      y: o.y + (crouch ? 0.4 : 0.82),
      hw: crouch ? 0.34 : 0.38,
      hh: crouch ? 0.36 : 0.56,
    };
  }

  function tryHits(f, o) {
    if (!f.atk || f.state === "hurt" || f.state === "ko") return;
    if (f.atk.proj) return;
    const mv = f.atk;
    const t = f.stateT;
    if (t < mv.startup) return;
    if (t > mv.startup + mv.active) return;
    if (t < f.nextHitT) return;
    const maxHits = mv.hits || 1;
    if (f.hitDone >= maxHits) return;
    if (o.state === "ko") return;
    /* hitReach：远程演出类招式（超必/终极）做前向线段扫描——
       对手在 [近身, reach] 区间内即命中（像穿透光束），命中点落在对手身上 */
    const reach = mv.hitReach != null ? mv.hitReach
      : mv.limbLen != null ? mv.limbLen : mv.range;
    const hx = f.x + f.facing * reach;
    const hy = f.y + (mv.hitY != null ? mv.hitY : 0.9);
    const hb = hurtbox(o);
    const dy = Math.abs(hy - hb.y);
    const hitR = mv.limb === "foot" ? 0.28 : mv.limb === "belly" ? 0.34 : 0.24;
    let hitX = hx;
    let landed = false;
    if (mv.hitReach != null) {
      const fwd = (hb.x - f.x) * f.facing;
      landed = fwd > -hb.hw && fwd <= reach + hb.hw && dy < hb.hh + 0.3;
      if (landed) hitX = hb.x;
    } else {
      landed = Math.abs(hx - hb.x) < hb.hw + hitR && dy < hb.hh + hitR;
    }
    if (landed) {
      f.hitDone += 1;
      f.nextHitT = t + (mv.hitGap || 9);
      hitFighter(f, o, mv, hitX);
      if (mv.quake && f.hitDone === 1 && !f.quakeSpawned) {
        f.quakeSpawned = true;
        spawnDragonQuake(f);
      }
    }
  }

  function updateLimbs(f) {
    const m = animOf(f).model;
    if (!m || !m.limbs) return;
    const L = m.limbs;
    const mv = f.atk;
    const kind = mv && mv.limb;
    const t = f.stateT;
    const inAtk = !!(mv && t <= mv.startup + mv.active + 0.06);
    const active = !!(mv && t >= mv.startup && t <= mv.startup + mv.active);
    ["fist", "foot", "belly"].forEach(function (k) {
      const mesh = L[k];
      if (!mesh) return;
      const on = inAtk && kind === k;
      mesh.visible = on;
      if (!on) return;
      const wind = mv.startup > 0 ? Math.min(1, t / mv.startup) : 1;
      const reach = (mv.limbLen || 1) * (active ? 1 : 0.35 + 0.5 * wind);
      mesh.position.set(reach * 0.78, mv.hitY != null ? mv.hitY : 0.9, 0);
      const pulse = active ? 1.12 : 0.78;
      if (k === "fist") mesh.scale.set(1.2 * pulse, 0.82 * pulse, 0.88 * pulse);
      if (k === "foot") mesh.scale.set(1.55 * pulse, 0.48 * pulse, 0.92 * pulse);
      if (k === "belly") mesh.scale.set(1.4 * pulse, 1.05 * pulse, 0.72 * pulse);
      if (mesh.material && mesh.material.color) {
        if (mv.proj === "fire") mesh.material.color.set(0xff7a1a);
        else if (mv.proj === "ice") mesh.material.color.set(0x9ee8ff);
        else mesh.material.color.set(0xf2d24a);
      }
    });
  }

  /* 火焰波 / 寒冰波 */
  const bolts = [];
  let boltSeq = 1;
  function spawnBolt(f, mv) {
    if (!mv || !mv.proj) return;
    T.ensureFxTextures();
    const kind = mv.proj;
    const fire = kind === "fire";
    const grp = new THREE.Group();
    const coreCol = fire ? 0xff9a28 : 0x3ab8ff;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 * (mv.projScale || 1), 18, 14),
      new THREE.MeshBasicMaterial({ color: coreCol, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    ball.scale.set(1.35, 0.78, 0.78);
    grp.add(ball);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.fxTextures.core,
      color: fire ? 0xff9a28 : 0x4ac0ff,
      transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      alphaTest: 0.04,
    }));
    const sc = (mv.projScale || 1) * (f.id === "naiwa" ? 1.28 : 1);
    halo.scale.set(0.95 * sc, 0.95 * sc, 1);
    grp.add(halo);
    ball.scale.set(1.5, 0.88, 0.88);
    const veil = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fire ? T.fxTextures.flame : T.fxTextures.ice,
      color: fire ? 0xff8a1a : 0x9ee8ff,
      transparent: true, opacity: f.id === "naiwa" ? 0.95 : 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    veil.scale.set(1.85 * sc, 1.85 * sc, 1);
    grp.add(veil);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.fxTextures.ring, color: fire ? 0xffe08a : 0xffffff,
      transparent: true, opacity: 0.78,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    ring.scale.set(1.65 * sc, 1.65 * sc, 1);
    grp.add(ring);
    grp.userData.ring = ring;
    grp.userData.veil = veil;
    if (f.id === "naiwa") {
      const head = new THREE.Sprite(new THREE.SpriteMaterial({
        map: fire ? T.fxTextures.dragonHead : T.fxTextures.snow,
        color: fire ? 0xfff2c0 : 0xd8f6ff,
        transparent: true, opacity: 0.88,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      head.scale.set(1.35 * sc, 1.35 * sc, 1);
      grp.add(head);
      grp.userData.head = head;
    }
    const y = f.y + (mv.hitY != null ? mv.hitY : 0.9);
    const x = f.x + f.facing * 0.55;
    grp.position.set(x, y, 0);
    scene.add(grp);
    if (fire) T.FXlib.fireWave(fx, x, y, f.facing, (mv.projScale || 1) * (f.id === "naiwa" ? 1.35 : 1));
    else T.FXlib.iceWave(fx, x, y, f.facing, (mv.projScale || 1) * (f.id === "naiwa" ? 1.35 : 1));
    if (f.id === "naiwa") {
      T.FXlib.dragonHeadBlast(fx, x, y, f.facing, fire ? "fire" : "ice");
      T.FXlib.airShock(fx, x, y, f.facing, fire ? 0xffd88a : 0xd8f6ff, 1.15);
    }
    bolts.push({
      id: boltSeq++, grp: grp, ball: ball, halo: halo, kind: kind,
      x: x, y: y, dir: f.facing, vy: mv.projLift || 0,
      speed: mv.projSpeed || 7, life: mv.projLife || 1.2, t: 0,
      dmg: mv.dmg, owner: f, mv: mv, hit: false,
    });
  }
  function disposeBolt(b) {
    if (b.grp && b.grp.parent) b.grp.parent.remove(b.grp);
    if (b.ball && b.ball.material) b.ball.material.dispose();
  }
  function updateBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.t += dt;
      b.x += b.dir * b.speed * dt;
      b.y += (b.vy || 0) * dt;
      if (b.vy) b.vy -= 6 * dt;
      b.grp.position.set(b.x, b.y, 0);
      const naiwaBolt = b.owner && b.owner.id === "naiwa";
      const pulse = 1 + Math.sin(b.t * 22) * (naiwaBolt ? 0.2 : 0.12);
      b.grp.scale.set(pulse, pulse, pulse);
      b.halo.material.rotation += dt * (b.kind === "ice" ? 10 : 4);
      if (b.grp.userData.ring) b.grp.userData.ring.material.rotation += dt * (b.kind === "ice" ? -3.4 : 3.2);
      if (b.grp.userData.veil) b.grp.userData.veil.material.rotation += dt * 1.2;
      if (b.grp.userData.head) b.grp.userData.head.material.rotation += dt * (b.kind === "ice" ? 6 : 1.6);
      b.ball.material.opacity = 0.92 * (1 - b.t / b.life);
      b.halo.material.opacity = 0.9 * (1 - b.t / b.life);
      if (b.kind === "fire") T.FXlib.fireTrail(fx, b.x, b.y, b.dir);
      else T.FXlib.iceTrail(fx, b.x, b.y, b.dir);
      if (naiwaBolt && Math.random() < 0.9) {
        T.FXlib.starTrail(fx, b.x, b.y, b.dir, b.kind === "fire" ? 0xff9a28 : 0x7ad0ff, 3);
      }
      // 强化波 / 奶龙弹道：全程撒元素雨
      if ((naiwaBolt || (b.mv && b.mv.charged)) && Math.random() < (naiwaBolt ? 0.92 : 0.75)) {
        if (b.kind === "fire") {
          fx.pool.emit({
            map: Math.random() < 0.5 ? T.fxTextures.ember : T.fxTextures.flame,
            x: b.x + T.rand(-0.4, 0.4), y: b.y + T.rand(-0.5, 0.5), z: T.rand(-0.4, 0.4),
            size: T.rand(0.1, 0.34), size1: 0.02, sy: T.rand(0.9, 1.5),
            life: T.rand(0.24, 0.5), color: Math.random() < 0.5 ? 0xff7a1a : 0xffe9a0,
            vx: b.dir * T.rand(0.5, 2.4), vy: T.rand(-0.6, 2.6), vz: T.rand(-1, 1),
            g: -5, drag: 1.4, spin: T.rand(-16, 16), fadePow: 1.3,
          });
        } else {
          fx.pool.emit({
            map: Math.random() < 0.5 ? T.fxTextures.snow : T.fxTextures.ice,
            x: b.x + T.rand(-0.4, 0.4), y: b.y + T.rand(-0.5, 0.5), z: T.rand(-0.4, 0.4),
            size: T.rand(0.1, 0.32), size1: 0.02, sy: T.rand(0.9, 1.5),
            life: T.rand(0.26, 0.54), color: Math.random() < 0.5 ? 0x9ee8ff : 0xffffff,
            vx: b.dir * T.rand(0.4, 2), vy: T.rand(-0.5, 2), vz: T.rand(-1, 1),
            g: -3, drag: 1.4, spin: T.rand(-22, 22), fadePow: 1.3,
          });
        }
      }
      const foe = b.owner === p1 ? p2 : p1;
      if (!b.hit && foe.state !== "ko") {
        const hb = hurtbox(foe);
        const rad = b.mv && b.mv.charged ? 0.62 : 0.28;
        if (Math.abs(b.x - hb.x) < hb.hw + rad && Math.abs(b.y - hb.y) < hb.hh + rad * 0.8) {
          b.owner.connected = true;
          hitFighter(b.owner, foe, b.mv, b.x);
          if (b.mv && b.mv.pierce) {
            // 强化波贯穿：命中后继续飞行，但同一目标不再重复命中
            b.hit = true;
            b.pierceUsed = true;
            b.dmgMul = 0.6;
          } else {
            b.hit = true;
            b.t = b.life;
          }
        }
      }
      if (b.t >= b.life || Math.abs(b.x) > T.STAGE_HALF + 2.4) {
        disposeBolt(b);
        bolts.splice(i, 1);
      }
    }
  }
  function clearBolts() {
    for (let i = bolts.length - 1; i >= 0; i--) disposeBolt(bolts[i]);
    bolts.length = 0;
    for (let i = ghostBolts.length - 1; i >= 0; i--) disposeBolt(ghostBolts[i]);
    ghostBolts.length = 0;
  }
  function syncGhostBolts(list) {
    const map = {};
    for (let i = 0; i < ghostBolts.length; i++) map[ghostBolts[i].id] = ghostBolts[i];
    const keep = {};
    (list || []).forEach(function (s) {
      keep[s.id] = true;
      let g = map[s.id];
      if (!g) {
        T.ensureFxTextures();
        const fire = s.k === "fire";
        const grp = new THREE.Group();
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 14, 12),
          new THREE.MeshBasicMaterial({ color: fire ? 0xff9a28 : 0x9ee8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
        );
        ball.scale.set(1.35, 0.78, 0.78);
        grp.add(ball);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: T.fxTextures.core,
          color: fire ? 0xff9a28 : 0x8ad8ff, transparent: true, opacity: 0.85,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
          alphaTest: 0.04,
        }));
        halo.scale.set(0.72, 0.72, 1);
        grp.add(halo);
        scene.add(grp);
        g = { id: s.id, grp: grp, ball: ball, halo: halo, kind: s.k };
        ghostBolts.push(g);
      }
      g.grp.position.set(s.x, s.y, 0);
    });
    for (let i = ghostBolts.length - 1; i >= 0; i--) {
      if (!keep[ghostBolts[i].id]) {
        disposeBolt(ghostBolts[i]);
        ghostBolts.splice(i, 1);
      }
    }
  }

  /* 凝胶地浪弹道 */
  const waves = [];
  function orochiWave(x, dir, owner) {
    T.ensureFxTextures();
    const grp = new THREE.Group();
    const tongue = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.fxTextures.orochiFlame, color: 0xff8a1a, transparent: true, opacity: 0.92,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    tongue.scale.set(2.8, 1.35, 1);
    grp.add(tongue);
    const blood = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.fxTextures.bloodFlame, color: 0xff2068, transparent: true, opacity: 0.62,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    blood.scale.set(1.2, 1.8, 1);
    blood.position.set(0, 0.15, 0.05);
    grp.add(blood);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.fxTextures.dragonHead, color: 0xfff2c0, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    head.scale.set(1.15, 1.15, 1);
    head.position.set(dir * 0.55, 0.25, 0.08);
    grp.add(head);
    tongue.material.depthTest = false; tongue.renderOrder = 17;
    blood.material.depthTest = false; blood.renderOrder = 17;
    head.material.depthTest = false; head.renderOrder = 18;
    grp.position.set(x, 0.7, 1.55);
    scene.add(grp);
    waves.push({
      grp: grp, mesh: tongue, halo: blood, head: head,
      x: x, dir: dir, speed: 6.4, life: 1.35, t: 0, dmg: 8, owner: owner, hitT: -9, kind: "orochi",
    });
  }
  function quakeWave(x, dir, owner) {
    T.ensureFxTextures();
    const grp = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.1, 8, 26),
      new THREE.MeshBasicMaterial({ color: 0xb8e04a, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    m.rotation.x = Math.PI / 2;
    grp.add(m);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: T.fxTextures.gel, color: 0xd8ff9a, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    halo.scale.setScalar(1.1);
    grp.add(halo);
    grp.position.set(x, 0.2, 0);
    scene.add(grp);
    waves.push({ grp: grp, mesh: m, halo: halo, x: x, dir: dir, speed: 4.9, life: 1.6, t: 0, dmg: 9, owner: owner, hitT: -9 });
  }
  function updateWaves(dt) {
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.t += dt;
      w.x += w.dir * w.speed * dt;
      w.grp.position.x = w.x;
      const pulse = 1 + Math.sin(w.t * 18) * 0.14;
      w.grp.scale.set(pulse, 1 + Math.sin(w.t * 10) * 0.12, 1);
      w.halo.material.rotation += dt * 3;
      w.mesh.material.opacity = 0.92 * (1 - w.t / w.life);
      w.halo.material.opacity = (w.kind === "orochi" ? 0.62 : 0.8) * (1 - w.t / w.life);
      if (w.head) w.head.material.opacity = 0.85 * (1 - w.t / w.life);
      if (w.kind === "orochi") {
        T.FXlib.fireTrail(fx, w.x, 0.45, w.dir);
        if (Math.random() < 0.5) T.FXlib.fireTrail(fx, w.x, 0.9, w.dir);
      } else T.FXlib.gelWave(fx, w.grp, w.t, w.t / w.life);
      const foe = w.owner === p1 ? p2 : p1;
      if (w.t - w.hitT > 0.5 && Math.abs(w.x - foe.x) < 0.95 && foe.y < 0.7 && foe.state !== "ko") {
        w.hitT = w.t;
        hitFighter(w.owner, foe, { name: "凝胶弹", dmg: w.dmg, knock: 2.6, hitstop: 0.08, fx: "belly" }, w.x);
      }
      if (w.t > w.life || Math.abs(w.x) > T.STAGE_HALF + 2.4) {
        scene.remove(w.grp);
        w.grp.traverse(function (o) { if (o.material) o.material.dispose(); });
        waves.splice(i, 1);
      }
    }
  }

  function tickFighter(f, dt) {
    f.stateT += dt;
    f.invulT = Math.max(0, f.invulT - dt);
    const an = animOf(f);
    // 蓄力中：手心聚能光球 + 地面震裂 + 角色微颤
    if (f.charge) {
      const c = f.charge;
      if (!c.orb) {
        c.orb = T.FXlib.chargeOrb(fx, f, c.lv, c.kind);
      }
      c.orb.level = c.lv;
      an.chargeLv = c.lv;
      // 蓄力时移动变慢（扎马步）
      if (f.state === "charge" && f.y <= 0.02) f.x = f.x;
      // 满蓄时地表震颤
      if (c.lv > 0.85 && Math.random() < 0.7) {
        T.FXlib.dust(fx, f.x + T.rand(-0.5, 0.5), f.facing, 0.45);
        if (c.kind === "fire") T.FXlib.groundGlyph(fx, f.x + T.rand(-0.3, 0.3), 0xff5a10, 1.2);
        else T.FXlib.frostGlyph(fx, f.x + T.rand(-0.3, 0.3), 1.15);
      }
      if (Math.random() < 0.55) {
        T.FXlib.starTrail(fx, f.x + f.facing * 0.5, f.y + 0.95, f.facing,
          c.kind === "fire" ? 0xff7a1a : 0x7ad0ff, 5);
      }
      if (Math.random() < 0.4) {
        if (c.kind === "fire") T.FXlib.fireTrail(fx, f.x + f.facing * 0.45, f.y + 0.95, f.facing);
        else T.FXlib.iceTrail(fx, f.x + f.facing * 0.45, f.y + 0.95, f.facing);
      }
    }
    if (an.fxPhase && f.atk && f.stateT > f.atk.startup) an.fxPhase = "active";
    if (f.atk && f.atk.proj && !f.projSpawned && f.stateT >= f.atk.startup) {
      f.projSpawned = true;
      spawnBolt(f, f.atk);
    }
    if (f.atk && an.fxPhase === "active") emitAttackFx(f, f.atk, "active");
    if (f.atk && f.atk.quake && !f.quakeSpawned && f.stateT >= f.atk.startup + 0.42) {
      f.quakeSpawned = true;
      spawnDragonQuake(f);
    }

    // 击退冲量：摩擦减速，落地扬尘
    if (f.kvx) {
      f.x += f.kvx * dt;
      f.kvx *= Math.max(0, 1 - 7 * dt);
      if (f.state === "hurt" && f.y === 0 && Math.abs(f.kvx) > 1 && Math.random() < 0.4) {
        T.FXlib.dust(fx, f.x, Math.sign(f.kvx), 0.35);
      }
      if (Math.abs(f.kvx) < 0.2) f.kvx = 0;
    }

    // 物理
    if (f.y > 0 || f.vy > 0) {
      f.y += f.vy * dt;
      f.vy -= 15.5 * dt;
      if (f.state === "jump" && f.vx) f.x += f.vx * dt;
      if (f.y <= 0) {
        f.y = 0;
        const hard = f.vy < -3.2;
        f.vy = 0;
        if (hard) {
          T.FXlib.dust(fx, f.x, f.facing, 1.1);
          sfx("land");
          addTrauma(0.22); addFov(1.4);
        }
        if (f.state === "jump") {
          f.state = "idle";
          f.vx = 0;
          an.stopClip("jump");
          const o = foeOf(f);
          if (o) syncFacing(f, o);
        }
        if (f.state === "skill" && f.atk && f.atk.slam) {
          addTrauma(0.80); addFov(4.6);
          T.FXlib.dust(fx, f.x, 1, 1.5);
          T.FXlib.dust(fx, f.x, -1, 1.5);
          T.FXlib.crack(fx, f.x, 1.9);
          T.FXlib.gelDrip(fx, f.x, 0.6, 12);
          const grp = fx.group(0.34, function (ff, gr, k) {
            gr.meshes[0].scale.set(1.4 + k * 4.6, (1.4 + k * 4.6) * 0.34, 1);
            gr.meshes[0].material.uniforms.uOpacity.value = (1 - k) * 0.9;
          });
          fx.addRing(grp, { x: f.x, y: 0.15, z: 0, rx: -Math.PI / 2, color: "#d8ff9a", size: 1.4 });
          sfx("heavy");
          const o = foeOf(f);
          if (Math.abs(o.x - f.x) < 2 && o.y < 0.6 && o.state !== "ko") {
            hitFighter(f, o, Object.assign({}, f.atk, { dmg: f.atk.dmg + 4, knock: 4.6 }), f.x);
          }
        }
      }
    }
    // 冲刺位移
    if (f.atk && f.atk.dash && f.stateT < f.atk.startup + f.atk.active) {
      f.x += f.vx * dt;
      if (Math.random() < 0.7) T.FXlib.trail(fx, f.x - f.facing * 0.3, f.y + 0.7, f.color);
    } else if (f.state === "dash") {
      f.x += f.vx * dt;
      f.dashT -= dt;
      T.FXlib.trail(fx, f.x, f.y + 0.8, f.color);
      if (f.dashT <= 0) f.state = "idle";
    }
    // 攻击收尾
    if (f.atk) {
      const end = f.atk.startup + f.atk.active + f.atk.rec;
      if (f.stateT >= end) {
        f.atk = null;
        an.fxPhase = null;
        f.state = f.y > 0 ? "jump" : "idle";
        an.stopClip();
      }
    }
    if (f.state === "hurt" && f.stateT > Math.max(f.stunT || 0.34, Math.abs(f.kvx) > 1.6 ? 0.48 : 0.3)) f.state = f.y > 0 ? "jump" : "idle";
    if (f.state === "block" && f.stateT > (f.stunT || 0.12)) f.state = f.crouch ? "crouch" : "idle";
    f.comboT -= dt;
    if (f.comboT <= 0 && f.combo > 0) { f.combo = 0; updateCombo(); }
    // 闪白衰减
    if (an.flashTimer > 0) {
      an.flashTimer -= dt;
      const k = Math.max(0, an.flashTimer / 0.12);
      an.flashMaterial(0xffe8c0, k * 0.35);
      if (an.flashTimer <= 0) an.flashMaterial(0x000000, 0);
    }
    f.x = clamp(f.x, -T.STAGE_HALF, T.STAGE_HALF);
  }

  /* ============================================================
     输入
     ============================================================ */
  function padDir(f, L, R, D, U) {
    const fwd = f.facing > 0 ? R : L;
    const back = f.facing > 0 ? L : R;
    const h = fwd && !back ? 1 : back && !fwd ? -1 : 0;
    const v = D && !U ? -1 : U && !D ? 1 : 0;
    if (v < 0 && h > 0) return 3;
    if (v < 0 && h < 0) return 1;
    if (v < 0) return 2;
    if (v > 0 && h > 0) return 9;
    if (v > 0 && h < 0) return 7;
    if (v > 0) return 8;
    if (h > 0) return 6;
    if (h < 0) return 4;
    return 5;
  }
  function recordMotion(f, dir) {
    if (f._lastPad === dir) return;
    f._lastPad = dir;
    if (dir === 5) return;
    f.motion.push({ d: dir, t: elapsed });
    if (f.motion.length > 14) f.motion.shift();
  }
  function motionHas(f, want, win) {
    const arr = f.motion.filter(function (m) { return elapsed - m.t < (win || 0.4); });
    let i = 0;
    for (let k = 0; k < arr.length && i < want.length; k++) {
      if (arr[k].d === want[i]) i++;
    }
    return i === want.length;
  }
  function consumeMotion(f) { f.motion.length = 0; f._lastPad = 5; }

  function resolveNormal(f, lightP, lightK, heavyP, heavyK) {
    if (f.y > 0.08) {
      if (lightP || heavyP) return "jlp";
      if (lightK || heavyK) return "jhk";
      return null;
    }
    if (f.crouch) {
      if (heavyP) return "crhp";
      if (lightP) return "crlp";
      if (lightK || heavyK) return "crlk";
      return null;
    }
    if (lightP) return "lp";
    if (lightK) return "lk";
    if (heavyP) return "hp";
    if (heavyK) return "hk";
    return null;
  }

  function driveInput(f, io) {
    const L = !!io.L, R = !!io.R, U = !!io.U, D = !!io.D;
    f.input.left = L;
    f.input.right = R;
    f.crouch = !!(D && f.y <= 0.02 && !U);
    const back = f.facing > 0 ? L : R;
    const fwd = f.facing > 0 ? R : L;
    recordMotion(f, padDir(f, L, R, D, U));
    // 后退只走路；按住背向时若被打中才算防御
    f.blocking = !!(back && !fwd && f.y <= 0.08);
    if (roundOver || f.state === "ko" || f.state === "win") return;

    if (f.state === "block" && f.stateT > (f.stunT || 0)) {
      f.state = f.crouch ? "crouch" : "idle";
      animOf(f).stopClip("block");
    }

    const lp = !!io.lp, lk = !!io.lk, hp = !!io.hp, hk = !!io.hk, sp = !!io.sp, su = !!io.su;
    const qcf = motionHas(f, [2, 3, 6]) || motionHas(f, [2, 6]);
    const dp = motionHas(f, [6, 2, 3]) || motionHas(f, [6, 3]);
    const qcf2 = motionHas(f, [2, 3, 6, 2, 3, 6], 0.55) || motionHas(f, [2, 6, 2, 6], 0.55);
    // ---------- 蓄力波：长按 U/I 聚能，松手释放强化波 ----------
    const charging = f.charge;
    const holdFire = !!io.holdHp, holdIce = !!io.holdHk;
    if (f.chargeCd > 0) f.chargeCd = Math.max(0, f.chargeCd - dtMove);

    if (charging) {
      // 蓄力中：被击中 / 防御 / 状态异常则中断
      if (f.state === "hurt" || f.state === "ko" || f.state === "block") {
        endCharge(f, false);
      } else {
        charging.t += dtMove;
        charging.lv = Math.max(0, Math.min(1, charging.t / CHARGE_MAX));
        // 满蓄提示
        if (charging.lv >= 1 && !charging.maxed) {
          charging.maxed = true;
          sfx("chargeMax");
          T.FXlib.speedLines(fx, 0.3);
          addTrauma(0.42); addFov(2.4);
          if (f === p1) announce("满蓄！", 0.6);
        }
        const stillHeld = charging.kind === "fire" ? holdFire : holdIce;
        // 满蓄自动发射
        if (charging.t >= CHARGE_MAX || !stillHeld) {
          if (charging.t >= CHARGE_MIN) {
            releaseCharge(f);                      // 蓄力足够 → 强化波
          } else {
            // 短按：按原来的普通波发射（保持点按手感）
            const tapKey = charging.kind === "fire" ? "hp" : "hk";
            endCharge(f, false);
            startAtk(f, tapKey);
          }
        }
      }
    } else if ((holdFire || holdIce) && f.chargeCd <= 0 && !BUSY.includes(f.state) &&
               f.state !== "hurt" && f.state !== "block" && f.state !== "dash" &&
               f.y <= 0.02 && !roundOver) {
      // 起手蓄力（仅拥有波动的角色）
      const kind = holdFire ? "fire" : "ice";
      const mvKey = kind === "fire" ? "hp" : "hk";
      const base = MOVES[f.id][mvKey] || MOVES[f.id][kind === "fire" ? "lp" : "lk"];
      if (base && base.proj) beginCharge(f, kind);
    }

    if ((lp || lk || hp || hk || sp || su) && !f.charge) {
      let used = false;
      if ((lp || hp) && fwd && !D && f.y === 0 && Math.abs(f.x - foeOf(f).x) < 1.05) {
        used = startAtk(f, "throw");
      }
      if (!used && (qcf2 && (lp || hp || su))) { used = startAtk(f, "super"); if (used) consumeMotion(f); }
      if (!used && su && D) { used = startAtk(f, "ultra2"); }
      else if (!used && su && fwd && !D) { used = startAtk(f, "ultra1"); }
      else if (!used && su && back && !D) { used = startAtk(f, "ultra3"); }
      if (!used && su) { used = startAtk(f, "super"); }
      if (!used && (dp && (lp || hp))) { used = startAtk(f, "skill2"); if (used) consumeMotion(f); }
      if (!used && (qcf && (lp || hp || lk))) { used = startAtk(f, "skill"); if (used) consumeMotion(f); }
      if (!used && sp) { used = startAtk(f, f.crouch ? "skill2" : "skill"); }
      if (!used) {
        const nk = resolveNormal(f, lp, lk, hp, hk);
        if (nk) startAtk(f, nk);
      }
    }

    if (f.crouch && !BUSY.includes(f.state) && f.state !== "block" && f.state !== "hurt" && f.state !== "dash" && f.y === 0) {
      if (f.state !== "crouch") f.state = "crouch";
    }

    if (!BUSY.includes(f.state) && f.state !== "block" && f.state !== "hurt" && f.state !== "dash") {
      let moved = false;
      const spd = ((back && !fwd) ? 2.15 : 2.7) * (f.charge ? CHARGE_SLOW : 1);
      const tapDir = function (on, dir) {
        if (!on) return;
        if (f.lastTapDir === dir && elapsed - f.lastTapT < 0.24 && f.y === 0 && f.dashCdT <= 0) {
          f.state = "dash"; f.dashT = 0.18; f.vx = dir * 6.8; f.dashCdT = 0.62;
          animOf(f).play("dash", T.COMMON.dash, 0.3);
          T.FXlib.dust(fx, f.x, -dir, 0.9);
          sfx("dash");
          f.lastTapDir = 0;
          return;
        }
        f.lastTapDir = dir; f.lastTapT = elapsed;
      };
      tapDir(io.tapL, -1);
      tapDir(io.tapR, 1);
      if (!f.crouch && L && f.state !== "dash") { f.x -= spd * dtMove; moved = true; }
      if (!f.crouch && R && f.state !== "dash") { f.x += spd * dtMove; moved = true; }
      if (f.y === 0 && f.state !== "dash") {
        if (moved && f.state !== "walk") f.state = "walk";
        if (!moved && f.state === "walk") f.state = f.crouch ? "crouch" : "idle";
        if (!moved && !f.crouch && f.state === "crouch") f.state = "idle";
        if (moved && Math.random() < 0.1) T.FXlib.dust(fx, f.x - f.facing * 0.2, f.facing, 0.3);
      }
      if ((U || io.tapU) && f.y === 0 && !BUSY.includes(f.state)) {
        f.vy = 6.2; f.y = 0.01; f.state = "jump";
        if (R && !L) f.vx = 2.8;
        else if (L && !R) f.vx = -2.8;
        else f.vx = 0;
        sfx("jump");
        T.FXlib.dust(fx, f.x, f.facing, 0.7);
      }
    }
    f.dashCdT = Math.max(0, f.dashCdT - dtMove);
  }

  function readInput(f, map) {
    driveInput(f, {
      L: KEY[map.l] || KEY[map.lU],
      R: KEY[map.r] || KEY[map.rU],
      U: KEY[map.u] || KEY[map.uU],
      D: KEY[map.d] || KEY[map.dU],
      tapL: PRESSED[map.l] || PRESSED[map.lU],
      tapR: PRESSED[map.r] || PRESSED[map.rU],
      tapU: PRESSED[map.u] || PRESSED[map.uU] || PRESSED[" "] || PRESSED.Space,
      lp: hitKey(map.p), lk: hitKey(map.k), hp: hitKey(map.hp), hk: hitKey(map.hk),
      sp: hitKey(map.s), su: hitKey(map.x),
      holdHp: holdKey(map.hp), holdHk: holdKey(map.hk),
    });
  }

  function packBits(map) {
    let b = 0;
    if (KEY[map.l] || KEY[map.lU]) b |= 1;
    if (KEY[map.r] || KEY[map.rU]) b |= 2;
    if (KEY[map.d] || KEY[map.dU]) b |= 4;
    if (KEY[map.u] || KEY[map.uU]) b |= 8;
    if (hitKey(map.p)) b |= 16;
    if (hitKey(map.k)) b |= 32;
    if (hitKey(map.hp)) b |= 64;
    if (hitKey(map.hk)) b |= 128;
    if (hitKey(map.s)) b |= 256;
    if (hitKey(map.x)) b |= 512;
    if (PRESSED[map.l] || PRESSED[map.lU]) b |= 1024;
    if (PRESSED[map.r] || PRESSED[map.rU]) b |= 2048;
    if (PRESSED[map.u] || PRESSED[map.uU] || PRESSED[" "] || PRESSED.Space) b |= 4096;
    return b;
  }

  function applyBits(f, bits) {
    driveInput(f, {
      L: bits & 1, R: bits & 2, D: bits & 4, U: bits & 8,
      tapL: bits & 1024, tapR: bits & 2048, tapU: bits & 4096,
      lp: bits & 16, lk: bits & 32, hp: bits & 64, hk: bits & 128, sp: bits & 256, su: bits & 512,
    });
  }

  function packF(f) {
    return {
      x: +f.x.toFixed(3), y: +f.y.toFixed(3), vx: +(f.vx || 0).toFixed(2), vy: +(f.vy || 0).toFixed(2),
      facing: f.facing, hp: f.hp, meter: Math.round(f.meter),
      state: f.state, stateT: +f.stateT.toFixed(3), atkKey: f.atkKey,
      crouch: !!f.crouch, blocking: !!f.blocking, kvx: +(f.kvx || 0).toFixed(2), combo: f.combo || 0,
    };
  }

  function applyF(f, s) {
    if (!s) return;
    const prevKey = f.atkKey, prevState = f.state;
    f.x = s.x; f.y = s.y; f.vx = s.vx; f.vy = s.vy;
    f.facing = s.facing; f.hp = s.hp; f.meter = s.meter;
    f.crouch = s.crouch; f.blocking = s.blocking; f.kvx = s.kvx; f.combo = s.combo;
    f.state = s.state; f.stateT = s.stateT; f.atkKey = s.atkKey;
    f.atk = s.atkKey ? MOVES[f.id][s.atkKey] : null;
    if (s.state !== prevState || s.atkKey !== prevKey) {
      const an = animOf(f);
      if (s.atkKey) {
        const mv = f.atk;
        const dur = mv ? mv.startup + mv.active + mv.rec : 0.4;
        an.play(s.atkKey, T.clipFor(f.id, s.atkKey), dur);
      } else if (s.state === "hurt") an.play("hurt", T.COMMON.hurt, 0.32);
      else if (s.state === "ko") an.play("ko", T.COMMON.ko, 1.6, true);
      else if (s.state === "win") an.play("win", T.COMMON.win, 2.4, true);
      else if (s.state === "block") an.play("block", T.COMMON.block, 3);
      else an.stopClip();
    }
  }

  function applySnap(s) {
    applyF(p1, s.a);
    applyF(p2, s.b);
    timer = s.tm;
    introT = s.in;
    syncGhostBolts(s.bl || []);
    updateCombo();
  }

  function hitKey(def) {
    if (!def) return false;
    const keys = Array.isArray(def) ? def : [def];
    for (let i = 0; i < keys.length; i++) if (PRESSED[keys[i]]) return true;
    return false;
  }
  function holdKey(def) {
    if (!def) return false;
    const keys = Array.isArray(def) ? def : [def];
    for (let i = 0; i < keys.length; i++) if (KEY[keys[i]]) return true;
    return false;
  }
  const MAP1 = {
    l: "a", lU: "A", r: "d", rU: "D", u: "w", uU: "W", d: "s", dU: "S",
    p: ["j", "J", "KeyJ"], k: ["k", "K", "KeyK"],
    hp: ["u", "U", "KeyU"], hk: ["i", "I", "KeyI"],
    s: ["l", "L", "KeyL"], x: ["o", "O", "KeyO", "p", "P", "KeyP"],
  };
  const MAP2 = {
    l: "ArrowLeft", r: "ArrowRight", u: "ArrowUp", d: "ArrowDown",
    p: "1", k: "2", hp: "7", hk: "8", s: "3", x: "4",
  };

  /* ---------------- CPU ---------------- */
  function cpuThink(dt) {
    const f = p2, o = p1;
    if (!f.cpu || f.state === "ko" || f.state === "win" || roundOver) return;
    f.cpu.t -= dt;
    const dist = Math.abs(o.x - f.x);
    const dir = Math.sign(o.x - f.x) || 1;
    f.input.left = false; f.input.right = false; f.blocking = false;
    if (BUSY.includes(f.state) || f.state === "hurt" || f.state === "block") return;

    const incoming = (o.atk && !o.atk.proj && dist < o.atk.range + 0.6) ||
      waves.some(function (w) { return w.owner === o && Math.abs(w.x - f.x) < 2.4; }) ||
      bolts.some(function (b) { return b.owner === o && !b.hit && Math.abs(b.x - f.x) < 2.6; });
    if (incoming && Math.random() < 0.55 * f.cpu.skill) {
      f.blocking = true;
      f.cpu.move = -dir;
    }

    if (f.cpu.t <= 0) {
      f.cpu.t = 0.11 + Math.random() * 0.19;
      const r = Math.random();
      if (dist > 2.3) {
        f.cpu.move = dir;
        if (r < 0.09 && f.y === 0) { f.vy = 5.8; f.y = 0.01; f.state = "jump"; sfx("jump"); }
        if (r > 0.94 && f.dashCdT <= 0) {
          f.state = "dash"; f.dashT = 0.18; f.vx = dir * 6.8; f.dashCdT = 0.8;
          animOf(f).play("dash", T.COMMON.dash, 0.3);
          sfx("dash");
        }
      } else if (dist < 2) {
        f.cpu.move = 0;
        if (f.meter >= 100 && r < 0.16 * f.cpu.skill) startAtk(f, "ultra3");
        else if (f.meter >= 50 && r < 0.12 * f.cpu.skill) startAtk(f, r < 0.5 ? "ultra1" : "ultra2");
        else if (f.meter >= 50 && r < 0.22 * f.cpu.skill) startAtk(f, "super");
        else if (r < 0.28) startAtk(f, "lp");
        else if (r < 0.42) startAtk(f, "hk");
        else if (r < 0.52) startAtk(f, "skill");
        else if (r < 0.6) startAtk(f, "skill2");
        else if (r < 0.7 && dist < 1.0) startAtk(f, "throw");
        else if (r < 0.78) f.cpu.move = -dir;
      } else {
        f.cpu.move = r < 0.72 ? dir : 0;
      }
      if (f.connected && f.atk && f.atk.cancel && f.atk.cancel.length && Math.random() < 0.8) {
        const cxl = f.atk.cancel;
        const pick = f.meter >= 50 && Math.random() < 0.35 ? "super" : cxl[Math.min(cxl.length - 1, 2)];
        startAtk(f, pick);
      }
    }
    if (f.cpu.move && !BUSY.includes(f.state) && f.state !== "block" && f.state !== "hurt") {
      f.x += f.cpu.move * 2.2 * dtMove;
      if (f.y === 0 && f.state !== "walk") f.state = "walk";
      if (Math.random() < 0.06) T.FXlib.dust(fx, f.x - f.cpu.move * 0.2, f.cpu.move, 0.3);
    } else if (!f.cpu.move && f.state === "walk") f.state = "idle";
  }

  /* ============================================================
     回合流程
     ============================================================ */
  function charMeta(id) {
    return id === "meishu"
      ? { id: "meishu", name: "美鼠", sub: "MEISHU · 弹性系" }
      : { id: "naiwa", name: "奶龙", sub: "NAILONG · 凝胶龙系" };
  }
  function applyPickPortraits() {
    const c1 = charMeta(pickP1), c2 = charMeta(pickP2);
    if ($("sel-p1-name")) $("sel-p1-name").textContent = c1.name;
    if ($("sel-p1-sub")) $("sel-p1-sub").textContent = c1.sub;
    if ($("sel-p2-name")) $("sel-p2-name").textContent = c2.name;
    if ($("sel-p2-sub")) $("sel-p2-sub").textContent = c2.sub;
    const mark = function (id, ch) {
      const el = $(id);
      if (!el) return;
      el.classList.toggle("meishu", ch === "meishu");
      const img = el.querySelector("img");
      if (img) img.src = ch === "meishu" ? PORTRAIT.meishu : PORTRAIT.naiwa;
    };
    mark("hud-p1-av", pickP1);
    mark("hud-p2-av", pickP2);
    const setImg = function (id, ch) {
      const el = $(id);
      if (el) el.src = ch === "meishu" ? PORTRAIT.meishu : PORTRAIT.naiwa;
    };
    setImg("sel-p1-img", pickP1);
    setImg("sel-p2-img", pickP2);
    setImg("vs-p1-img", pickP1);
    setImg("vs-p2-img", pickP2);
  }
  function bindFightModels() {
    if (naiwaModel && meishuModel) {
      if (pickP1 === pickP2) pickP2 = pickP1 === "naiwa" ? "meishu" : "naiwa";
      m1 = pickP1 === "meishu" ? meishuModel : naiwaModel;
      m2 = pickP2 === "meishu" ? meishuModel : naiwaModel;
    }
  }
  function resetRound() {
    const keepW = wins.slice();
    bindFightModels();
    const c1 = charMeta(pickP1), c2 = charMeta(pickP2);
    p1 = makeFighter(c1.id, c1.name, -1.9, 1);
    p2 = makeFighter(c2.id, c2.name, 1.9, -1);
    p2.cpu = { t: 0.35, move: 0, skill: cpuDiff };
    a1 = new T.FighterAnim(m1);
    a2 = new T.FighterAnim(m2);
    timer = 99; timerAcc = 0;
    roundOver = false;
    slowmo = 1; hitstopT = 0; shakeT = 0; trauma = 0; fovKick = 0;
    if (T.Cinema) T.Cinema.stop();
    hpNow = [100, 100]; hpGhost = [100, 100]; hpDelay = [0, 0];
    for (let i = waves.length - 1; i >= 0; i--) { scene.remove(waves[i].grp); waves.splice(i, 1); }
    clearBolts();
    if (fx) fx.clear();
    wins = keepW;
    $("ko-banner").classList.add("hidden");
    $("skill-p1").textContent = "";
    $("skill-p2").textContent = "";
    $("combo").innerHTML = "";
    if ($("hud-p1-name")) $("hud-p1-name").textContent = "P1 " + c1.name;
    if ($("hud-p2-name")) {
      const tag = netPlay ? (net && net.role === "guest" ? " 本机" : " 联机") : (vsCpu ? " CPU" : " 2P");
      $("hud-p2-name").textContent = c2.name + tag;
    }
    if ($("vs-p1-name")) $("vs-p1-name").textContent = c1.name;
    if ($("vs-p1-sub")) $("vs-p1-sub").textContent = c1.sub;
    if ($("vs-p2-name")) $("vs-p2-name").textContent = c2.name;
    if ($("vs-p2-sub")) $("vs-p2-sub").textContent = c2.sub;
    applyPickPortraits();
    updateHud();
  }

  function endRound(winner) {
    if (roundOver) return;
    roundOver = true;
    const idx = winner === p1 ? 0 : 1;
    wins[idx] += 1;
    renderWinStars();
    sfx("win");
    setTimeout(function () {
      slowmo = 1;
      if (wins[idx] >= 2) showMatchEnd(winner);
      else showRoundEnd(winner);
    }, 1900);
  }

  /* ---------- 结算画面内容装配 ---------- */
  const PORTRAIT = { naiwa: "assets/naiwa-portrait.jpg?v=p2", meishu: "assets/meishu-portrait.jpg?v=p2" };
  function titleSpans(el, text) {
    el.innerHTML = "";
    for (let i = 0; i < text.length; i++) {
      const s = document.createElement("span");
      s.textContent = text[i];
      s.style.animationDelay = (0.06 * i + 0.1).toFixed(2) + "s";
      el.appendChild(s);
    }
  }
  function setResult(mode, winner) {
    const banner = $("ko-banner");
    if (!banner) return;
    const isFinal = mode === "final";
    banner.classList.remove("hidden");
    banner.classList.toggle("final", isFinal);
    if (T.SFX) T.SFX.music("result");
    /* 重启动画 */
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
    const heroImg = $("rb-hero-img");
    if (heroImg) heroImg.src = PORTRAIT[winner.id] || PORTRAIT.naiwa;
    const heroTag = $("rb-hero-tag");
    if (heroTag) {
      heroTag.textContent = isFinal ? "CHAMPION" : "WINNER";
      heroTag.classList.toggle("champ", isFinal);
    }
    const kick = $("rb-kicker");
    if (kick) kick.textContent = isFinal ? "FINAL ROUND · MATCH RESULT" : ("ROUND " + round + " · RESULT");
    titleSpans($("ko-title"), isFinal ? "VICTORY" : "K.O.");
    $("rb-hint").textContent = isFinal
      ? (winner === p1 ? "漂亮的终结！再来一场保持连胜。" : "虽败犹荣，下一场翻盘！")
      : (winner === p1 ? "领先一步，拿下赛点！" : "稳住，下一回合找回来。");
    /* 回合宝石逐颗点亮（左 P1 / 右 P2） */
    const gems = $("rb-gems");
    if (gems) {
      const its = gems.querySelectorAll("i");
      gems.classList.toggle("p1win", winner === p1);
      for (let i = 0; i < its.length; i++) {
        const isP1 = i < 2;
        const lit = isP1 ? i < wins[0] : (i - 2) < wins[1];
        its[i].classList.toggle("lit", lit);
      }
    }
    /* 终局金色粒子雨 */
    const cf = $("rb-confetti");
    if (cf) {
      cf.innerHTML = "";
      if (isFinal) {
        for (let i = 0; i < 44; i++) {
          const p = document.createElement("i");
          p.style.left = (Math.random() * 100).toFixed(1) + "%";
          p.style.animationDuration = (2.6 + Math.random() * 2.6).toFixed(2) + "s";
          p.style.animationDelay = (Math.random() * 2.4).toFixed(2) + "s";
          p.style.transform = "scale(" + (0.65 + Math.random() * 0.9).toFixed(2) + ")";
          cf.appendChild(p);
        }
      }
    }
  }

  function showRoundEnd(winner) {
    $("ko-sub").textContent = winner.name + " 拿下第 " + round + " 回合";
    $("btn-again").textContent = "下一回合";
    $("btn-again").onclick = function () { round += 1; startRoundIntro(); };
    setResult("round", winner);
  }

  function showMatchEnd(winner) {
    $("ko-sub").textContent = winner.name + " 获胜 · 比分 " + wins[0] + " : " + wins[1];
    $("btn-again").textContent = "再战一场";
    $("btn-again").onclick = function () {
      round = 1; wins = [0, 0]; renderWinStars(); startRoundIntro();
    };
    recordMatchEnd(winner, winner === p1 ? p2 : p1);
    setResult("final", winner);
  }

  function startRoundIntro() {
    if (naiwaModel && naiwaModel.root) naiwaModel.root.visible = true;
    if (meishuModel && meishuModel.root) meishuModel.root.visible = true;
    $("ko-banner").classList.add("hidden");
    state = "vs";
    show("screen-vs");
    const vsEl = $("screen-vs");
    const st = T.stageById && T.stageById(pickStage);
    if (vsEl && st) vsEl.style.backgroundImage = "url(" + st.pano + ")";
    $("vs-round").textContent = "ROUND " + round;
    resetRound();
    renderWinStars();
    setTimeout(function () {
      show("screen-fight");
      state = "fight";
      introT = 2.1;
      paused = false;
      document.body.classList.remove("is-paused");
      const pui = $("pause-ui");
      if (pui) pui.classList.add("hidden");
      matchMaxCombo = 0;
      replayBuf.length = 0;
      stopReplay();
      /* 训练面板显隐 */
      const tp = $("train-panel");
      if (tp) tp.classList.toggle("hidden", !trainMode);
      /* 回合开场长镜头：高机位横移推近再落回格斗机位 */
      if (T.Cinema) T.Cinema.playIntro({ get x() { return (p1.x + p2.x) / 2; }, y: 0 });
      sfx("bell");
      announce("ROUND " + round, 1);
    }, 1500);
  }

  function renderWinStars() {
    [["stars-p1", 0], ["stars-p2", 1]].forEach(function (pair) {
      const el = $(pair[0]);
      el.innerHTML = "";
      for (let s = 0; s < 2; s++) {
        const d = document.createElement("i");
        if (s < wins[pair[1]]) d.className = "on";
        el.appendChild(d);
      }
    });
  }

  /* ---------------- HUD：街霸式 即时白条 + 延迟残血消退 ---------------- */
  let hpNow = [100, 100], hpGhost = [100, 100], hpDelay = [0, 0];
  function updateHud(dt) {
    dt = dt || 0;
    const list = [p1, p2];
    for (let i = 0; i < 2; i++) {
      const hp = Math.max(0, list[i].hp);
      if (hp < hpNow[i] - 0.05) {
        hpDelay[i] = 0.4;
        hpNow[i] = hp;
      } else {
        hpNow[i] = hp;
        if (hp > hpGhost[i]) hpGhost[i] = hp;
      }
      if (hpDelay[i] > 0) hpDelay[i] -= dt;
      else if (hpGhost[i] > hpNow[i]) hpGhost[i] = Math.max(hpNow[i], hpGhost[i] - dt * 155);
      else hpGhost[i] = hpNow[i];
    }
    $("hp-p1").style.width = Math.max(0, hpNow[0]) + "%";
    $("hp-p2").style.width = Math.max(0, hpNow[1]) + "%";
    $("hg-p1").style.width = Math.max(0, hpGhost[0]) + "%";
    $("hg-p2").style.width = Math.max(0, hpGhost[1]) + "%";
    $("hp-p1").classList.toggle("danger", hpNow[0] <= 25);
    $("hp-p2").classList.toggle("danger", hpNow[1] <= 25);
    const av1 = $("hud-p1-av"), av2 = $("hud-p2-av");
    if (av1) av1.classList.toggle("danger", hpNow[0] <= 25);
    if (av2) av2.classList.toggle("danger", hpNow[1] <= 25);
    $("mt-p1").style.width = p1.meter + "%";
    $("mt-p2").style.width = p2.meter + "%";
    $("mt-p1").classList.toggle("ready", p1.meter >= 50);
    $("mt-p2").classList.toggle("ready", p2.meter >= 50);
    if (av1) av1.classList.toggle("ready", p1.meter >= 50);
    if (av2) av2.classList.toggle("ready", p2.meter >= 50);
    const superBtn = $("btn-super");
    if (superBtn) superBtn.classList.toggle("ready", p1.meter >= 50);
    var tv = String(Math.max(0, Math.ceil(timer)));
    $("timer").textContent = ("00" + tv).slice(-2);
    $("timer").classList.toggle("low", timer <= 10);
    /* 残局紧张感：任一方残血 → BGM 低通收窄 */
    if (T.SFX) T.SFX.tension(Math.min(p1.hp, p2.hp) <= 25 ? 0.92 : 0);
  }

  /* ============================================================
     主循环
     ============================================================ */
  function canTurn(f) {
    if (f.state === "hurt" || f.state === "ko" || f.state === "win") return false;
    if (f.y > 0.04 || f.state === "jump" || f.state === "idle" || f.state === "walk" || f.state === "dash") return true;
    return !BUSY.includes(f.state);
  }
  /* 以双方 x 为准：谁在左边就朝右。越过对手（含跳跃落地）立刻改 facing 并瞬间转身。 */
  function syncFacing(f, o) {
    if (!f || !o) return;
    if (f.state === "hurt" || f.state === "ko" || f.state === "win") return;
    const dx = o.x - f.x;
    if (Math.abs(dx) < 0.05) return;
    const next = dx > 0 ? 1 : -1;
    if (f.facing === next) return;
    f.facing = next;
    f.viewYaw = yawOf(f, next);
  }
  function faceOpponent(f, o) { syncFacing(f, o); }
  function tickViewYaw(f) {
    const target = yawOf(f, f.facing);
    if (f.viewYaw == null || !isFinite(f.viewYaw)) f.viewYaw = target;
    if (!isFinite(target)) return;
    let d = target - f.viewYaw;
    if (!isFinite(d)) return;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) > 0.5) {
      f.viewYaw = target;
      return;
    }
    f.viewYaw += d * 0.28;
  }

  let loopActive = false;
  function loop() {
    if (loopActive) return;
    loopActive = true;
    requestAnimationFrame(loop);
    if (!renderer || !clock) return;
    const gl = renderer.getContext && renderer.getContext();
    if (gl && gl.isContextLost && gl.isContextLost()) return;
    try {
    if (SHOT && window.__shotReady && !window.__shotDone) {
      window.__shotFrames = (window.__shotFrames || 0) + 1;
      if (window.__shotFrames > 10) {
        window.__shotDone = true;
        document.title = "SHOT";
      }
    }
    const raw = Math.min(0.033, clock.getDelta());
    elapsed += raw;
    /* ---- 系统服务层：音频调度 / 自适应画质 / 性能面板 ---- */
    if (T.SFX) { T.SFX.frame(); T.SFX.tick(); }
    if (T.QUALITY) T.QUALITY.tick(raw);
    if (T.PERF) T.PERF.tick(raw, renderer);
    /* 主菜单看板：灯组强度渐变开关（不触发着色器重编译），氛围粒子推进 */
    const menuLike = state === "boot" || state === "title" || state === "online" || state === "help" || state === "select";
    if (menuKey) {
      menuGlow = Math.max(0, menuGlow - raw * 1.6);
      menuLightK += ((menuLike ? 1 : 0) - menuLightK) * (1 - Math.exp(-(menuLightK < menuLike ? 30 : 4) * raw));
      menuKey.intensity = (4.6 + Math.sin(elapsed * 0.9) * 0.5 + menuGlow * 2.4) * menuLightK;
      menuRim.intensity = (3.6 + Math.sin(elapsed * 0.7 + 2) * 0.5 + menuGlow * 1.6) * menuLightK;
      menuFill.intensity = 1.1 * menuLightK;
      menuBounce.intensity = 1.5 * menuLightK;
      menuRig.visible = menuLike && menuLightK > 0.03;
      if (menuRig.visible) stepMenuAmbience(raw, elapsed);
    }
    const frozen = hitstopT > 0;
    dtMove = frozen ? 0 : raw * slowmo;
    const dt = frozen ? 0 : raw * slowmo;
    hitstopT = Math.max(0, hitstopT - raw);
    if (slowmo < 1) slowmo = Math.min(1, slowmo + raw * 0.55);

    /* 鉴赏 3D：独立渲染分支（拖拽旋转 + 招式演示） */
    if (state === "gallery" && modelsReady) {
      renderGallery(raw);
      return;
    }

    if (state === "boot" || state === "title" || state === "gallery" || state === "online" || state === "help" || state === "select") {
      if (a1 && p1) a1.update(raw, elapsed, p1);
      if (a2 && p2) a2.update(raw, elapsed, p2);
      if (state === "select" && naiwaModel && meishuModel) {
        const left = pickP1 === "meishu" ? meishuModel : naiwaModel;
        const right = pickP2 === "meishu" ? meishuModel : naiwaModel;
        if (naiwaModel.root) naiwaModel.root.visible = true;
        if (meishuModel.root) meishuModel.root.visible = true;
        left.root.position.set(-1.45, 0.02, 0);
        right.root.position.set(1.45, 0.02, 0);
        left.root.rotation.set(0, modelPoseYaw(left, 0.46), 0);
        right.root.rotation.set(0, modelPoseYaw(right, -0.46), 0);
        if (menuBlobs) {
          menuBlobs[0].position.set(-1.45, 0.021, 0);
          menuBlobs[1].position.set(1.45, 0.021, 0);
        }
        const sway = Math.sin(elapsed * 0.18) * 0.1;
        camera.position.set(sway, 1.34, 5.05);
        camera.lookAt(0, 0.88, 0);
      } else {
        const nm = naiwaModel || m1;
        const mm = meishuModel || m2;
        if (nm && nm.root) {
          nm.root.visible = true;
          nm.root.position.set(1.42, 0.02, -0.32);
          nm.root.rotation.set(0, modelPoseYaw(nm, 0.42 + Math.sin(elapsed * 0.3) * 0.045), 0);
        }
        if (mm && mm.root) {
          mm.root.visible = true;
          mm.root.position.set(2.12, 0.02, 0.18);
          mm.root.rotation.set(0, modelPoseYaw(mm, -0.5 + Math.sin(elapsed * 0.24 + 2) * 0.05), 0);
        }
        if (menuBlobs) {
          menuBlobs[0].position.set(1.42, 0.021, -0.32);
          menuBlobs[1].position.set(2.12, 0.021, 0.18);
          menuBlobs[0].visible = !!(naiwaModel && naiwaModel.root);
          menuBlobs[1].visible = !!(meishuModel && meishuModel.root);
        }
        /* 环绕运镜：以双人为中心的缓慢弧线 + 呼吸推拉 + 微滚动 */
        const mAz = 0.12 + Math.sin(elapsed * 0.1) * 0.17;
        const mRad = 3.62 + Math.sin(elapsed * 0.067) * 0.2;
        camera.position.set(
          1.78 + Math.sin(mAz) * mRad,
          1.06 + Math.sin(elapsed * 0.13 + 1.2) * 0.13,
          Math.cos(mAz) * mRad
        );
        camera.lookAt(1.74 + Math.sin(elapsed * 0.045) * 0.1, 0.72, 0);
        camera.rotation.z += Math.sin(elapsed * 0.085) * 0.009;
        camera.fov = (state === "boot" ? 44 : 40) + Math.sin(elapsed * 0.06) * 1.4;
        camera.updateProjectionMatrix();
        renderer.toneMappingExposure = state === "boot" ? 1.3 : 1.14;
      }
      if (arena) arena.update(elapsed, null);
      if (fx) fx.update(raw * 0.4);
      renderFrame();
      clearPressed();
      return;
    }

    if (state === "fight") {
      /* ---- 暂停：画面定帧，背景微动，UI 压屏 ---- */
      if (paused) {
        a1.update(0, elapsed, p1);
        a2.update(0, elapsed, p2);
        if (arena) arena.update(elapsed, null);
        if (fx) fx.update(raw * 0.2);
        camera.lookAt(camera.position.x, 0.92, 0);
        renderFrame();
        clearPressed();
        return;
      }
      /* ---- KO 终结回放：覆盖正常模拟逐帧重演 ---- */
      if (replaying) {
        if (stepReplay(raw)) {
          const rdt = raw * 0.72;
          a1.update(rdt, elapsed, p1);
          a2.update(rdt, elapsed, p2);
          a1.applyRoot(p1, p1.viewYaw);
          a2.applyRoot(p2, p2.viewYaw);
          updateLimbs(p1); updateLimbs(p2);
          if (fx) fx.update(rdt);
          if (arena) arena.update(elapsed, null);
          renderFrame();
          clearPressed();
          return;
        }
      }
      const locked = introT > 0;
      if (locked) {
        introT -= raw;
        if (introT <= 1.05 && !window.__fightCalled) {
          window.__fightCalled = true;
          announce("FIGHT!", 0.8, "fight-call");
          sfx("bell");
        }
      } else {
        window.__fightCalled = false;
        if (netPlay && net && net.role === "guest") {
          net.send({ t: "in", b: packBits(MAP1) });
        } else {
          if (T.__holdKeys) {
            for (const k in KEY) KEY[k] = false;
            for (const k in T.__holdKeys) KEY[k] = !!T.__holdKeys[k];
          }
          readInput(p1, MAP1);
          if (trainMode) tickTrain();
          if (netPlay && net && net.role === "host") {
            applyBits(p2, remoteBits);
            remoteBits &= 15;
          } else if (trainMode) {
            trainCpuThink(raw * slowmo);
          } else if (vsCpu) cpuThink(raw * slowmo);
          else readInput(p2, MAP2);
        }
      }
      if (netPlay && net && net.role === "guest") {
        if (lastSnap) applySnap(lastSnap);
      } else {
        tickFighter(p1, dt);
        tickFighter(p2, dt);
        tryHits(p1, p2);
        tryHits(p2, p1);
        updateWaves(dt);
        updateBolts(dt);
        if (!netPlay && !trainMode) packReplay();
        if (netPlay && net && net.role === "host" && net.ready) {
          snapAcc += raw;
          if (snapAcc > 0.05) {
            snapAcc = 0;
            net.send({
              t: "snap", a: packF(p1), b: packF(p2), tm: timer, in: introT,
              bl: bolts.map(function (b) { return { id: b.id, k: b.kind, x: +b.x.toFixed(3), y: +b.y.toFixed(3), d: b.dir }; }),
            });
          }
        }
      if (!(netPlay && net && net.role === "guest")) {
        // 只在双方都贴地时挤开。跳起高度刚过 1，空中还挤就会把人弹回去，跳不过去。
        if (p1.y < 0.12 && p2.y < 0.12 && Math.abs(p1.x - p2.x) < 0.74) {
          const mid = (p1.x + p2.x) / 2;
          const s = Math.sign(p2.x - p1.x) || 1;
          p1.x = mid - 0.37 * s;
          p2.x = mid + 0.37 * s;
        }
        syncFacing(p1, p2);
        syncFacing(p2, p1);
        if (!roundOver && introT <= 0 && !trainMode) {
          timerAcc += dt;
          if (timerAcc >= 1) {
            timerAcc = 0;
            timer -= 1;
            if (timer <= 0) {
              const w = p1.hp >= p2.hp ? p1 : p2;
              const l = w === p1 ? p2 : p1;
              announce("TIME UP", 1.4, "ko-call");
              l.state = "ko"; animOf(l).play("ko", T.COMMON.ko, 1.6, true);
              w.state = "win"; animOf(w).play("win", T.COMMON.win, 2.4, true);
              endRound(w);
            }
          }
        }
      }
      }
      a1.update(dt, elapsed, p1);
      a2.update(dt, elapsed, p2);
      tickViewYaw(p1);
      tickViewYaw(p2);
      a1.applyRoot(p1, p1.viewYaw);
      a2.applyRoot(p2, p2.viewYaw);
      updateLimbs(p1);
      updateLimbs(p2);
      const showSkill = function (k) {
        return k === "skill" || k === "skill2" || k === "super" || k === "ultra1" || k === "ultra2" || k === "ultra3";
      };
      $("skill-p1").textContent = p1.atk && showSkill(p1.atkKey) ? p1.atk.name : "";
      $("skill-p2").textContent = p2.atk && showSkill(p2.atkKey) ? p2.atk.name : "";

      // 相机：拳皇式跟随两人中点，拉远看全场，两端锁在墙内
      const mid = (p1.x + p2.x) / 2;
      const gap = Math.abs(p1.x - p2.x);
      const camZ = clamp(5.15 + gap * 0.28, 5.15, 7.2) - camPunch;
      camPunch = Math.max(0, camPunch - raw * 1.6);
      const vis = camZ * Math.tan((camera.fov * 0.5) * Math.PI / 180) * camera.aspect;
      const camLimit = Math.max(0.35, T.STAGE_HALF - vis * 0.92);
      const camX = clamp(mid, -camLimit, camLimit);
      camera.position.x += (camX - camera.position.x) * 0.16;
      camera.position.y += (1.38 - camera.position.y) * 0.1;
      camera.position.z += (camZ - camera.position.z) * (camPunch > 0.02 ? 0.42 : 0.08);
      /* Trauma 震屏：trauma² 曲线（小事件几乎不动、大事件猛甩），线性衰减，
         噪声由累积游戏时间驱动，帧率无关；强度受设置项缩放 */
      trauma = Math.max(0, trauma - TRAUMA_DECAY * raw);
      if (trauma > 0.001) {
        const shk = (T.Settings ? T.Settings.data.fxShake / 100 : 1);
        const s = trauma * trauma * shk;
        camera.position.x += pseudoNoise(elapsed * 34, 1) * MAX_OFFSET * s;
        camera.position.y += pseudoNoise(elapsed * 34, 2) * MAX_OFFSET * s * 0.72;
        camera.rotation.z = pseudoNoise(elapsed * 26, 3) * MAX_ROLL * s;
      } else camera.rotation.z += (0 - camera.rotation.z) * 0.2;
      camera.lookAt(camera.position.x, 0.92, 0);
      if (arena && arena.pano) arena.pano.position.x = camera.position.x * 0.06;
      if (arena && arena.mid) arena.mid.position.x = camera.position.x * 0.38;
      /* CG 演出运镜接管 / 回落（激活时覆盖上面算好的机位） */
      if (T.Cinema) T.Cinema.apply(camera, raw, elapsed);
      /* FOV 冲击：命中推 FOV + 指数回弹（此前从未真正应用到相机） */
      if (!(T.Cinema && T.Cinema.holdsFov())) {
        fovKick *= Math.exp(-raw * 6.2);
        if (fovKick < 0.01) fovKick = 0;
        camera.fov = 40 + fovKick;
        camera.updateProjectionMatrix();
      }
      updateHud(raw);
      if (announceT > 0) {
        announceT -= raw;
        if (announceT <= 0) $("announce").textContent = "";
      }
    } else {
      a1.update(raw, elapsed, p1);
      a2.update(raw, elapsed, p2);
      a1.applyRoot(p1, yawOf(p1, 1));
      a2.applyRoot(p2, yawOf(p2, -1));
      updateLimbs(p1);
      updateLimbs(p2);
    }

    if (fx) fx.update(dt || raw * 0.25);
    updateDamageNumbers(raw);
    if (arena) arena.update(elapsed, state === "fight" ? [p1, p2] : null);
    if (flashT > 0) {
      flashT -= raw;
      const el = $("flash");
      if (el) {
        el.style.background = flashColor;
        el.style.opacity = String(Math.max(0, Math.min(0.85, flashT * 3.2)));
      }
    }
    renderFrame();
    /* KO 定帧截图 → 战绩册（同任务同步读取，通常可取到画布内容） */
    if (wantShot && T.Stats) {
      wantShot = false;
      try { T.Stats.shot(renderer.domElement.toDataURL("image/jpeg", 0.5)); } catch (e) {}
    }
    clearPressed();
    } catch (e) {
      console.error("[NV loop]", e);
      try { if (renderer && scene && camera) renderFrame(); } catch (_) {}
    }
  }
  function clearPressed() { for (const k in PRESSED) PRESSED[k] = false; }

  /* ============================================================
     暂停 / 训练模式 / KO 终结回放 / 战绩钩子
     ============================================================ */
  function togglePause() {
    if (state !== "fight") return;
    if (netPlay) { if (T.toast) T.toast("联机对局无法暂停", "warn"); return; }
    paused = !paused;
    document.body.classList.toggle("is-paused", paused);
    const ui = $("pause-ui");
    if (ui) ui.classList.toggle("hidden", !paused);
    if (paused) { for (const k in KEY) KEY[k] = false; if (T.SFX) T.SFX.duck(true); }
    else { if (T.SFX) T.SFX.duck(false); clearPressed(); }
    sfx("select");
  }

  /* ---------- 训练模式 ---------- */
  const TRAIN_KEYS = [];
  (function () {
    const defs = [["←", [MAP1.l, MAP1.lU]], ["→", [MAP1.r, MAP1.rU]], ["↓", [MAP1.d, MAP1.dU]], ["↑", [MAP1.u, MAP1.uU]],
      ["J", MAP1.p], ["K", MAP1.k], ["U", MAP1.hp], ["I", MAP1.hk], ["L", MAP1.s], ["O", MAP1.x]];
    defs.forEach(function (d) {
      const keys = Array.isArray(d[1]) ? d[1] : [d[1]];
      TRAIN_KEYS.push({ tok: d[0], keys: keys, on: false, dir: d[0].length === 1 && d[0].charCodeAt(0) > 0x2000 });
    });
  })();
  function tickTrain() {
    p1.meter = 100;
    if (PRESSED["r"] || PRESSED["R"] || PRESSED["KeyR"]) trainReset();
    /* 输入历史：边沿检测 */
    let changed = false;
    for (let i = 0; i < TRAIN_KEYS.length; i++) {
      const h = TRAIN_KEYS[i];
      let now = false;
      for (let j = 0; j < h.keys.length; j++) if (KEY[h.keys[j]]) { now = true; break; }
      if (now && !h.on) { inputHist.push(h.tok); if (inputHist.length > 12) inputHist.shift(); changed = true; }
      h.on = now;
    }
    /* 连段统计 */
    if (p1.combo === 0 && trainLastCombo > 0) {
      trainLastCombo = 0;
      updateTrainPanel(true);
    } else if (p1.combo > 0 && changed) updateTrainPanel(false);
    else if (changed) updateTrainPanel(false);
  }
  function trainReset() {
    p1.hp = 100; p2.hp = 100; p1.x = -1.9; p2.x = 1.9;
    p1.y = p2.y = 0; p1.vy = p2.vy = 0; p1.kvx = p2.kvx = 0;
    p1.state = p2.state = "idle"; p1.atk = p2.atk = null;
    p1.combo = p2.combo = 0;
    animOf(p1).stopClip(); animOf(p2).stopClip();
    clearBolts();
    inputHist.length = 0;
    trainComboDmg = 0; trainLastCombo = 0;
    updateTrainPanel(true);
    sfx("select");
  }
  function trainCpuThink(dt) {
    const f = p2, o = p1;
    f.input.left = false; f.input.right = false;
    if (f.state === "ko" || f.state === "hurt" || f.state === "win") return;
    if (trainCpu === "idle") { f.blocking = false; f.cpu.move = 0; return; }
    if (trainCpu === "guard") { f.blocking = Math.abs(o.x - f.x) < 3.4; f.cpu.move = 0; return; }
    cpuThink(dt);
  }
  let trainBest = { hits: 0, dmg: 0 };
  function updateTrainPanel(freeze) {
    const el = $("train-panel");
    if (!el) return;
    if (p1.combo === 0 && trainLastCombo > 0 && !freeze) {
      /* 连段结束：结算评级 */
      const d = trainComboDmg;
      if (d > trainBest.dmg) trainBest = { hits: trainMaxHits, dmg: d };
      const rank = d >= 70 ? "S" : d >= 50 ? "A" : d >= 35 ? "B" : d >= 20 ? "C" : d > 0 ? "D" : "-";
      el.querySelector(".t-combo").innerHTML =
        "<b>" + rank + "</b> " + trainMaxHits + " HIT · " + Math.round(d) + " DMG";
      trainComboDmg = 0; trainMaxHits = 0;
    }
    if (p1.combo > 0) {
      trainMaxHits = Math.max(trainMaxHits, p1.combo);
      trainLastCombo = p1.combo;
      el.querySelector(".t-combo").textContent = p1.combo + " HIT · " + Math.round(trainComboDmg) + " DMG";
    }
    el.querySelector(".t-hist").innerHTML = inputHist.map(function (t) {
      return '<i class="' + (t.length > 1 ? "dir" : (t === "L" || t === "O" ? "sup" : "atk")) + '">' + t + "</i>";
    }).join("");
    el.querySelector(".t-best").textContent = "最佳 " + trainBest.hits + " HIT / " + Math.round(trainBest.dmg) + " DMG";
  }

  /* ---------- KO 终结回放（环形缓冲 + 0.72x 重播） ---------- */
  const replayBuf = [];
  let replaying = false, replayList = null, replayIdx = 0, replayAcc = 0, replayHold = 0;
  function packReplay() {
    function pf(f, an) {
      return {
        x: f.x, y: f.y, facing: f.facing, state: f.state, stateT: f.stateT,
        crouch: !!f.crouch, blocking: !!f.blocking, hp: f.hp, combo: f.combo || 0,
        clip: an.clip, fn: an.clipFn, dur: an.clipDur, ct: an.clipT, hold: an.clipHold,
      };
    }
    replayBuf.push({
      p1: pf(p1, a1), p2: pf(p2, a2),
      cam: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov },
    });
    if (replayBuf.length > 150) replayBuf.shift();
  }
  function applyReplayFrame(s) {
    function af(f, s2, an) {
      f.x = s2.x; f.y = s2.y; f.facing = s2.facing; f.state = s2.state; f.stateT = s2.stateT;
      f.crouch = s2.crouch; f.blocking = s2.blocking; f.hp = s2.hp; f.combo = s2.combo;
      if (s2.clip && an.clip !== s2.clip) an.play(s2.clip, s2.fn, s2.dur || 0.4, true);
      an.clipT = s2.ct || 0;
    }
    af(p1, s.p1, a1); af(p2, s.p2, a2);
    camera.position.set(s.cam.x, s.cam.y, s.cam.z);
    if (Math.abs(camera.fov - s.cam.fov) > 0.01) { camera.fov = s.cam.fov; camera.updateProjectionMatrix(); }
    camera.lookAt(camera.position.x, 0.92, 0);
  }
  function startReplay() {
    if (replayBuf.length < 20) return;
    replayList = replayBuf.slice(-Math.min(replayBuf.length, 85));
    replayIdx = 0; replayAcc = 0; replayHold = 0.4;
    replaying = true;
    const badge = $("replay-badge");
    if (badge) badge.classList.remove("hidden");
    slowmo = 1;
  }
  function stopReplay() {
    replaying = false; replayList = null;
    const badge = $("replay-badge");
    if (badge) badge.classList.add("hidden");
  }
  function stepReplay(raw) {
    if (replayHold > 0) { replayHold -= raw; return false; }
    replayAcc += raw * 0.72;                       // 0.72 倍速重播
    let stepped = false;
    while (replayAcc >= 1 / 60 && replayList && replayIdx < replayList.length - 1) {
      replayAcc -= 1 / 60;
      replayIdx++;
      stepped = true;
    }
    if (replayList) applyReplayFrame(replayList[replayIdx]);
    if (!replayList || replayIdx >= replayList.length - 1) { stopReplay(); return false; }
    /* 任意键跳过 */
    for (const k in PRESSED) if (PRESSED[k]) { stopReplay(); return false; }
    return true;
  }

  /* ---------- 战绩 / 成就钩子 ---------- */
  let wantShot = false;
  function recordMatchEnd(winner, loser) {
    if (trainMode || netPlay) return;
    const perfect = winner.hp >= 100;
    if (winner === p1) {
      T.Stats.addWin(winner.id, cpuDiff, matchMaxCombo, perfect);
      if (pickStage === "street") T.Stats.unlock("rain_win");
    } else {
      T.Stats.addLoss(matchMaxCombo);
    }
    if ((T.Stats.d.charWins.naiwa || 0) > 0 && (T.Stats.d.charWins.meishu || 0) > 0) T.Stats.unlock("ultra_all");
    refreshStatsPanel();
  }
  function refreshStatsPanel() {
    const el = $("stats-panel");
    if (!el || !T.Stats) return;
    const d = T.Stats.d;
    if (!d.games) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    const rate = d.games ? Math.round(d.wins / d.games * 100) : 0;
    el.innerHTML = "<b>战绩 " + d.wins + "W " + (d.games - d.wins) + "L · 胜率 " + rate + "% · 最长连段 " +
      d.maxCombo + "</b><span>龙 " + (d.charWins.naiwa || 0) + " 胜 · 鼠 " + (d.charWins.meishu || 0) + " 胜</span>" +
      (d.shots.length ? '<img src="' + d.shots[0] + '" alt=""/>' : "");
  }

  /* ============================================================
     装配
     ============================================================ */
  /* 主菜单看板：专属灯组（暖主光 + 紫轮廓光 + 冷补光）、角色接触软影、
     地面能量垫、双色光柱、漂浮尘埃 —— 灯光常驻场景用强度渐变开关，避免着色器重编译卡顿 */
  function buildMenuShowcase() {
    const FXT = T.ensureFxTextures();
    menuRig = new THREE.Group();
    menuBlobs = [];
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.9),
        new THREE.MeshBasicMaterial({ map: FXT.dot, color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })
      );
      b.rotation.x = -Math.PI / 2;
      b.position.y = 0.021;
      b.renderOrder = 1;
      menuRig.add(b);
      menuBlobs.push(b);
    }
    menuPad = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.5),
      new THREE.MeshBasicMaterial({ map: FXT.dot, color: 0xffb060, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    menuPad.rotation.x = -Math.PI / 2;
    menuPad.position.set(1.77, 0.02, 0);
    menuRig.add(menuPad);
    menuShafts = new THREE.Group();
    [[1.0, 0xffc070], [2.75, 0xa060ff]].forEach(function (cfg, i) {
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 5.8),
        new THREE.MeshBasicMaterial({ map: FXT.dot, color: cfg[1], transparent: true, opacity: 0.10, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
      );
      s.position.set(cfg[0], 2.5, -1.5);
      s.rotation.z = (i ? -1 : 1) * 0.09;
      menuShafts.add(s);
    });
    menuRig.add(menuShafts);
    const N = 110, mpos = new Float32Array(N * 3), mcol = new Float32Array(N * 3), mvel = [];
    for (let i = 0; i < N; i++) {
      mpos[i * 3] = 0.5 + Math.random() * 2.8;
      mpos[i * 3 + 1] = 0.08 + Math.random() * 2.5;
      mpos[i * 3 + 2] = -1.7 + Math.random() * 3.0;
      const c = Math.random() < 0.45 ? [0.62, 0.38, 1.0] : [1.0, 0.72, 0.32];
      mcol[i * 3] = c[0]; mcol[i * 3 + 1] = c[1]; mcol[i * 3 + 2] = c[2];
      mvel.push({ vy: 0.05 + Math.random() * 0.12, ph: Math.random() * 6.28, amp: 0.05 + Math.random() * 0.12 });
    }
    const mgeo = new THREE.BufferGeometry();
    mgeo.setAttribute("position", new THREE.BufferAttribute(mpos, 3));
    mgeo.setAttribute("color", new THREE.BufferAttribute(mcol, 3));
    menuMotes = new THREE.Points(mgeo, new THREE.PointsMaterial({
      map: FXT.dot, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false,
      blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true, toneMapped: false,
    }));
    menuMotes.userData.v = mvel;
    menuRig.add(menuMotes);
    menuRig.visible = false;
    scene.add(menuRig);
    menuKey = new THREE.SpotLight(0xffd9a6, 0, 18, 0.6, 0.7, 1.2);
    menuKey.position.set(0.55, 3.6, 2.7);
    menuKey.target.position.set(1.78, 0.7, 0);
    scene.add(menuKey); scene.add(menuKey.target);
    menuRim = new THREE.SpotLight(0xa060ff, 0, 18, 0.65, 0.75, 1.2);
    menuRim.position.set(3.6, 2.7, -2.3);
    menuRim.target.position.set(1.78, 0.85, 0);
    scene.add(menuRim); scene.add(menuRim.target);
    menuFill = new THREE.PointLight(0x6a7dff, 0, 10);
    menuFill.position.set(1.7, 1.1, 2.6);
    scene.add(menuFill);
    /* 右下暖反弹：补亮奶龙暗侧，形成包裹光 */
    menuBounce = new THREE.PointLight(0xffb070, 0, 8);
    menuBounce.position.set(3.1, 0.35, 1.6);
    scene.add(menuBounce);
  }

  function stepMenuAmbience(raw, t) {
    if (menuMotes) {
      const p = menuMotes.geometry.attributes.position, v = menuMotes.userData.v;
      for (let i = 0; i < v.length; i++) {
        let y = p.getY(i) + v[i].vy * raw;
        if (y > 2.75) y = 0.07;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t * 0.5 + v[i].ph) * v[i].amp * raw);
      }
      p.needsUpdate = true;
    }
    if (menuShafts) {
      menuShafts.children[0].material.opacity = 0.09 + 0.045 * Math.sin(t * 0.6);
      menuShafts.children[1].material.opacity = 0.09 + 0.045 * Math.sin(t * 0.6 + 2.1);
      menuShafts.children[0].position.x = 1.0 + Math.sin(t * 0.2) * 0.1;
      menuShafts.children[1].position.x = 2.75 + Math.sin(t * 0.17 + 1) * 0.1;
    }
    if (menuPad) menuPad.material.opacity = 0.06 + 0.035 * Math.sin(t * 0.8);
  }

  function setupStage() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 80);
    camera.position.set(0, 1.4, 4.8);
    renderer = new THREE.WebGLRenderer({
      antialias: true, canvas: $("view"), alpha: false,
      preserveDrawingBuffer: !!SHOT,
      powerPreference: "high-performance",
    });
    // 显存不足导致的上下文丢失：给出明确提示而不是留一块黑屏
    $("view").addEventListener("webglcontextlost", function (ev) {
      ev.preventDefault();
      fatal("显卡显存不足，3D 画面已丢失。请刷新重试，并关闭其他占用显存的程序。");
    }, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = false;
    if ("shadowMap" in renderer && THREE.PCFSoftShadowMap) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    T.ensureFxTextures();
    arena = T.buildArena(scene, renderer);
    fx = new T.FX(scene, camera);
    clock = new THREE.Clock();
    /* 泛光后处理（画质联动，低档自动关闭） */
    if (T.Bloom) T.Bloom.init(renderer, scene, camera);
    buildMenuShowcase();
  }

  /* 统一渲染出口：Bloom 可用时走后处理链，否则直渲 */
  function renderFrame() {
    if (T.Bloom && T.Bloom.enabled && T.Bloom.render()) return;
    renderer.render(scene, camera);
  }

  function disposeModel(model) {
    if (!model || !model.root) return;
    model.root.traverse(function (o) {
      if (!o.isMesh) return;
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (!m) continue;
        // 共用材质只释放一次
        if (m.userData && m.userData.__disposed) continue;
        if (m.userData) m.userData.__disposed = true;
        const maps = ["map", "bumpMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap"];
        for (let k = 0; k < maps.length; k++) if (m[maps[k]] && m[maps[k]].dispose) m[maps[k]].dispose();
        if (m.dispose) m.dispose();
      }
    });
  }

  function swapModel(slot, next) {
    const old = slot === 1 ? m1 : m2;
    if (old && old.root && old.root.parent) old.root.parent.remove(old.root);
    if (old && old._objectUrl) {
      try { URL.revokeObjectURL(old._objectUrl); } catch (e) {}
    }
    if (old) {
      try { disposeModel(old); } catch (e) {}
    }
    scene.add(next.root);
    next.root.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    });
    if (next.kind === "naiwa") naiwaModel = next;
    if (next.kind === "meishu") meishuModel = next;
    if (slot === 1) {
      m1 = next;
      if (p1) a1 = new T.FighterAnim(m1);
    } else {
      m2 = next;
      if (p2) a2 = new T.FighterAnim(m2);
    }
  }

  function setBootNote(txt) {
    const el = $("boot-note");
    if (el) el.textContent = txt;
  }

  function tryAutoLoadGlb() {
    if (!T.loadGlbFighter) {
      window.__glbErr = (window.__glbErr || "") + "no-loadGlbFighter;";
      return Promise.reject(new Error("缺少 GLB 加载器"));
    }
    const loadOne = function (urls, kind, slot, flag) {
      /* 依次尝试候选 URL（优先压缩版），全败才抛错 */
      let idx = 0;
      function attempt() {
        const url = urls[idx];
        return T.loadGlbFighter(url, kind, {
          onProgress: function (ev) {
            if (!ev || !ev.lengthComputable || !ev.total) return;
            const frac = Math.min(0.99, ev.loaded / ev.total);
            if (window.__bootModelProg) window.__bootModelProg(kind, frac);
            else setBootNote("正在载入 3D 模型 " + (kind === "naiwa" ? "奶龙" : "美鼠") + "  " + Math.round(frac * 100) + "%");
          }
        }).then(function (model) {
          swapModel(slot, model);
          window[flag] = true;
        }).catch(function (err) {
          idx++;
          if (idx < urls.length) {
            console.warn(kind + "：" + url + " 不可用，回退原版", err && err.message);
            return attempt();
          }
          window[flag] = false;
          window.__glbErr = (window.__glbErr || "") + flag + ":" + (err && err.message ? err.message : err) + ";";
          throw err;
        });
      }
      return attempt();
    };
    // 串行加载：避免两个大模型同时解析造成显存峰值 → 上下文丢失（画面全黑）
    return loadOne(["assets/naiwa-webp.glb", "assets/naiwa-opt.glb", "assets/naiwa.glb"], "naiwa", 1, "__glbNaiwa")
      .then(function () { return loadOne(["assets/meishu-webp.glb", "assets/meishu-opt.glb", "assets/meishu.glb"], "meishu", 2, "__glbMeishu"); })
      .then(function () { setBootNote(""); });
  }

  /* ============================================================
     界面切换
     ============================================================ */
  function show(id) {
    ["screen-title", "screen-select", "screen-gallery", "screen-help", "screen-vs", "screen-fight", "screen-online"].forEach(function (s) {
      var el = $(s);
      if (el) el.classList.toggle("hidden", s !== id);
    });
    if (id !== "screen-fight") {
      ["ko-banner", "cutin", "letterbox"].forEach(function (s) {
        var el = $(s);
        if (el) el.classList.add("hidden");
      });
    }
    /* BGM 场景切换 */
    if (T.SFX) {
      if (id === "screen-title") T.SFX.music("title");
      else if (id === "screen-fight") T.SFX.music("fight");
      else if (id === "screen-online") T.SFX.music("title");
    }
    /* 离开对战界面时收起训练面板/回放角标 */
    if (id !== "screen-fight") {
      const tp = $("train-panel");
      if (tp) tp.classList.add("hidden");
      const rb = $("replay-badge");
      if (rb) rb.classList.add("hidden");
    }
  }

  function netLog(msg) {
    const el = $("net-status");
    if (el) el.textContent = msg;
  }

  function bindNet() {
    if (!T.Net) return;
    function netStep(n) {
      const el = $("net-steps");
      if (!el) return;
      const ss = el.querySelectorAll("i");
      for (let i = 0; i < ss.length; i++) ss[i].classList.toggle("on", i < n);
    }
    function beginNetFight() {
      vsCpu = false;
      netPlay = true;
      netStep(3);
      const nm = T.Settings ? T.Settings.data.name : "";
      $("hud-p1-name").textContent = (nm || "P1") + " " + p1.name;
      $("hud-p2-name").textContent = (net.peerName || "对手") + " " + p2.name;
      startRoundIntro();
    }
    function wireNet() {
      net.onLog = function (m) { netLog(m); if (/房间|信令/.test(m)) netStep(1); };
      net.onPing = function (rtt) {
        const p = $("net-ping");
        if (p) {
          p.textContent = rtt + " ms";
          p.className = rtt < 60 ? "good" : rtt < 120 ? "ok" : "bad";
        }
      };
      net.onReady = beginNetFight;
      net.onLost = function () {
        netLog("连接中断 · 可点击【加入/创建】重连");
        netStep(1);
        announce("对手离线", 1.2);
      };
      net.onMsg = function (d) {
        if (d.t === "in") remoteBits = d.b | 0;
        if (d.t === "snap") lastSnap = d;
      };
      netStep(2);
    }
    if ($("btn-net-host")) $("btn-net-host").onclick = function () {
      audio(); sfx("select");
      if (net) net.close();
      net = new T.Net();
      wireNet();
      const room = net.host();
      if ($("net-code")) $("net-code").textContent = room;
    };
    if ($("btn-net-join")) $("btn-net-join").onclick = function () {
      audio(); sfx("select");
      const code = ($("net-join-code") && $("net-join-code").value) || "";
      if (net) net.close();
      net = new T.Net();
      wireNet();
      net.join(code).catch(function () {});
      if ($("net-code")) $("net-code").textContent = String(code).toUpperCase();
    };
    if ($("btn-net-back")) $("btn-net-back").onclick = function () {
      sfx("select");
      if (net) { net.close(); net = null; }
      netPlay = false;
      state = "title";
      show("screen-title");
    };
  }

  function fatal(msg) {
    const mask = $("boot-mask");
    if (mask) {
      mask.classList.remove("gone");
      mask.innerHTML = '<span style="letter-spacing:.2em;color:#e8c24a">无法启动</span>' +
        '<p style="max-width:420px;line-height:1.7;color:#c9b48a;font-size:13px;margin-top:10px">' + msg + "</p>" +
        '<p style="margin-top:18px"><button class="btn" onclick="location.reload()">重新加载</button></p>';
    }
    const st = $("fatal-status");
    if (st) st.textContent = msg;
  }

  function openSelect() {
    state = "select";
    show("screen-select");
    if (!pickStage && T.STAGES && T.STAGES[0]) pickStage = T.STAGES[0].id;
    if (arena && arena.setStage) arena.setStage(pickStage);
    applyPickPortraits();
    refreshSelectMarks();
  }
  function refreshSelectMarks() {
    const chars = document.querySelectorAll(".sel-chars");
    for (let i = 0; i < chars.length; i++) {
      const side = chars[i].getAttribute("data-side");
      const cur = side === "2" ? pickP2 : pickP1;
      const btns = chars[i].querySelectorAll(".sel-char");
      for (let j = 0; j < btns.length; j++) btns[j].classList.toggle("on", btns[j].getAttribute("data-id") === cur);
    }
    const stages = document.querySelectorAll(".sel-stage");
    for (let i = 0; i < stages.length; i++) stages[i].classList.toggle("on", stages[i].getAttribute("data-id") === pickStage);
  }
  function bindSelect() {
    const row = $("sel-stage-row");
    if (row && T.STAGES) {
      row.innerHTML = "";
      for (let i = 0; i < T.STAGES.length; i++) {
        const st = T.STAGES[i];
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sel-stage" + (st.id === pickStage ? " on" : "");
        b.setAttribute("data-id", st.id);
        b.innerHTML = "<img alt=\"\" src=\"" + st.pano + "\" /><span>" + st.name + "</span>";
        b.onclick = function () {
          pickStage = st.id;
          sfx("select");
          if (arena && arena.setStage) arena.setStage(pickStage);
          refreshSelectMarks();
        };
        row.appendChild(b);
      }
    }
    const charBtns = document.querySelectorAll(".sel-char");
    for (let i = 0; i < charBtns.length; i++) {
      charBtns[i].onclick = function () {
        const side = this.parentNode.getAttribute("data-side");
        const id = this.getAttribute("data-id");
        sfx("select");
        if (side === "2") {
          if (pickP1 === id) pickP1 = pickP2;
          pickP2 = id;
        } else {
          if (pickP2 === id) pickP2 = pickP1;
          pickP1 = id;
        }
        applyPickPortraits();
        refreshSelectMarks();
      };
    }
    if ($("btn-select-back")) $("btn-select-back").onclick = function () {
      sfx("select"); state = "title"; show("screen-title");
    };
    if ($("btn-select-fight")) $("btn-select-fight").onclick = function () {
      audio(); sfx("select");
      if (arena && arena.setStage) arena.setStage(pickStage);
      startRoundIntro();
    };
  }
  function bindUI() {
    $("btn-start").onclick = function () {
      window.__shotReady = false;
      window.__shotDone = false;
      audio(); sfx("select");
      if (!modelsReady) { if (T.toast) T.toast("3D 模型还在载入，稍候…", "warn"); return; }
      const mode = $("mode") ? $("mode").value : "cpu";
      if (mode === "online") {
        netPlay = false;
        state = "online";
        show("screen-online");
        netLog("创建房间，或输入对方房间码加入。同一电脑开两个标签页即可对打。");
        return;
      }
      netPlay = false;
      trainMode = mode === "train";
      vsCpu = mode === "cpu" || trainMode;
      openSelect();
    };
    bindSelect();
    if ($("btn-online")) $("btn-online").onclick = function () {
      audio(); sfx("select");
      state = "online";
      show("screen-online");
      netLog("创建房间，或输入对方房间码加入。同一电脑开两个标签页即可对打。");
    };
    bindNet();
    $("btn-gallery").onclick = function () {
      sfx("select"); state = "gallery"; show("screen-gallery");
    };
    $("btn-gallery-back").onclick = function () {
      sfx("select"); state = "title"; show("screen-title");
    };
    $("btn-help").onclick = function () { sfx("select"); show("screen-help"); };
    $("btn-help-back").onclick = function () { sfx("select"); state = "title"; show("screen-title"); };
    if ($("btn-super")) $("btn-super").onclick = function () {
      audio();
      if (state !== "fight") return;
      if (netPlay && net && net.role === "guest") {
        net.send({ t: "in", b: packBits(MAP1) | 512 });
        return;
      }
      startAtk(p1, "super");
    };
    $("btn-home").onclick = function () {
      sfx("select");
      if (net) { net.close(); net = null; }
      netPlay = false;
      roundOver = false;
      introT = 0;
      state = "title"; round = 1; wins = [0, 0];
      renderWinStars(); resetRound();
      show("screen-title");
    };
    // 菜单键盘导航
    const items = ["btn-start", "btn-online", "btn-gallery", "btn-help", "btn-settings"].filter(function (id) { return $(id); });
    let mi = 0;
    /* 悬停/选中菜单项：看板主光瞬亮 + 泛光轻推，菜单与 3D 场景联动 */
    const menuNav = document.querySelector(".menu");
    if (menuNav && !menuNav.__glowBound) {
      menuNav.__glowBound = true;
      menuNav.addEventListener("pointerenter", function () {
        menuGlow = 1;
        if (T.Bloom) T.Bloom.boost(0.32);
      }, true);
    }
    function markMenu() {
      items.forEach(function (id, i) { if ($(id)) $(id).classList.toggle("active", i === mi); });
      menuGlow = 1;
    }
    window.addEventListener("keydown", function (e) {
      if (state !== "title") return;
      if (e.key === "ArrowDown") { mi = (mi + 1) % items.length; markMenu(); }
      if (e.key === "ArrowUp") { mi = (mi - 1 + items.length) % items.length; markMenu(); }
      if (e.key === "Enter") $(items[mi]).click();
    });
    items.forEach(function (id, i) {
      if ($(id)) $(id).addEventListener("mouseenter", function () { mi = i; markMenu(); });
    });
    const pills = document.querySelectorAll("#mode-pills button");
    function markMode(v) {
      if ($("mode")) $("mode").value = v;
      for (let i = 0; i < pills.length; i++) pills[i].classList.toggle("on", pills[i].getAttribute("data-mode") === v);
      const dr = $("diff-row");
      if (dr) dr.classList.toggle("hidden", !(v === "cpu" || v === "train"));
    }
    for (let i = 0; i < pills.length; i++) {
      pills[i].onclick = function () {
        sfx("select");
        markMode(this.getAttribute("data-mode"));
      };
    }
    markMode($("mode") ? $("mode").value : "cpu");
    if ($("diff-select")) $("diff-select").onchange = function () {
      cpuDiff = parseFloat(this.value) || 0.62;
      try { localStorage.setItem("nv_diff", String(cpuDiff)); } catch (e) {}
      if (p2 && p2.cpu) p2.cpu.skill = cpuDiff;
    };
    try { cpuDiff = parseFloat(localStorage.getItem("nv_diff")) || 0.62; } catch (e) {}
    if ($("diff-select")) {
      const opts = $("diff-select").options;
      for (let i = 0; i < opts.length; i++) opts[i].selected = parseFloat(opts[i].value) === cpuDiff;
    }
    bindSysUI();
  }

  /* ============================================================
     系统界面绑定：设置面板 / 暂停 / 训练 / 鉴赏 3D / 联机 / 战绩
     ============================================================ */
  function openSettings(on) {
    const el = $("settings-panel");
    if (!el) return;
    el.classList.toggle("hidden", !on);
    if (on) renderAchList();
  }
  function renderAchList() {
    const box = $("ach-list");
    if (!box || !T.Stats) return;
    const d = T.Stats.d;
    let html = "";
    for (const id in T.Stats.achDef) {
      const def = T.Stats.achDef[id];
      const got = !!d.ach[id];
      html += '<div class="ach' + (got ? " got" : "") + '"><b>' + (got ? "🏆" : "🔒") + "</b><span><i>" +
        def.name + "</i><em>" + def.desc + "</em></span></div>";
    }
    box.innerHTML = html;
  }
  function bindSysUI() {
    const S = T.Settings;
    /* ---- 设置面板 ---- */
    if ($("btn-settings")) $("btn-settings").onclick = function () { sfx("select"); openSettings(true); };
    if ($("btn-set-close")) $("btn-set-close").onclick = function () { sfx("select"); openSettings(false); };
    function slider(id, key) {
      const el = $(id);
      if (!el) return;
      el.value = S.data[key];
      el.oninput = function () { S.set(key, parseInt(this.value, 10)); };
    }
    slider("set-master", "volMaster");
    slider("set-sfx", "volSfx");
    slider("set-music", "volMusic");
    if ($("set-quality")) {
      $("set-quality").value = S.data.quality;
      $("set-quality").onchange = function () { S.set("quality", this.value); };
    }
    function togg(id, key) {
      const el = $(id);
      if (!el) return;
      el.checked = !!S.data[key];
      el.onchange = function () { S.set(key, this.checked); };
    }
    togg("set-shadows", "shadows");
    togg("set-grain", "fxGrain");
    togg("set-vig", "fxVig");
    togg("set-voice", "fxVoice");
    if ($("set-shake")) {
      $("set-shake").value = String(S.data.fxShake);
      $("set-shake").onchange = function () { S.set("fxShake", parseInt(this.value, 10)); };
    }
    if ($("set-lang")) {
      $("set-lang").value = S.data.lang;
      $("set-lang").onchange = function () { S.set("lang", this.value); };
    }
    if ($("set-name")) {
      $("set-name").value = S.data.name || "";
      $("set-name").oninput = function () { S.set("name", this.value.trim().slice(0, 8)); };
    }
    if ($("btn-set-clear")) $("btn-set-clear").onclick = function () {
      try { localStorage.removeItem("nv_stats_v1"); localStorage.removeItem("nv_settings_v1"); } catch (e) {}
      if (T.toast) T.toast("存档已清除，刷新后生效", "warn");
    };
    /* ---- 暂停面板 ---- */
    if ($("btn-resume")) $("btn-resume").onclick = togglePause;
    if ($("btn-pause-restart")) $("btn-pause-restart").onclick = function () {
      togglePause();
      roundOver = false;
      startRoundIntro();
    };
    if ($("btn-pause-settings")) $("btn-pause-settings").onclick = function () { openSettings(true); };
    if ($("btn-pause-home")) $("btn-pause-home").onclick = function () {
      togglePause();
      $("btn-home").click();
    };
    /* ---- 训练模式 CPU 行为 ---- */
    const tc = document.querySelectorAll("#train-cpu button");
    for (let i = 0; i < tc.length; i++) {
      tc[i].onclick = function () {
        sfx("select");
        trainCpu = this.getAttribute("data-cpu") || "idle";
        for (let j = 0; j < tc.length; j++) tc[j].classList.toggle("on", tc[j] === this);
      };
      if ((tc[i].getAttribute("data-cpu") || "") === "idle") tc[i].classList.add("on");
    }
    /* ---- 鉴赏 3D：角色页签 + 招式演示 + 拖拽旋转 ---- */
    const gt = document.querySelectorAll("#gal-tabs button");
    for (let i = 0; i < gt.length; i++) {
      gt[i].onclick = function () {
        sfx("select");
        galChar = this.getAttribute("data-ch") || "naiwa";
        for (let j = 0; j < gt.length; j++) gt[j].classList.toggle("on", gt[j] === this);
        galAnim = null;
      };
      if ((gt[i].getAttribute("data-ch") || "") === "naiwa") gt[i].classList.add("on");
    }
    const gd = document.querySelectorAll("#gal-demo button");
    for (let i = 0; i < gd.length; i++) {
      gd[i].onclick = function () {
        sfx("select");
        const mv = this.getAttribute("data-move") || "idle";
        if (!galAnim) return;
        if (mv === "idle") { galAnim.stopClip(); return; }
        const lib = T.clipFor(galChar, mv);
        if (lib) galAnim.play(mv, lib, 1.6, true);
      };
    }
    let galDragOn = false, galLastX = 0;
    const cv = $("view");
    if (cv) {
      cv.addEventListener("pointerdown", function (e) {
        if (state !== "gallery") return;
        galDragOn = true; galLastX = e.clientX;
      });
      window.addEventListener("pointermove", function (e) {
        if (!galDragOn || state !== "gallery") return;
        galYaw += (e.clientX - galLastX) * 0.012;
        galLastX = e.clientX;
        galAutoT = -2.5;
      });
      window.addEventListener("pointerup", function () { galDragOn = false; });
    }
    /* ---- 联机：侠名 / 复制链接 / 自动填码 ---- */
    if ($("net-name")) {
      $("net-name").value = S.data.name || "";
      $("net-name").oninput = function () { S.set("name", this.value.trim().slice(0, 8)); };
    }
    if ($("btn-net-copy")) $("btn-net-copy").onclick = function () {
      const code = $("net-code").textContent.trim();
      if (!code || code === "----") return;
      const link = location.origin + location.pathname + "?join=" + code;
      const done = function () { if (T.toast) T.toast("邀请链接已复制", "info"); };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, done);
      else done();
    };
    const jm = /[?&]join=([A-Za-z0-9]+)/.exec(location.search);
    if (jm && $("net-join-code")) {
      $("net-join-code").value = jm[1];
      netLog("已填入房间码 " + jm[1] + "，点击【加入】即可。");
    }
    /* ---- 战绩面板 ---- */
    refreshStatsPanel();
  }

  /* ============================================================
     鉴赏 3D 渲染分支（主循环调用）
     ============================================================ */
  function renderGallery(raw) {
    const model = galChar === "meishu" ? (meishuModel || m2) : (naiwaModel || m1);
    const other = galChar === "meishu" ? (naiwaModel || m1) : (meishuModel || m2);
    if (other && other.root) other.root.visible = false;
    if (model && model.root) {
      model.root.visible = true;
      if (!galAnim || galAnim.model !== model) galAnim = new T.FighterAnim(model);
      galAutoT += raw;
      if (galAutoT > 0) galYaw += raw * 0.3;           // 未拖拽时缓慢自转
      galAnim.update(raw, elapsed, galFake);
      galFake.viewYaw = galYaw;
      galAnim.applyRoot(galFake, galYaw);
    }
    const sway = Math.sin(elapsed * 0.3) * 0.06;
    camera.position.set(sway, 1.02, 3.15);
    camera.lookAt(0, 0.86, 0);
    if (camera.fov !== 40) { camera.fov = 40; camera.updateProjectionMatrix(); }
    if (arena) arena.update(elapsed, null);
    if (fx) fx.update(raw * 0.4);
    renderFrame();
    clearPressed();
  }

  function boot() {
    if (typeof THREE === "undefined") {
      fatal("3D 引擎未能加载。请确认 vendor/three.min.js 与 index.html 在同一目录，或使用本地服务器打开。");
      return;
    }
    if (!T.detectWebGL()) {
      fatal("当前浏览器未启用 WebGL，无法渲染 3D 擂台。请更换为 Chrome / Edge / 新版 360 极速内核，或在浏览器设置中开启硬件加速。");
      return;
    }
    try {
      setupStage();
    } catch (e) {
      fatal("3D 场景初始化失败：" + (e && e.message ? e.message : e));
      return;
    }
    /* live 3D 加载场景：建场成功即点灯起镜，加载遮罩透出真实舞台 */
    document.body.classList.add("boot3d");
    loop();

    const applyShot = function () {
      if (SHOT === "fn") {
        setTimeout(runFnTest, 400);
        window.__shotReady = true;
      }
      if (SHOT === "title" || SHOT === "verify" || SHOT === "gallery" || SHOT === "vs") {
        if (SHOT === "gallery") { state = "gallery"; show("screen-gallery"); }
        if (SHOT === "vs") { state = "vs"; show("screen-vs"); }
        window.__shotReady = true;
      }
      if (SHOT === "final") {
        show("screen-fight"); state = "fight"; introT = 0;
        p1.hp = 100; p2.hp = 0;
        wins = [2, 1]; round = 3;
        showMatchEnd(p1);
        window.__shotReady = true;
      }
      if (SHOT === "fight") {
        show("screen-fight"); state = "fight"; introT = 0;
        announce("ROUND 1", 99);
        p1.x = 0.35; p2.x = 1.75;
        p2.hp = 58; p1.hp = 76; p1.meter = 100; p2.meter = 44;
        p1.state = "punch"; p1.stateT = 0.13; p1.atk = MOVES.naiwa.punch; p1.atkKey = "punch";
        a1.play("punch", T.clipFor("naiwa", "punch"), 0.39);
        a1.hitAtK = 0.36;
        p2.state = "hurt"; p2.kvx = 3;
        a2.play("hurt", T.COMMON.hurt, 0.36, true);
        a2.shake = 1;
        $("combo").innerHTML = "<b>7</b> HITS";
        T.FXlib.hit(fx, 1.35, 1.05, 0xffd24a);
        T.FXlib.fireBurst(fx, 1.35, 1.05, 1);
        window.__shotReady = true;
      }
      /* 视觉验收场景：火波 / 冰波 / 蓄力波 / 升龙拳 */
      if (SHOT && SHOT.indexOf("fx") === 0) {
        show("screen-fight"); state = "fight"; introT = 0;
        $("combo").innerHTML = "";
        p1.x = -1.1; p2.x = 1.9;
        p1.hp = 100; p2.hp = 74; p1.meter = 100;
        p2.state = "hurt"; p2.kvx = 2;
        a2.play("hurt", T.COMMON.hurt, 0.36, true);
        p1.state = "idle";
        var what = SHOT.slice(2) || "fire";
        announce(what === "fire" ? "炎龙咆哮波 · 满蓄" : what === "ice" ? "绝对零度波 · 满蓄" : what === "upper" ? "凝胶升龙" : "蓄力", 99);
        if (what === "fire") {
          T.FXlib.chargedWave(fx, p1.x + 0.7, 1.0, 1, "fire", 1);
          spawnBolt(p1, MOVES.naiwa.hpCharge);
        } else if (what === "ice") {
          T.FXlib.chargedWave(fx, p1.x + 0.7, 0.7, 1, "ice", 1);
          spawnBolt(p1, MOVES.naiwa.hkCharge);
        } else if (what === "upper") {
          p1.y = 0.9; p1.vy = 3;
          a1.play("skill2", T.clipFor("naiwa", "skill2"), 0.7);
          a1.hitAtK = 0.34;
          T.FXlib.risingDragon(fx, p1, { element: "fire", dur: 0.7 });
        } else {
          p1.charge = { kind: "fire", t: 1.3, lv: 1, orb: null, maxed: true };
          a1.play("charge", T.COMMON.charge, 0.3);
          a1.chargeLv = 1;
        }
        window.__shotReady = true;
      }
      if (SHOT && (SHOT.indexOf("ultra") === 0 || SHOT.indexOf("mu") === 0)) {
        show("screen-fight"); state = "fight"; introT = 0;
        p1.x = -1.4; p2.x = 1.6;
        p1.hp = 100; p2.hp = 82;
        p1.meter = 100; p2.meter = 100;
        p2.cpu = null;
        p2.state = "idle";
        var meishuSide = SHOT.charAt(0) === "m";
        var ukey = meishuSide ? ("ultra" + SHOT.slice(-1)) : SHOT;
        var caster = meishuSide ? p2 : p1;
        caster.meter = 100;
        try { startAtk(caster, ukey); } catch (e) { console.warn("ultra shot", e); }
        window.__shotReady = true;
      }
    };
    /* ============================================================
       阶段式加载：舞台就绪即进标题，GLB 后台加载 + 真实进度
       ============================================================ */
    if (T.QUALITY) T.QUALITY.init(renderer, camera);
    if (T.Settings) T.Settings.apply();

    const TIPS = [
      "WASD 移动 · J/K 轻拳脚 · U/I 重拳脚",
      "长按 U 或 I 蓄力：满蓄自动发射贯穿强化波",
      "↓↘→ + 拳 或 L：泰山压顶 · 蹲 + L：凝胶升龙",
      "气 50 按 O 放超必 · 前/下/后 + O 三种终极",
      "下段攻击要蹲防 · 投技不可防 · 双击方向冲刺",
      "ESC 暂停 · 设置里可调画质/音量/屏效",
    ];
    const SLOW = parseInt((/[?&]slowboot=(\d+)/.exec(location.search) || [])[1] || "0", 10) || 0;
    const BOOT_T0 = performance.now();
    const bootUI = {
      pct: 0, target: 0, tipI: 0, bgI: 0, timer: null, tipTimer: null, kind: "naiwa",
      start: function () {
        const self = this;
        this.timer = setInterval(function () {
          if (SLOW && performance.now() - BOOT_T0 < SLOW * 1000) return;   /* 演示：拖住进度 */

          self.pct += (self.target - self.pct) * 0.18 + 0.2;
          if (self.pct > 99.5) self.pct = 99.5;
          const bar = document.querySelector("#boot-bar i");
          const pct = $("boot-pct");
          if (bar) bar.style.width = self.pct.toFixed(1) + "%";
          if (pct) pct.textContent = Math.round(self.pct) + "%";
        }, 50);
        this.tipTimer = setInterval(function () {
          const t = $("boot-tip");
          if (t) {
            t.style.opacity = "0";
            setTimeout(function () {
              self.tipI = (self.tipI + 1) % TIPS.length;
              t.textContent = TIPS[self.tipI];
              t.style.opacity = "1";
            }, 260);
          }
        }, 3200);
        const t0 = $("boot-tip");
        if (t0) t0.textContent = TIPS[0];
        this.bgCycle();
        /* Canvas 演出：法阵徽章 + 能量束 + 余烬 */
        if (T.BootFX) {
          const self = this;
          T.BootFX.start($("boot-fx"), {
            pct: function () { return self.pct; },
            kind: function () { return self.kind; },
            live3d: document.body.classList.contains("boot3d"),
          });
        }
      },
      bgCycle: function () {
        const a = $("boot-bg-a"), b = $("boot-bg-b");
        if (!a || !b) return;
        const imgs = T.STAGES.map(function (s) { return s.pano; });
        a.style.backgroundImage = "url(" + imgs[0] + ")";
        a.style.opacity = "1"; b.style.opacity = "0";
        let cur = 0, front = true;
        const self = this;
        this.bgTimer = setInterval(function () {
          cur = (cur + 1) % imgs.length;
          const nx = front ? b : a, od = front ? a : b;
          nx.style.backgroundImage = "url(" + imgs[cur] + ")";
          nx.style.opacity = "1";
          od.style.opacity = "0";
          front = !front;
        }, 2600);
      },
      prog: function (p) { this.target = Math.max(this.target, p * 100); },
      done: function () {
        this.prog(1); this.pct = 100;
        clearInterval(this.timer); clearInterval(this.tipTimer); clearInterval(this.bgTimer);
        if (T.BootFX) T.BootFX.stop();
      },
    };
    window.__bootModelProg = function (kind, frac) {
      bootUI.kind = kind;
      bootUI.prog(kind === "naiwa" ? 0.2 + frac * 0.4 : 0.6 + frac * 0.4);
      setBootNote((kind === "naiwa" ? "奶龙" : "美鼠") + " 登场准备 " + Math.round(frac * 100) + "%");
    };

    bootUI.start();
    bootUI.prog(0.06);

    /* 舞台图预载：完成即揭幕标题（不等 3D 模型） */
    let revealed = false;
    function revealTitle() {
      if (revealed || state !== "boot") return;
      const wait = SLOW ? Math.max(0, SLOW * 1000 - (performance.now() - BOOT_T0)) : 0;
      setTimeout(function () {
        if (revealed || state !== "boot") return;
        revealed = true;
        state = "title";
        show("screen-title");
        bindUI();
        loop();
        const note = $("boot-note");
        if (note) note.textContent = "3D 角色后台加载中，完成后即可对战…";
      }, wait);
    }
    const panoImgs = T.STAGES.map(function (s) { return s.pano; });
    let panoDone = 0;
    for (let i = 0; i < panoImgs.length; i++) {
      const im = new Image();
      im.onload = im.onerror = function () {
        panoDone++;
        bootUI.prog(0.06 + 0.14 * (panoDone / panoImgs.length));
        if (panoDone >= 2) revealTitle();
      };
      im.src = panoImgs[i];
    }
    setTimeout(revealTitle, 1500);

    /* GLB 后台加载：优先用 WebP 压缩版，缺省回退原版 */
    tryAutoLoadGlb().then(function () {
      const fin = function () {
      if (!naiwaModel || !meishuModel) {
        fatal("3D 模型未能载入。请用本地服务器打开，并确认 assets/naiwa.glb 与 assets/meishu.glb 存在。");
        return;
      }
      modelsReady = true;
      bootUI.done();
      resetRound();
      applyPickPortraits();
      const bs = $("btn-start");
      if (bs) bs.classList.remove("loading");
      const mask = $("boot-mask");
      if (mask) mask.classList.add("gone");
      /* 模型解封演出 */
      flashColor = "#fff6d8"; flashT = 0.22;
      if (fx && (state === "title" || state === "boot")) {
        T.FXlib.pillar(fx, 1.42, 0xffc860, 1.1);
        T.FXlib.pillar(fx, 2.12, 0xc08aff, 1.1);
        T.FXlib.energyBurst(fx, 1.42, 1.0, 0xffd88a, 0.9);
        T.FXlib.energyBurst(fx, 2.12, 1.0, 0xc090ff, 0.9);
      }
        if (T.toast) T.toast("3D 角色已就绪，开始对战吧！", "info");
        applyShot();
      };
      const wait = SLOW ? Math.max(0, SLOW * 1000 - (performance.now() - BOOT_T0)) : 0;
      setTimeout(fin, wait);
    }, function (err) {
      fatal("3D 模型载入失败：" + (err && err.message ? err.message : err));
    });
  }

  window.addEventListener("error", function (e) {
    if (state === "boot") fatal("脚本错误：" + (e && e.message ? e.message : "unknown"));
  });
  window.addEventListener("keydown", function (e) {
    if (!KEY[e.key]) PRESSED[e.key] = true;
    KEY[e.key] = true;
    if (e.code) {
      if (!KEY[e.code]) PRESSED[e.code] = true;
      KEY[e.code] = true;
    }
    if (e.key === "Escape") {
      const sp = $("settings-panel");
      if (sp && !sp.classList.contains("hidden")) { openSettings(false); return; }
      togglePause();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) >= 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) {
    KEY[e.key] = false;
    if (e.code) KEY[e.code] = false;
  });
  window.addEventListener("blur", function () {
    if (T.__holdKeys) return;
    for (const k in KEY) KEY[k] = false;
  });
  window.addEventListener("resize", function () {
    if (!camera) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (T.QUALITY && T.QUALITY._renderer) T.QUALITY.apply();
    else renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(innerWidth, innerHeight);
    if (T.Bloom) T.Bloom.resize();
  });

  /* ============================================================
     工程守卫：错误环形日志 / WebGL 上下文恢复 / 内存守卫 / SW 注册
     ============================================================ */
  (function () {
    /* 错误收集：localStorage 环形 20 条，?debug=1 显示错误条 */
    const RING = [];
    function logErr(kind, msg) {
      RING.push(kind + ": " + msg);
      if (RING.length > 20) RING.shift();
      try {
        localStorage.setItem("nv_errs", JSON.stringify(RING));
      } catch (e) {}
      if (/[?&]debug/.test(location.search)) {
        let bar = document.getElementById("err-bar");
        if (!bar) {
          bar = document.createElement("div");
          bar.id = "err-bar";
          document.body.appendChild(bar);
        }
        bar.textContent = RING[RING.length - 1];
      }
    }
    window.addEventListener("error", function (e) {
      logErr("err", (e.message || "unknown") + (e.filename ? " @" + e.filename.split("/").pop() + ":" + e.lineno : ""));
    });
    window.addEventListener("unhandledrejection", function (e) {
      logErr("rej", String((e.reason && e.reason.message) || e.reason || "unknown"));
    });
    /* 上下文恢复：自动刷新重建（最可靠的恢复路径） */
    const view = document.getElementById("view");
    if (view) view.addEventListener("webglcontextrestored", function () {
      if (NV.toast) NV.toast("显卡上下文已恢复，正在重建画面…", "warn");
      setTimeout(function () { location.reload(); }, 600);
    });
    /* 页面切后台：对局自动暂停（联机除外），回来继续 */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && state === "fight" && !paused && !netPlay && !trainMode) togglePause();
      if (!document.hidden) clearPressed();
    });
    /* 内存守卫：Chrome 系 1.5GB 提示 */
    setInterval(function () {
      const m = performance.memory;
      if (m && m.usedJSHeapSize > 1.5 * 1024 * 1024 * 1024) {
        if (NV.toast) NV.toast("内存占用过高，建议刷新页面", "warn");
      }
    }, 5000);
    /* PWA：http(s) 下注册 Service Worker */
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      try { navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
    }
  })();

  T.debugFight = function (opt) {
    if (opt && opt.freezeCpu) vsCpu = false;
    if (opt && opt.reset) { resetRound(); roundOver = false; }
    if (opt && opt.skipIntro) introT = 0;
    if (opt && opt.keys) {
      T.__holdKeys = opt.keys;
      for (const k in KEY) KEY[k] = false;
      for (const k in opt.keys) KEY[k] = !!opt.keys[k];
    }
    if (!p1) return null;
    return {
      screen: state,
      intro: introT,
      p1: { x: +p1.x.toFixed(3), s: p1.state, b: !!p1.blocking, hp: p1.hp },
      p2: { x: +p2.x.toFixed(3), s: p2.state, b: !!p2.blocking, hp: p2.hp },
    };
  };

  /* 测试钩子：仅在 ?shot= 调试模式下暴露，供无头验收脚本驱动真实逻辑 */
  if (SHOT) {
    window.__NV_TEST = {
      getP1: function () { return p1; },
      getP2: function () { return p2; },
      getState: function () { return state; },
      bolts: function () { return bolts; },
      moves: MOVES,
      // 用真实 driveInput 推进一步（模拟一帧输入）
      step: function (io) { driveInput(p1, io); },
      // 推进物理/弹道（模拟一帧 tick）
      tick: function (dt) { tickFighter(p1, dt || 1 / 60); tickFighter(p2, dt || 1 / 60); updateBolts(dt || 1 / 60); },
      // 强制进入对局
      fight: function () { state = "fight"; show("screen-fight"); introT = 0; p1.x = -1.2; p2.x = 1.4; },
      // 暂停主循环的输入驱动（测试时独占 p1）
      pauseLoop: function () { state = "fnpause"; },
      resumeLoop: function () { state = "fight"; },
      announce: function () { var el = $("announce"); return el ? el.textContent : ""; },
      setSlowmo: function (v) { slowmo = v; },
      charge: function () { return p1.charge ? { kind: p1.charge.kind, t: +p1.charge.t.toFixed(3), lv: +p1.charge.lv.toFixed(2) } : null; },
      atkKey: function () { return p1.atkKey; },
      setDt: function (v) { dtMove = v; },
    };
  }

  /* SHOT === "fn"：无头功能自测（真实输入管线） */
  function runFnTest() {
    const T = window.__NV_TEST;
    if (!T) return;
    const out = [];
    const push = function (s) { out.push(s); };
    // 一步 = 输入 + 物理推进（贴近真实一帧，固定 dt 保证确定性）
    const F = function (io) { T.setDt(1 / 60); T.step(io); T.tick(1 / 60); };
    T.setDt(1 / 60);
    T.fight();
    // 独占驱动：暂停主循环的输入处理，避免与真实 rAF 抢 p1
    T.pauseLoop();
    T.setDt(1 / 60);
    // 1) 长按 U 蓄力
    for (let i = 0; i < 12; i++) F({ holdHp: true });
    push("T1 0.2s charge=" + JSON.stringify(T.charge()));
    for (let i = 0; i < 40; i++) F({ holdHp: true });
    push("T2 0.87s charge=" + JSON.stringify(T.charge()) + " ann=[" + T.announce() + "]");
    // 2) 松手释放
    const b0 = T.bolts().length;
    F({});
    push("T3 release charge=" + JSON.stringify(T.charge()) + " atk=" + T.atkKey() +
      " bolts " + b0 + "->" + T.bolts().length + " ann=[" + T.announce() + "]");
    for (let i = 0; i < 40; i++) F({});
    const bs = T.bolts();
    const lb = bs[bs.length - 1];
    push("T4 bolts=" + bs.length + (lb ? " kind=" + lb.kind + " scale=" + (lb.mv.projScale || 0).toFixed(2) +
      " dmg=" + lb.mv.dmg + " charged=" + !!lb.mv.charged + " pierce=" + !!lb.mv.pierce : ""));
    // 3) 短按 = 普通波
    for (let i = 0; i < 240; i++) F({});
    const f = T.getP1(); f.state = "idle"; f.x = -1.2;
    for (let i = 0; i < 6; i++) F({ holdHp: true });
    const shortCharge = T.charge();
    F({});
    for (let i = 0; i < 25; i++) F({});
    const sbs = T.bolts();
    const slb = sbs[sbs.length - 1];
    push("T5 short-hold charge=" + JSON.stringify(shortCharge) + " atk=" + T.atkKey() +
      " bolts=" + sbs.length + (slb ? " charged=" + !!slb.mv.charged : ""));
    // 4) 升龙拳 dp 指令
    for (let i = 0; i < 240; i++) F({});
    T.fight();
    T.pauseLoop();
    f.state = "idle"; f.y = 0; f.invulT = 0; f.x = -1.0;
    F({ R: true });
    F({ R: true, D: true });
    F({ D: true });
    F({ D: true, R: true, lp: true });
    push("T6 DP atk=" + T.atkKey() + " state=" + f.state + " y=" + f.y.toFixed(2));
    // 5) 满蓄自动发射
    for (let i = 0; i < 240; i++) F({});
    f.state = "idle"; f.x = -1.2; f.y = 0; f.vy = 0; f.invulT = 0;
    for (let i = 0; i < 95; i++) F({ holdHp: true });
    push("T7 auto-fire charge=" + JSON.stringify(T.charge()) + " atk=" + T.atkKey() + " y=" + f.y.toFixed(2));
    // 6) 冰波蓄力
    for (let i = 0; i < 240; i++) F({});
    f.state = "idle"; f.x = -1.2; f.y = 0; f.vy = 0; f.invulT = 0;
    for (let i = 0; i < 90; i++) F({ holdHk: true });
    const ic = T.charge();
    F({});
    for (let i = 0; i < 30; i++) F({});
    const ibs = T.bolts();
    const ilb = ibs[ibs.length - 1];
    push("T8 ice charge=" + JSON.stringify(ic) + " atk=" + T.atkKey() +
      " bolts=" + ibs.length + (ilb ? " kind=" + ilb.kind + " charged=" + !!ilb.mv.charged : ""));
    push("FN-DONE");
    T.resumeLoop();
    const el = document.createElement("pre");
    el.id = "fn-out";
    el.style.cssText = "position:fixed;left:0;top:0;z-index:999;background:#000;color:#0f0;font-size:11px;margin:0;padding:4px";
    el.textContent = out.join("\n");
    document.body.appendChild(el);
    document.title = "FN-DONE";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else boot();
})(window.NV);
