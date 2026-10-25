/* ============================================================
   格斗动作库 v5 —— 身份对调后
  奶娃（圆胖凝胶宝宝）：轻/重拳拍击 · 轻/重脚蹬踢 · 泰山压顶 · 凝胶升龙
  美鼠（大耳黄袋鼠）：刺拳/重拳 · 轻踢/铲踢 · 旋风弹跳 · 袋鼠升龙
   · 普攻拳拳到肉：蓄力拉满 → 弹射伸臂 → 转腰送肩 → 命中回弹 → 快速回收
   片段签名 fn(tgt, k, ctx)：k∈[0,1]
   ============================================================ */
(function (NV) {
  "use strict";
  const ramp = NV.ramp, bell = NV.bell;
  const E_OUT = NV.easeOut, E_IN = NV.easeIn, E_IO = NV.easeIO;
  const G = NV.GUARD;

  function g(t, path) {
    const parts = path.split(".");
    let o = t;
    for (let i = 0; i < parts.length; i++) {
      if (!o[parts[i]]) o[parts[i]] = {};
      o = o[parts[i]];
    }
    return o;
  }
  function set(t, path, v) {
    const parts = path.split(".");
    const key = parts.pop();
    if (!parts.length) { t[key] = v; return; }
    g(t, parts.join("."))[key] = v;
  }

  /* 直拳：后手穿透拳 */
  function straightPunch(t, k, ctx, opt) {
    opt = opt || {};
    const hand = opt.hand || "R";
    const other = hand === "R" ? "L" : "R";
    const gh = G["arm" + hand], go = G["arm" + other];
    const sign = hand === "R" ? -1 : 1;
    const wind = E_OUT(ramp(k, 0, 0.30));
    const fire = E_OUT(ramp(k, 0.30, 0.46));
    const recoil = opt.hitAt != null ? bell(k, opt.hitAt, opt.hitAt + 0.03, opt.hitAt + 0.12, opt.hitAt + 0.22) : 0;
    const back = 1 - E_IO(ramp(k, 0.56, 1));

    set(t, "arm" + hand + ".sh.x", gh.sh.x + (-1.32 * fire + 0.34 * wind) * back - 0.25 * recoil);
    set(t, "arm" + hand + ".sh.y", (0.1 * wind - 0.12 * fire) * back);
    set(t, "arm" + hand + ".sh.z", gh.sh.z + 0.1 * fire * back);
    set(t, "arm" + hand + ".fa.x", gh.fa.x + (-1.15 * fire + 0.35 * wind) * back + 0.5 * recoil);
    set(t, "arm" + hand + ".hand.x", -0.15 * fire * back + 0.4 * recoil);
    set(t, "arm" + other + ".sh.x", go.sh.x + 0.18 * fire - 0.18 * fire * back);
    set(t, "arm" + other + ".fa.x", go.fa.x + 0.15 * fire);
    set(t, "torso.y", (-0.42 * wind + 0.85 * fire) * back * sign);
    set(t, "torso.x", 0.12 * fire * back);
    set(t, "head.y", (0.42 * wind - 0.5 * fire) * back * sign * 0.6);
    set(t, "neck.y", -(0.42 * wind - 0.5 * fire) * back * sign * 0.3);
    set(t, "legL.hip.x", 0.08 + (-0.1 * fire + 0.28 * wind) * back);
    set(t, "legR.hip.x", -0.06 + 0.34 * fire * back);
    set(t, "legR.knee.x", -0.1 - 0.28 * fire * back);
    set(t, "rootLean", 0.1 * fire * back - 0.05 * wind);
    set(t, "squash", 1 - 0.1 * wind * (1 - back) + 0.08 * recoil);
    set(t, "stretch", 1 + 0.12 * fire * back);
  }

  /* 摆掌：大弧线横扫 */
  function hookPunch(t, k, ctx, opt) {
    opt = opt || {};
    const hand = opt.hand || "R";
    const other = hand === "R" ? "L" : "R";
    const gh = G["arm" + hand], go = G["arm" + other];
    const sign = hand === "R" ? -1 : 1;
    const wind = E_OUT(ramp(k, 0, 0.34));
    const fire = E_OUT(ramp(k, 0.34, 0.52));
    const recoil = opt.hitAt != null ? bell(k, opt.hitAt, opt.hitAt + 0.03, opt.hitAt + 0.13, opt.hitAt + 0.24) : 0;
    const back = 1 - E_IO(ramp(k, 0.62, 1));
    set(t, "arm" + hand + ".sh.y", (1.15 * wind - 2.3 * fire) * back + 0.4 * recoil * sign);
    set(t, "arm" + hand + ".sh.x", gh.sh.x + (-0.5 * fire + 0.2 * wind) * back);
    set(t, "arm" + hand + ".fa.x", gh.fa.x + (-0.55 * fire + 0.25 * wind) * back + 0.35 * recoil);
    set(t, "arm" + other + ".sh.x", go.sh.x + 0.2 * fire);
    set(t, "torso.y", (-0.6 * wind + 1.0 * fire) * back * sign);
    set(t, "head.y", (0.5 * wind - 0.6 * fire) * back * sign * 0.5);
    set(t, "legL.hip.x", 0.08 + 0.2 * fire * back);
    set(t, "legR.hip.x", -0.06 - 0.24 * fire * back);
    set(t, "rootLean", 0.12 * fire * back);
    set(t, "squash", 1 - 0.1 * wind + 0.08 * recoil);
    set(t, "stretch", 1 + 0.1 * fire * back);
  }

  /* 拳：转腰伸臂、身体前压。脚几乎不动。 */
  function punchStrike(t, k, opt) {
    opt = opt || {};
    const p = opt.power == null ? 1 : opt.power;
    const wEnd = opt.wind == null ? 0.28 : opt.wind;
    const hEnd = opt.hit == null ? 0.46 : opt.hit;
    const wind = E_OUT(ramp(k, 0, wEnd));
    const fire = E_OUT(ramp(k, wEnd, hEnd));
    const recoil = opt.hitAt != null ? bell(k, opt.hitAt, opt.hitAt + 0.03, opt.hitAt + 0.11, opt.hitAt + 0.2) : 0;
    const back = 1 - E_IO(ramp(k, opt.rec == null ? 0.56 : opt.rec, 1));
    const yaw = opt.hook ? 1.15 : 0.85;
    set(t, "rootLean", (0.2 * fire - 0.08 * wind) * back * p);
    set(t, "stretch", 1 + 0.2 * fire * p * back);
    set(t, "squash", 1 - 0.03 * wind + 0.03 * fire * back + 0.05 * recoil);
    set(t, "torso.y", (-0.5 * wind + yaw * fire) * back * p * (opt.hook ? -1 : 1));
    set(t, "torso.x", (0.1 * fire - 0.06 * wind) * back);
    set(t, "armR.sh.x", G.armR.sh.x - (1.4 * fire - 0.45 * wind) * back * p - 0.2 * recoil);
    set(t, "armR.sh.y", (opt.hook ? 1.1 * wind - 1.8 * fire : 0.12 * wind - 0.28 * fire) * back);
    set(t, "armR.fa.x", G.armR.fa.x - 1.15 * fire * back * p + 0.4 * recoil);
    set(t, "armR.hand.x", -0.3 * fire * back);
    set(t, "armL.sh.x", G.armL.sh.x + 0.22 * fire);
    set(t, "armL.fa.x", G.armL.fa.x + 0.15 * fire);
    set(t, "head.y", (0.3 * wind - 0.4 * fire) * back);
    set(t, "legR.hip.x", 0.18 * fire * back);
    set(t, "legL.hip.x", 0.08 + 0.12 * wind * back);
    set(t, "legR.knee.x", -0.12);
  }

  /* 发波·火焰拳：双手聚气于胸前，后仰蓄焰，再整臂推出。 */
  function hadoukenCast(t, k, opt) {
    opt = opt || {};
    const p = opt.power == null ? 1 : opt.power;
    const gather = E_OUT(ramp(k, 0, 0.38));
    const release = E_OUT(ramp(k, 0.38, 0.58));
    const back = 1 - E_IO(ramp(k, 0.68, 1));
    set(t, "rootLean", (-0.22 * gather + 0.38 * release) * back * p);
    set(t, "stretch", 1 - 0.08 * gather + 0.22 * release * back);
    set(t, "squash", 1 - 0.1 * gather + 0.08 * release);
    set(t, "torso.x", (-0.28 * gather + 0.18 * release) * back);
    set(t, "torso.y", 0.45 * release * back * p);
    set(t, "armR.sh.x", G.armR.sh.x - (0.4 * gather + 1.55 * release) * back * p);
    set(t, "armR.fa.x", G.armR.fa.x - 0.35 * gather - 1.05 * release * back);
    set(t, "armL.sh.x", G.armL.sh.x - (0.55 * gather + 1.2 * release) * back);
    set(t, "armL.fa.x", G.armL.fa.x - 0.3 * gather - 0.85 * release * back);
    set(t, "armR.sh.z", G.armR.sh.z + 0.35 * gather - 0.15 * release);
    set(t, "armL.sh.z", G.armL.sh.z - 0.35 * gather + 0.15 * release);
    set(t, "head.x", 0.22 * gather - 0.18 * release);
    set(t, "legR.hip.x", 0.22 * release * back);
    set(t, "legL.hip.x", 0.12 * gather);
  }

  /* 发波·寒冰脚：抬膝聚霜，鞭腿甩出冰波。 */
  function iceKickCast(t, k, opt) {
    opt = opt || {};
    const p = opt.power == null ? 1 : opt.power;
    const chamber = E_OUT(ramp(k, 0, 0.36));
    const snap = E_OUT(ramp(k, 0.36, 0.55));
    const back = 1 - E_IO(ramp(k, 0.64, 1));
    set(t, "rootLean", (-0.32 * chamber + 0.22 * snap) * back * p);
    set(t, "stretch", 1 - 0.16 * chamber + 0.1 * snap);
    set(t, "squash", 1 - 0.08 * chamber + 0.1 * snap);
    set(t, "torso.x", (0.48 * snap - 0.18 * chamber) * back);
    set(t, "legR.hip.x", (-0.7 * chamber - 1.85 * snap) * back * p);
    set(t, "legR.knee.x", (1.25 * chamber - 1.15 * snap) * back);
    set(t, "legR.ankle.x", -0.3 * snap * back);
    set(t, "legL.hip.x", 0.28 * chamber);
    set(t, "armL.sh.z", G.armL.sh.z + 0.85 * snap * back);
    set(t, "armR.sh.z", G.armR.sh.z - 0.55 * snap * back);
    set(t, "armL.sh.x", G.armL.sh.x + 0.2 * chamber);
    set(t, "neck.x", -0.32 * snap * back);
    if (opt.sweep) {
      set(t, "squash", 0.8 + 0.08 * snap);
      set(t, "legR.hip.z", 0.7 * snap * back);
      set(t, "rootLean", 0.1 * snap);
    }
  }

  /* 踢：先仰身抬膝，再鞭打伸腿。手臂只做平衡，不做出拳。 */
  function kickStrike(t, k, opt) {
    opt = opt || {};
    const p = opt.power == null ? 1 : opt.power;
    const chamber = E_OUT(ramp(k, 0, 0.32));
    const snap = E_OUT(ramp(k, 0.32, 0.5));
    const recoil = opt.hitAt != null ? bell(k, opt.hitAt, opt.hitAt + 0.03, opt.hitAt + 0.12, opt.hitAt + 0.22) : 0;
    const back = 1 - E_IO(ramp(k, 0.58, 1));
    set(t, "rootLean", (-0.24 * chamber + 0.16 * snap) * back * p);
    set(t, "stretch", 1 - 0.14 * chamber + 0.06 * snap);
    set(t, "squash", 1 - 0.05 * chamber + 0.08 * snap - 0.04 * recoil);
    set(t, "torso.x", (0.42 * snap - 0.12 * chamber) * back);
    set(t, "torso.y", 0.12 * snap * back);
    set(t, "legR.hip.x", (-0.55 * chamber - 1.75 * snap) * back * p);
    set(t, "legR.knee.x", (1.15 * chamber - 1.05 * snap) * back);
    set(t, "legR.ankle.x", -0.25 * snap * back);
    set(t, "legL.hip.x", 0.22 * chamber);
    set(t, "legL.knee.x", -0.2 * chamber);
    set(t, "armL.sh.z", G.armL.sh.z + 0.7 * snap * back);
    set(t, "armR.sh.z", G.armR.sh.z - 0.45 * snap * back);
    set(t, "armL.sh.x", G.armL.sh.x + 0.15 * chamber);
    set(t, "armR.sh.x", G.armR.sh.x - 0.35 * snap * back);
    set(t, "neck.x", -0.28 * snap * back);
    if (opt.sweep) {
      set(t, "squash", 0.78 + 0.08 * snap);
      set(t, "rootLean", 0.12 * snap);
      set(t, "legR.hip.z", 0.85 * snap * back);
    }
    if (opt.stomp) {
      set(t, "rootLean", 0.28 * snap * back);
      set(t, "torso.x", 0.55 * snap * back);
    }
  }

  /* ================= 奶娃（凝胶宝宝） ================= */
  const NAIWA = {
    /* 黏黏拍·重推掌：短胖手臂也能打出穿透感
       蓄力后拉 → 全身前压弹射 → 手臂完全伸直 → 命中回弹 → 收 */
    punch(t, k, ctx) {
      const hand = "R", other = "L";
      const gh = G["armR"], go = G["armL"];
      const hitAt = ctx && ctx.hitAt;
      const wind = E_OUT(ramp(k, 0, 0.28));                       // 后拉蓄力
      const fire = E_OUT(ramp(k, 0.28, 0.44));                    // 弹射出手
      const recoil = hitAt != null ? bell(k, hitAt, hitAt + 0.03, hitAt + 0.11, hitAt + 0.2) : 0;
      const back = 1 - E_IO(ramp(k, 0.54, 1));

      // 出拳手：肩前推 + 肘完全伸直 + 掌面朝前
      set(t, "arm" + hand + ".sh.x", gh.sh.x - (1.15 * fire - 0.42 * wind) * back - 0.22 * recoil);
      set(t, "arm" + hand + ".sh.y", (0.18 * wind - 0.34 * fire) * back);
      set(t, "arm" + hand + ".sh.z", gh.sh.z - 0.28 * fire * back);
      set(t, "arm" + hand + ".fa.x", gh.fa.x - (1.25 * fire - 0.5 * wind) * back + 0.45 * recoil);
      set(t, "arm" + hand + ".hand.x", -0.35 * fire * back + 0.5 * recoil);
      // 另一只手护在胸前
      set(t, "arm" + other + ".sh.x", go.sh.x + 0.12 * fire);
      set(t, "arm" + other + ".fa.x", go.fa.x + 0.2 * fire);
      // 全身前压（凝胶体块整体前倾，冲击感更强）
      set(t, "torso.y", (-0.5 * wind + 1.0 * fire) * back * -1);
      set(t, "torso.x", (0.28 * fire - 0.1 * wind) * back);
      set(t, "head.y", (0.5 * wind - 0.62 * fire) * back * -0.6);
      set(t, "neck.y", -0.3 * wind * back * -0.6);
      set(t, "neck.x", -0.18 * fire * back);
      // 蹬地转髋
      set(t, "legL.hip.x", 0.08 + (-0.16 * fire + 0.3 * wind) * back);
      set(t, "legR.hip.x", -0.06 + 0.42 * fire * back);
      set(t, "legR.knee.x", -0.14 - 0.32 * fire * back);
      set(t, "legL.knee.x", -0.14 + 0.1 * fire * back);
      set(t, "rootLean", 0.16 * fire * back - 0.06 * wind);
      // 凝胶挤压：出拳瞬间被拉长，命中回弹时压扁
      set(t, "squash", 1 + 0.05 * wind - 0.06 * fire + 0.09 * recoil);
    },
    /* 旧肚皮顶：保留给 slam/throw 剪辑复用，重脚已改蹬踢 */
    kick(t, k, ctx) {
      const hitAt = ctx && ctx.hitAt;
      const crouch = E_OUT(ramp(k, 0, 0.3));
      const pop = E_OUT(ramp(k, 0.3, 0.46));
      const recoil = hitAt != null ? bell(k, hitAt, hitAt + 0.03, hitAt + 0.12, hitAt + 0.22) : 0;
      const back = 1 - E_IO(ramp(k, 0.58, 1));
      // 蹲压时整体压扁，弹射时拉长
      set(t, "squash", 1 - 0.3 * crouch + 0.24 * pop * back - 0.1 * recoil + 0.05 * recoil * Math.sin(k * 60));
      set(t, "torso.x", (0.62 * pop - 0.22 * crouch) * back - 0.12 * recoil);
      set(t, "neck.x", (-0.42 * pop + 0.2 * crouch) * back + 0.14 * recoil);
      set(t, "head.x", -0.24 * pop * back);
      // 双腿蹬地推髋
      set(t, "legL.hip.x", 0.42 * crouch - 0.72 * pop * back);
      set(t, "legR.hip.x", 0.42 * crouch - 0.72 * pop * back);
      set(t, "legL.knee.x", -0.62 * crouch + 0.24 * pop * back);
      set(t, "legR.knee.x", -0.62 * crouch + 0.24 * pop * back);
      set(t, "legL.ankle.x", -0.2 * crouch);
      set(t, "legR.ankle.x", -0.2 * crouch);
      // 双臂向两侧张开撑体块
      set(t, "armL.sh.z", G.armL.sh.z - 0.95 * pop * back);
      set(t, "armR.sh.z", G.armR.sh.z + 0.95 * pop * back);
      set(t, "armL.sh.x", G.armL.sh.x + 0.3 * crouch - 0.25 * pop * back);
      set(t, "armR.sh.x", G.armR.sh.x + 0.3 * crouch - 0.25 * pop * back);
      set(t, "armL.fa.x", G.armL.fa.x + 0.3 * pop);
      set(t, "armR.fa.x", G.armR.fa.x + 0.3 * pop);
      set(t, "rootLean", (0.28 * pop - 0.1 * crouch) * back);
    },
    /* 泰山压顶：深蹲 → 跃起抱膝 → 砸落 → 落地震颤 */
    skill(t, k) {
      const crouch = E_OUT(ramp(k, 0, 0.22));
      const up = E_OUT(ramp(k, 0.22, 0.42));
      const tuck = E_OUT(ramp(k, 0.4, 0.54));
      const slam = E_IN(ramp(k, 0.56, 0.74));
      const land = bell(k, 0.72, 0.8, 0.86, 0.96);
      set(t, "squash", 1 - 0.3 * crouch + 0.26 * up - 0.24 * slam + 0.18 * land - 0.05 * land * Math.sin(k * 70));
      // 抱膝：双腿收向腹部
      set(t, "legL.hip.x", 0.55 * crouch - 1.45 * slam - 0.9 * tuck);
      set(t, "legR.hip.x", 0.55 * crouch - 1.45 * slam - 0.9 * tuck);
      set(t, "legL.knee.x", -0.75 * crouch + 1.6 * slam + 1.5 * tuck);
      set(t, "legR.knee.x", -0.75 * crouch + 1.6 * slam + 1.5 * tuck);
      // 双臂先举后抱
      set(t, "armL.sh.x", G.armL.sh.x - 1.5 * up + 0.7 * slam + 0.9 * tuck);
      set(t, "armR.sh.x", G.armR.sh.x - 1.5 * up + 0.7 * slam + 0.9 * tuck);
      set(t, "armL.sh.z", G.armL.sh.z + 0.6 * up + 0.5 * tuck);
      set(t, "armR.sh.z", G.armR.sh.z - 0.6 * up - 0.5 * tuck);
      set(t, "armL.fa.x", G.armL.fa.x + 0.6 * tuck + 0.5 * slam);
      set(t, "armR.fa.x", G.armR.fa.x + 0.6 * tuck + 0.5 * slam);
      // 躯干：跃起时后仰，砸落时前折
      set(t, "torso.x", -0.28 * up - 0.35 * tuck + 0.75 * slam);
      set(t, "head.x", 0.26 * up - 0.5 * slam);
      set(t, "rootLean", 0.2 * slam - 0.08 * up);
      if (land > 0) set(t, "torso.z", Math.sin(k * 80) * 0.05 * land);
    },
    /* 超必：深吸气膨胀（定格）→ 仰天咆哮 → 六连震荡波 */
    super(t, k) {
      const inhale = E_OUT(ramp(k, 0, 0.13));                    // 吸气蓄力
      const roar = E_OUT(ramp(k, 0.13, 0.24));                   // 仰天爆发
      const ph = Math.min(0.999, Math.max(0, (k * 1.26 - 0.16) / 0.78));
      const idx = Math.floor(ph * 6);
      const hfresh = 1 - (ph * 6 - idx);                          // 每Hit瞬时脉冲
      const settle = E_OUT(ramp(k, 0.86, 1));
      const tremble = Math.sin(k * 96) * roar;
      set(t, "squash", 1 + 0.24 * inhale - 0.34 * roar + 0.06 * hfresh * roar - 0.05 * settle);
      set(t, "stretch", 1.04 - 0.12 * inhale + 0.2 * roar);
      // 仰头咆哮，双臂张开后撑
      set(t, "head.x", -0.55 * roar + 0.1 * inhale - 0.08 * settle);
      set(t, "neck.x", -0.4 * roar + 0.15 * inhale);
      set(t, "torso.x", 0.3 * inhale - 0.52 * roar + 0.18 * settle);
      set(t, "torso.y", tremble * 0.1 * roar);
      set(t, "torso.z", tremble * 0.08 * roar);
      set(t, "armL.sh.x", G.armL.sh.x + 0.5 * inhale - 1.7 * roar - 0.25 * hfresh * roar);
      set(t, "armR.sh.x", G.armR.sh.x + 0.5 * inhale - 1.7 * roar - 0.25 * hfresh * roar);
      set(t, "armL.sh.z", G.armL.sh.z - 0.5 * inhale - 0.75 * roar);
      set(t, "armR.sh.z", G.armR.sh.z + 0.5 * inhale + 0.75 * roar);
      set(t, "armL.fa.x", G.armL.fa.x + 0.4 * inhale - 0.6 * roar);
      set(t, "armR.fa.x", G.armR.fa.x + 0.4 * inhale - 0.6 * roar);
      // 马步蹬地 + 震颤
      set(t, "legL.hip.x", 0.42 * inhale + 0.18 * roar);
      set(t, "legR.hip.x", 0.42 * inhale + 0.18 * roar);
      set(t, "legL.knee.x", -0.65 * inhale - 0.2 * roar);
      set(t, "legR.knee.x", -0.65 * inhale - 0.2 * roar);
      set(t, "rootLean", -0.18 * roar + 0.12 * inhale);
    },
    lp(t, k) { hadoukenCast(t, k, { power: 0.7 }); },
    hp(t, k) { hadoukenCast(t, k, { power: 1.2 }); },
    lk(t, k) { iceKickCast(t, k, { power: 0.75 }); },
    hk(t, k) { iceKickCast(t, k, { power: 1.28 }); },
    crlp(t, k) { hadoukenCast(t, k, { power: 0.6 }); set(t, "squash", 0.82); set(t, "torso.x", 0.2); },
    crlk(t, k) { iceKickCast(t, k, { power: 0.9, sweep: true }); },
    crhp(t, k) { hadoukenCast(t, k, { power: 1.08 }); set(t, "rootLean", -0.3); },
    jlp(t, k) { hadoukenCast(t, k, { power: 0.72 }); set(t, "rootLean", 0.22); },
    jhk(t, k) { iceKickCast(t, k, { power: 1.1 }); set(t, "rootLean", 0.36); },
    skill2(t, k) {
      const crouch = E_OUT(ramp(k, 0, 0.1));       // 极短蹲蓄
      const rise = E_OUT(ramp(k, 0.08, 0.34));     // 爆发升腾
      const apex = bell(k, 0.3, 0.4, 0.52, 0.66);  // 顶点定格
      const fall = 1 - E_IO(ramp(k, 0.66, 1));     // 回落
      // 躯体：先压扁后拉长，顶点再收
      set(t, "squash", 1 - 0.16 * crouch + 0.1 * rise - 0.06 * apex);
      set(t, "stretch", 1.06 + 0.2 * rise - 0.08 * apex);
      // 起手后仰成升龙弧线
      set(t, "rootLean", -0.3 * crouch + 0.75 * rise - 0.2 * apex * fall);
      // 躯干扭转 + 后仰
      set(t, "torso.x", -0.2 * crouch - 0.6 * rise + 0.25 * apex);
      set(t, "torso.y", -0.35 * rise);
      // 升龙拳：右臂直冲云霄，肘完全伸直
      set(t, "armR.sh.x", G.armR.sh.x + 0.5 * crouch - 2.45 * rise);
      set(t, "armR.sh.y", -0.18 * rise);
      set(t, "armR.sh.z", G.armR.sh.z + 0.25 * rise);
      set(t, "armR.fa.x", G.armR.fa.x + 0.5 * crouch - 1.25 * rise);
      set(t, "armR.hand.x", -0.4 * rise);
      // 左臂护在体侧
      set(t, "armL.sh.x", G.armL.sh.x + 0.2 * crouch + 0.3 * rise);
      set(t, "armL.sh.z", G.armL.sh.z + 0.5 * rise);
      set(t, "armL.fa.x", G.armL.fa.x + 0.6 * rise);
      // 抬头看向拳锋
      set(t, "neck.x", -0.2 * crouch + 0.3 * rise - 0.15 * apex);
      set(t, "head.x", -0.2 * crouch - 0.35 * rise + 0.15 * apex);
      // 双腿：屈膝蹬地 → 伸直冲天 → 落地缓冲
      set(t, "legL.hip.x", 0.5 * crouch - 0.85 * rise + 0.5 * (1 - fall));
      set(t, "legR.hip.x", 0.5 * crouch - 0.55 * rise + 0.35 * (1 - fall));
      set(t, "legL.knee.x", -0.7 * crouch + 0.6 * rise);
      set(t, "legR.knee.x", -0.6 * crouch + 0.5 * rise);
    },
    throw(t, k) {
      const grab = E_OUT(ramp(k, 0, 0.35));
      const toss = E_OUT(ramp(k, 0.35, 0.7));
      set(t, "torso.x", 0.35 * grab - 0.2 * toss);
      set(t, "rootLean", 0.22 * grab);
      set(t, "squash", 1 - 0.08 * grab + 0.1 * toss);
      set(t, "stretch", 1.1);
      set(t, "armL.sh.x", G.armL.sh.x - 1.2 * grab);
      set(t, "armR.sh.x", G.armR.sh.x - 1.2 * grab);
    },

    /* ===== 终极必杀 · 壹「九转炎龙破」=====
       后仰蓄势（CG 侧拍）→ 九道龙炎左右臂交替连推（节拍同步）→ 收势 */
    ultra1(t, k) {
      const wind = E_OUT(ramp(k, 0, 0.11));                        // 0~0.175s 后仰
      const burst = E_OUT(ramp(k, 0.1, 0.17));
      const ph = Math.min(0.999, Math.max(0, (k * 1.59 - 0.15) / 1.08));
      const idx = Math.floor(ph * 9);
      const alt = idx % 2 === 0 ? 1 : -1;                          // 左右臂交替
      const hfresh = 1 - (ph * 9 - idx);                           // 每Hit出臂瞬间 1→0
      const strike = Math.pow(hfresh, 0.45);
      const settle = E_OUT(ramp(k, 0.88, 1));
      set(t, "squash", 1 - 0.16 * wind + 0.08 * burst - 0.05 * strike);
      set(t, "stretch", 1.02 + 0.17 * burst + 0.06 * strike);
      set(t, "rootLean", -0.3 * wind + 0.62 * burst - 0.1 * strike * 0.2 - 0.16 * settle);
      set(t, "rootSpin", alt * 0.1 * strike);
      set(t, "torso.x", 0.36 * wind - 0.3 * burst + 0.05 * strike);
      set(t, "torso.y", -0.2 * wind + alt * (0.34 * burst + 0.2 * strike) - 0.1 * settle);
      // 交替主推臂：出臂瞬间完全打直，随节拍衰减回弹
      const pushA = burst + strike * 0.55;
      const armEmphR = alt > 0 ? pushA : burst * 0.72;
      const armEmphL = alt < 0 ? pushA : burst * 0.72;
      set(t, "armR.sh.x", G.armR.sh.x + 0.55 * wind - 1.85 * armEmphR);
      set(t, "armR.fa.x", G.armR.fa.x + 0.5 * wind - 1.0 * armEmphR);
      set(t, "armL.sh.x", G.armL.sh.x + 0.55 * wind - 1.85 * armEmphL);
      set(t, "armL.fa.x", G.armL.fa.x + 0.5 * wind - 1.0 * armEmphL);
      set(t, "armR.sh.z", G.armR.sh.z + 0.24 * burst - (alt > 0 ? 0.12 : 0.3) * burst);
      set(t, "armL.sh.z", G.armL.sh.z - 0.24 * burst + (alt < 0 ? 0.12 : 0.3) * burst);
      set(t, "head.x", 0.22 * wind - 0.18 * burst);
      set(t, "neck.x", -0.15 * wind + 0.18 * burst);
      set(t, "legL.hip.x", 0.44 * wind - 0.5 * burst);
      set(t, "legR.hip.x", 0.36 * wind + 0.46 * burst);
      set(t, "legL.knee.x", -0.64 * wind + 0.32 * burst);
      set(t, "legR.knee.x", -0.52 * wind - 0.22 * burst);
    },

    /* ===== 终极必杀 · 贰「奶河焚天」=====
       高举聚乳定格（CG 贴地仰拍）→ 下劈 → 七连托天震荡 */
    ultra2(t, k) {
      const gather = E_OUT(ramp(k, 0, 0.16));                      // 高举聚能
      const hold = bell(k, 0.16, 0.24, 0.32, 0.4);                 // 顶点定格（仰拍机位）
      const chop = E_IN(ramp(k, 0.38, 0.48));
      const lift = E_OUT(ramp(k, 0.48, 0.58));
      const ph = Math.min(0.999, Math.max(0, (k * 1.54 - 0.28) / 0.92));
      const idx = Math.floor(ph * 7);
      const hfresh = 1 - (ph * 7 - idx);
      const quake = Math.pow(hfresh, 0.4) * lift;
      const end = E_OUT(ramp(k, 0.88, 1));
      set(t, "squash", 1 - 0.12 * gather + 0.14 * chop - 0.1 * lift + 0.05 * quake - 0.05 * end);
      set(t, "stretch", 1.04 + 0.16 * gather - 0.12 * chop + 0.24 * lift);
      set(t, "rootLean", -0.34 * (gather + hold) + 0.52 * chop - 0.46 * lift + 0.12 * end);
      set(t, "torso.x", -0.46 * (gather + hold) + 0.58 * chop - 0.52 * lift);
      set(t, "torso.y", 0.2 * gather - 0.1 * chop);
      // 合拢高举 → 下劈 → 托天（随七连震荡脉动）
      const up = 2.1 * gather + 0.3 * hold + 0.6 * chop + 2.5 * lift + 0.2 * quake;
      set(t, "armR.sh.x", G.armR.sh.x - up);
      set(t, "armL.sh.x", G.armL.sh.x - up);
      set(t, "armR.fa.x", G.armR.fa.x - 0.9 * gather - 0.5 * chop - 0.85 * lift - 0.15 * quake);
      set(t, "armL.fa.x", G.armL.fa.x - 0.9 * gather - 0.5 * chop - 0.85 * lift - 0.15 * quake);
      set(t, "armR.sh.z", G.armR.sh.z - 0.32 * gather + (0.5 + 0.1 * quake) * lift);
      set(t, "armL.sh.z", G.armL.sh.z + 0.32 * gather - (0.5 + 0.1 * quake) * lift);
      set(t, "head.x", -0.38 * gather + 0.32 * chop - 0.42 * lift);
      set(t, "neck.x", 0.22 * gather - 0.2 * chop + 0.32 * lift);
      set(t, "legL.hip.x", 0.52 * gather - 0.32 * chop - 0.34 * lift);
      set(t, "legR.hip.x", 0.52 * gather - 0.32 * chop - 0.34 * lift);
      set(t, "legL.knee.x", -0.72 * gather + 0.34 * lift);
      set(t, "legR.knee.x", -0.72 * gather + 0.34 * lift);
    },

    /* ===== 终极必杀 · 叁「炎帝临世」=====
       抱元深蹲 → 抱拳下压 → 双拳轰天定格（CG 极低位英雄机位）→ 八连威压震颤 */
    ultra3(t, k) {
      const coil = E_OUT(ramp(k, 0, 0.12));                        // 抱元下蹲
      const crush = E_IN(ramp(k, 0.14, 0.22));                     // 抱拳下压
      const rise = E_OUT(ramp(k, 0.24, 0.36));                     // 轰天
      const skyHold = bell(k, 0.34, 0.42, 0.52, 0.6);              // 冲天定格（英雄机位）
      const ph = Math.min(0.999, Math.max(0, (k * 1.9 - 0.34) / 1.18));
      const idx = Math.floor(ph * 8);
      const hfresh = 1 - (ph * 8 - idx);
      const reign = Math.pow(hfresh, 0.4) * E_OUT(ramp(k, 0.3, 0.38));
      const fall = E_OUT(ramp(k, 0.9, 1));
      set(t, "squash", 1 - 0.26 * coil - 0.12 * crush + 0.2 * rise + 0.06 * reign - 0.08 * fall);
      set(t, "stretch", 1.02 - 0.06 * coil + 0.28 * rise + 0.06 * skyHold);
      set(t, "rootLean", 0.24 * coil + 0.32 * crush - 0.6 * rise - 0.08 * skyHold + 0.12 * fall);
      set(t, "torso.x", 0.48 * coil + 0.32 * crush - 0.66 * rise - 0.12 * skyHold + 0.18 * reign);
      set(t, "torso.y", -0.16 * coil + 0.24 * rise + 0.1 * reign);
      // 抱于胸前 → 合拢下压 → 冲天定格 → 震颤
      const up = 0.9 * coil + 0.4 * crush + 2.75 * rise + 0.3 * skyHold - 0.15 * fall;
      set(t, "armR.sh.x", G.armR.sh.x - up);
      set(t, "armL.sh.x", G.armL.sh.x - up);
      set(t, "armR.sh.z", G.armR.sh.z - 0.58 * coil + 0.16 * rise + 0.06 * reign);
      set(t, "armL.sh.z", G.armL.sh.z + 0.58 * coil - 0.16 * rise - 0.06 * reign);
      set(t, "armR.fa.x", G.armR.fa.x - 0.72 * coil - 0.3 * crush - 0.92 * rise);
      set(t, "armL.fa.x", G.armL.fa.x - 0.72 * coil - 0.3 * crush - 0.92 * rise);
      set(t, "head.x", 0.32 * coil + 0.26 * crush - 0.5 * rise - 0.1 * skyHold);
      set(t, "neck.x", -0.26 * coil - 0.2 * crush + 0.38 * rise + 0.08 * skyHold);
      set(t, "legL.hip.x", 0.76 * coil + 0.22 * crush - 0.58 * rise);
      set(t, "legR.hip.x", 0.76 * coil + 0.22 * crush - 0.58 * rise);
      set(t, "legL.knee.x", -1.0 * coil + 0.54 * rise);
      set(t, "legR.knee.x", -1.0 * coil + 0.54 * rise);
    },
  };

  /* ================= 美鼠（袋鼠） ================= */
  const MEISHU = {
    /* 袋鼠刺拳：后手直拳 */
    punch(t, k, ctx) { straightPunch(t, k, ctx, { hand: "R", hitAt: ctx && ctx.hitAt }); },
    /* 袋鼠踢：尾撑地铲踢 */
    kick(t, k) {
      const lift = E_OUT(ramp(k, 0.1, 0.34));
      const snap = bell(k, 0.3, 0.42, 0.5, 0.62);
      const back = 1 - E_IO(ramp(k, 0.6, 1));
      set(t, "legR.hip.x", -1.9 * lift * back);
      set(t, "legR.knee.x", 0.9 * lift - 0.95 * snap);
      set(t, "legR.ankle.x", -0.3 * lift);
      set(t, "legL.knee.x", -0.25 * lift);
      set(t, "torso.x", 0.5 * lift * back);
      set(t, "neck.x", -0.35 * lift * back);
      set(t, "tail.t1.x", 0.1 - 0.9 * lift);
      set(t, "tail.t2.x", -0.5 * lift);
      set(t, "armL.sh.z", G.armL.sh.z + 0.75 * lift);
      set(t, "armR.sh.z", G.armR.sh.z - 0.6 * lift);
      set(t, "armR.sh.x", G.armR.sh.x - 0.7 * lift);
      set(t, "rootLean", -0.16 * lift * back);
      set(t, "squash", 1 - 0.06 * lift);
    },
    /* 旋风弹跳：蜷身旋转冲撞 */
    skill(t, k) {
      const crouch = bell(k, 0, 0.18, 0.26, 0.4);
      const spin = ramp(k, 0.16, 0.78);
      const land = bell(k, 0.74, 0.84, 0.9, 1);
      set(t, "squash", 1 - 0.22 * crouch + 0.14 * land);
      set(t, "legL.hip.x", -0.9 * spin); set(t, "legL.knee.x", 1.3 * spin);
      set(t, "legR.hip.x", -0.7 * spin); set(t, "legR.knee.x", 1.1 * spin);
      set(t, "armL.sh.x", G.armL.sh.x - 1.4 * spin); set(t, "armL.sh.z", 1.2 * spin);
      set(t, "armR.sh.x", G.armR.sh.x - 1.4 * spin); set(t, "armR.sh.z", -1.2 * spin);
      set(t, "torso.x", 0.35 * spin);
      set(t, "tail.t1.x", 0.1 - 0.7 * spin);
      set(t, "rootSpin", spin * Math.PI * 4);
      set(t, "rootLean", 0.25 * spin);
    },
    skillAir(t, k) {
      set(t, "rootSpin", ramp(k, 0, 1) * Math.PI * 4);
      set(t, "legL.hip.x", -0.8); set(t, "legR.hip.x", -0.6);
      set(t, "legL.knee.x", 1.0); set(t, "legR.knee.x", 0.9);
      set(t, "armL.sh.x", G.armL.sh.x - 1.4); set(t, "armR.sh.x", G.armR.sh.x - 1.4);
      set(t, "torso.x", 0.5);
      set(t, "rootLean", 0.4);
    },
    /* 必杀·暴走尾旋：八连转升龙（尾鞭节拍同步 + 收尾甩尾亮相） */
    super(t, k) {
      const rise = E_OUT(ramp(k, 0.06, 0.3));
      const spin = ramp(k, 0.1, 0.72);
      const fall = 1 - E_IO(ramp(k, 0.72, 1));
      const pose = E_OUT(ramp(k, 0.82, 0.96));                    // 收尾亮相
      const spinAng = spin * Math.PI * 8;
      const whip = Math.sin(spinAng * 0.5) * rise;                // 每圈尾鞭相位
      set(t, "rootSpin", spinAng - pose * 0.6);
      set(t, "rootLean", 0.3 * rise * fall - 0.12 * pose);
      set(t, "legL.hip.x", -1.5 * rise * fall + 0.3 * pose); set(t, "legL.knee.x", 0.3 * rise);
      set(t, "legR.hip.x", -1.2 * rise * fall - 0.25 * pose); set(t, "legR.knee.x", 0.4 * rise);
      set(t, "armL.sh.x", G.armL.sh.x - 1.2 * rise * fall - 1.6 * pose);
      set(t, "armL.sh.z", (1.5 * rise - 1.1 * pose) * fall);
      set(t, "armR.sh.x", G.armR.sh.x - 1.2 * rise * fall - 0.5 * pose);
      set(t, "armR.sh.z", -1.5 * rise * fall + 1.35 * pose);
      set(t, "armL.fa.x", G.armL.fa.x - 0.5 * pose);
      // 尾鞭：随旋转反向抽打，亮相时甩向前
      set(t, "tail.t1.x", 0.1 - 1.1 * rise * fall - 0.5 * whip);
      set(t, "tail.t2.y", whip * 0.9 + 0.3 * pose);
      set(t, "tail.t2.x", -0.3 * whip - 0.35 * pose);
      set(t, "tail.t3.y", -whip * 0.7);
      set(t, "head.y", whip * 0.2);
      set(t, "squash", 1 - 0.1 * bell(k, 0, 0.08, 0.14, 0.24) + 0.08 * rise * fall + 0.06 * pose);
    },
    lp(t, k, ctx) { punchStrike(t, k, { power: 0.5, wind: 0.2, hit: 0.38, rec: 0.5, hitAt: ctx && ctx.hitAt }); },
    hp(t, k, ctx) { punchStrike(t, k, { power: 1.05, wind: 0.26, hit: 0.44, hitAt: ctx && ctx.hitAt }); },
    lk(t, k, ctx) {
      kickStrike(t, k, { power: 0.75, hitAt: ctx && ctx.hitAt });
      set(t, "tail.t1.x", 0.1 - 0.35);
    },
    hk(t, k, ctx) {
      kickStrike(t, k, { power: 1.3, stomp: true, hitAt: ctx && ctx.hitAt });
      set(t, "tail.t1.x", 0.1 - 0.95);
      set(t, "tail.t2.x", -0.45);
    },
    crlp(t, k, ctx) {
      punchStrike(t, k, { power: 0.48, wind: 0.18, hit: 0.36, hitAt: ctx && ctx.hitAt });
      set(t, "squash", 0.8); set(t, "torso.x", 0.2);
    },
    crlk(t, k, ctx) { kickStrike(t, k, { power: 0.95, sweep: true, hitAt: ctx && ctx.hitAt }); },
    crhp(t, k, ctx) {
      punchStrike(t, k, { power: 1.0, wind: 0.24, hit: 0.42, hitAt: ctx && ctx.hitAt });
      set(t, "rootLean", -0.32); set(t, "torso.x", -0.4); set(t, "armR.sh.x", G.armR.sh.x - 2.0);
    },
    jlp(t, k, ctx) { punchStrike(t, k, { power: 0.6, wind: 0.16, hit: 0.4, hitAt: ctx && ctx.hitAt }); set(t, "rootLean", 0.22); },
    jhk(t, k, ctx) { kickStrike(t, k, { power: 1.15, stomp: true, hitAt: ctx && ctx.hitAt }); set(t, "rootLean", 0.45); },
    skill2(t, k) {
      const rise = E_OUT(ramp(k, 0.04, 0.32));
      set(t, "rootSpin", 0);
      set(t, "rootLean", -0.18 + 0.72 * rise);
      set(t, "squash", 1 - 0.06 * rise);
      set(t, "stretch", 1.14);
      set(t, "torso.x", -0.5 * rise);
      set(t, "armR.sh.x", G.armR.sh.x - 2.1 * rise);
      set(t, "armR.fa.x", G.armR.fa.x - 1.0 * rise);
      set(t, "legR.hip.x", -1.55 * rise);
      set(t, "legR.knee.x", 0.35 * rise);
      set(t, "tail.t1.x", 0.1 - 0.7 * rise);
    },
    throw(t, k) {
      const grab = E_OUT(ramp(k, 0, 0.3));
      const toss = E_OUT(ramp(k, 0.3, 0.72));
      set(t, "torso.x", 0.4 * grab); set(t, "rootLean", 0.18 * grab);
      set(t, "squash", 1 - 0.1 * grab + 0.12 * toss);
      set(t, "stretch", 1.08);
      set(t, "armL.sh.x", G.armL.sh.x - 1.15 * grab);
      set(t, "armR.sh.x", G.armR.sh.x - 1.15 * grab);
      set(t, "tail.t1.x", 0.1 - 0.8 * toss);
    },

    /* ===== 终极必杀 · 壹「紫渊吞噬」=====
       侧身沉肩（CG 越肩机位）→ 单手撕裂虚空 → 七连交替抓握吞噬（节拍同步） */
    ultra1(t, k) {
      const sink = E_OUT(ramp(k, 0, 0.12));                        // 沉肩蓄势
      const tear = E_OUT(ramp(k, 0.12, 0.22));                     // 撕裂
      const ph = Math.min(0.999, Math.max(0, (k * 1.56 - 0.17) / 0.98));
      const idx = Math.floor(ph * 7);
      const alt = idx % 2 === 0 ? 1 : -1;
      const hfresh = 1 - (ph * 7 - idx);
      const grab = Math.pow(hfresh, 0.45);                         // 每次抓握 1→0
      const close = E_OUT(ramp(k, 0.88, 1));
      set(t, "squash", 1 - 0.15 * sink + 0.08 * tear - 0.06 * grab);
      set(t, "stretch", 1.03 + 0.14 * tear + 0.05 * grab);
      set(t, "rootLean", 0.24 * sink - 0.44 * tear + 0.14 * grab - 0.08 * close);
      set(t, "rootSpin", -0.24 * sink + 0.32 * tear + alt * 0.08 * grab);
      set(t, "torso.x", 0.3 * sink - 0.26 * tear + 0.08 * grab);
      set(t, "torso.y", -0.36 * sink + 0.52 * tear + alt * 0.24 * grab - 0.12 * close);
      // 撕裂臂 + 交替抓握（五指开合）
      const claw = grab * 0.16 * Math.sin(ph * 7 * Math.PI);
      set(t, "armR.sh.x", G.armR.sh.x + 0.4 * sink - 1.95 * tear - grab * 0.3 - claw);
      set(t, "armR.sh.z", G.armR.sh.z + 0.5 * sink - 0.25 * tear + alt * 0.12 * grab);
      set(t, "armR.fa.x", G.armR.fa.x + 0.4 * sink - 0.88 * tear - grab * 0.2);
      set(t, "armR.hand.x", -0.55 * tear + 0.25 * grab + claw);
      // 后手随节拍平衡
      set(t, "armL.sh.x", G.armL.sh.x + 0.7 * sink + 0.3 * tear + grab * 0.18 * alt);
      set(t, "armL.sh.z", G.armL.sh.z + 0.6 * sink + 0.3 * grab - alt * 0.15 * grab);
      set(t, "head.y", 0.26 * sink - 0.2 * tear - alt * 0.1 * grab);
      set(t, "neck.x", 0.18 * sink - 0.22 * tear);
      set(t, "legL.hip.x", 0.5 * sink - 0.4 * tear);
      set(t, "legR.hip.x", 0.36 * sink + 0.3 * tear);
      set(t, "legL.knee.x", -0.72 * sink + 0.3 * tear);
      set(t, "legR.knee.x", -0.55 * sink - 0.15 * tear);
      set(t, "tail.t1.x", 0.1 - 0.5 * sink - 0.5 * grab);
      set(t, "tail.t2.x", 0.12 - 0.36 * sink + alt * 0.14 * grab);
      set(t, "tail.t2.y", alt * 0.3 * grab);
    },

    /* ===== 终极必杀 · 贰「暗星陨灭」=====
       单臂指天召唤定格（CG 仰拍追星）→ 猛力下压 → 六连陨落威压 */
    ultra2(t, k) {
      const call = E_OUT(ramp(k, 0, 0.15));                        // 指天召唤
      const hold2 = bell(k, 0.15, 0.22, 0.3, 0.36);                // 顶点定格（仰拍）
      const tremble = Math.sin(k * 88) * hold2;
      const slam = E_IN(ramp(k, 0.36, 0.45));                      // 下压
      const ph = Math.min(0.999, Math.max(0, (k * 1.68 - 0.32) / 1.02));
      const idx = Math.floor(ph * 6);
      const hfresh = 1 - (ph * 6 - idx);
      const reign = Math.pow(hfresh, 0.4) * E_OUT(ramp(k, 0.4, 0.46));
      set(t, "squash", 1 - 0.08 * call + 0.16 * slam - 0.06 * reign);
      set(t, "stretch", 1.05 + 0.2 * call - 0.14 * slam + tremble * 0.02);
      set(t, "rootLean", -0.36 * (call + hold2 * 0.4) + 0.58 * slam - 0.14 * reign);
      set(t, "torso.x", -0.42 * call + 0.52 * slam - 0.22 * reign);
      set(t, "torso.y", 0.26 * call + 0.14 * slam * Math.sin(k * 44) * 0.24);
      // 右臂指天 → 下压；左臂护体
      set(t, "armR.sh.x", G.armR.sh.x - 2.65 * call - 0.45 * hold2 + 1.0 * slam + 0.35 * reign);
      set(t, "armR.fa.x", G.armR.fa.x - 1.05 * call - 0.45 * slam - 0.2 * reign);
      set(t, "armR.sh.z", G.armR.sh.z - 0.22 * call + 0.34 * slam);
      set(t, "armL.sh.x", G.armL.sh.x + 0.55 * call + 0.45 * slam + 0.2 * reign);
      set(t, "armL.sh.z", G.armL.sh.z + 0.6 * call - 0.24 * slam);
      set(t, "head.x", -0.4 * call + 0.36 * slam - 0.2 * reign);
      set(t, "neck.x", 0.26 * call - 0.22 * slam + 0.22 * reign);
      set(t, "legL.hip.x", 0.46 * call - 0.32 * slam - 0.28 * reign);
      set(t, "legR.hip.x", 0.46 * call - 0.32 * slam - 0.28 * reign);
      set(t, "legL.knee.x", -0.64 * call + 0.28 * reign);
      set(t, "legR.knee.x", -0.64 * call + 0.28 * reign);
      set(t, "tail.t1.x", 0.1 - 0.75 * call + 0.38 * slam - 0.15 * reign);
      set(t, "tail.t2.x", 0.12 - 0.55 * call + 0.28 * slam);
      set(t, "tail.t3.x", 0.1 - 0.38 * call + 0.18 * slam);
    },

    /* ===== 终极必杀 · 叁「虚空王座」=====
       张臂登基悬浮（CG 正面对称缓推）→ 合十裁决 → 八连坍缩震颤 */
    ultra3(t, k, ctx) {
      const throne = E_OUT(ramp(k, 0, 0.15));                      // 张臂登基
      const float = E_OUT(ramp(k, 0.08, 0.3));                     // 离地悬浮
      const clasp = E_OUT(ramp(k, 0.28, 0.36));                    // 合十
      const ph = Math.min(0.999, Math.max(0, (k * 1.98 - 0.34) / 1.22));
      const idx = Math.floor(ph * 8);
      const hfresh = 1 - (ph * 8 - idx);
      const judge = Math.pow(hfresh, 0.4) * E_OUT(ramp(k, 0.3, 0.38));
      const collapse = E_OUT(ramp(k, 0.85, 1));
      const descend = 1 - E_OUT(ramp(k, 0.85, 1));                 // 落回地面
      /* body.y 是绝对基准（base.bodyY），悬浮要叠加而不是覆盖 */
      const baseY = ctx && ctx.anim && ctx.anim.base ? ctx.anim.base.bodyY : 0.55;
      set(t, "body.y", baseY + 0.34 * float * descend);            // 王座悬浮
      set(t, "squash", 1 - 0.12 * throne - 0.06 * clasp + 0.1 * judge - 0.07 * collapse);
      set(t, "stretch", 1.07 + 0.17 * throne + 0.09 * judge);
      set(t, "rootLean", -0.14 * throne - 0.32 * clasp + 0.26 * judge - 0.12 * collapse);
      set(t, "rootSpin", 0.18 * throne - 0.12 * clasp + Math.sin(k * 30) * 0.05 * judge);
      set(t, "torso.x", -0.18 * throne - 0.42 * clasp + 0.32 * judge + 0.1 * float);
      set(t, "torso.y", 0.38 * throne - 0.22 * clasp + 0.1 * judge);
      // 双臂展开成王座 → 合十上举 → 下压裁决
      const up = 1.15 * throne + 1.95 * clasp + 0.72 * judge - 0.42 * collapse;
      set(t, "armR.sh.x", G.armR.sh.x - up);
      set(t, "armL.sh.x", G.armL.sh.x - up);
      set(t, "armR.sh.z", G.armR.sh.z - 1.05 * throne + 0.22 * clasp + 0.5 * judge);
      set(t, "armL.sh.z", G.armL.sh.z + 1.05 * throne - 0.22 * clasp - 0.5 * judge);
      set(t, "armR.fa.x", G.armR.fa.x - 0.42 * throne - 0.85 * clasp - 0.32 * judge);
      set(t, "armL.fa.x", G.armL.fa.x - 0.42 * throne - 0.85 * clasp - 0.32 * judge);
      set(t, "head.x", -0.26 * throne + 0.32 * clasp - 0.24 * judge - 0.12 * float);
      set(t, "neck.x", 0.22 * throne - 0.26 * clasp + 0.26 * judge);
      // 悬浮收腿：盘坐姿态
      set(t, "legL.hip.x", 0.36 * throne - 0.34 * clasp - 0.24 * judge - 1.15 * float * descend);
      set(t, "legR.hip.x", 0.36 * throne - 0.34 * clasp - 0.24 * judge - 1.0 * float * descend);
      set(t, "legL.knee.x", -0.5 * throne + 0.3 * judge + 1.7 * float * descend);
      set(t, "legR.knee.x", -0.5 * throne + 0.3 * judge + 1.55 * float * descend);
      set(t, "tail.t1.x", 0.1 - 0.65 * throne + 0.22 * clasp - 0.5 * float * descend);
      set(t, "tail.t2.x", 0.12 - 0.48 * throne + 0.2 * clasp - 0.3 * float * descend);
      set(t, "tail.t3.x", 0.1 - 0.32 * throne);
    },
  };

  const COMMON = {
    /* 蓄力姿态：双手在身前合拢聚能，全身绷紧微颤 */
    charge(t, k, ctx) {
      const g2 = E_OUT(Math.min(1, k * 8));
      const lv = (ctx && ctx.anim && ctx.anim.chargeLv) || 0;
      const tremble = Math.sin(k * 90) * 0.02;
      // 双腿下沉扎马
      set(t, "legL.hip.x", 0.08 + 0.28 * g2); set(t, "legR.hip.x", -0.06 + 0.28 * g2);
      set(t, "legL.knee.x", -0.14 - 0.42 * g2); set(t, "legR.knee.x", -0.1 - 0.42 * g2);
      set(t, "legL.hip.z", 0.06 + 0.16 * g2); set(t, "legR.hip.z", -0.06 - 0.16 * g2);
      // 躯干后坐，双手向前合拢
      set(t, "torso.x", 0.16 * g2);
      set(t, "torso.y", -0.22 * g2 * 0.5);
      set(t, "rootLean", -0.14 * g2 + tremble * lv);
      set(t, "armL.sh.x", G.armL.sh.x - 1.25 * g2 - 0.25 * lv);
      set(t, "armR.sh.x", G.armR.sh.x - 1.25 * g2 - 0.25 * lv);
      set(t, "armL.sh.z", G.armL.sh.z - 0.42 * g2);
      set(t, "armR.sh.z", G.armR.sh.z + 0.42 * g2);
      set(t, "armL.fa.x", G.armL.fa.x - 0.5 * g2 + 0.3 * lv);
      set(t, "armR.fa.x", G.armR.fa.x - 0.5 * g2 + 0.3 * lv);
      // 头微低，凝视前方
      set(t, "neck.x", -0.12 * g2);
      set(t, "head.x", 0.1 * g2);
      // 蓄力越满，躯体越膨胀
      set(t, "squash", 1 - 0.1 * g2 + 0.06 * lv + tremble * lv * 2);
      set(t, "stretch", 1 + 0.05 * lv);
    },
    block(t, k) {
      const g2 = E_OUT(Math.min(1, k * 6));
      set(t, "torso.y", -0.5 * g2); set(t, "head.y", 0.35 * g2); set(t, "neck.y", -0.2 * g2);
      set(t, "armL.sh.x", G.armL.sh.x - 0.3 * g2); set(t, "armL.sh.z", G.armL.sh.z - 0.3 * g2);
      set(t, "armL.fa.x", 1.7 * g2 + G.armL.fa.x * (1 - g2));
      set(t, "armR.sh.x", G.armR.sh.x - 0.3 * g2); set(t, "armR.sh.z", G.armR.sh.z + 0.45 * g2);
      set(t, "armR.fa.x", 1.8 * g2 + G.armR.fa.x * (1 - g2));
      set(t, "squash", 1 - 0.05 * g2);
      set(t, "legL.hip.x", 0.12 * g2); set(t, "legR.hip.x", -0.1 * g2);
    },
    hurt(t, k, ctx) {
      const g2 = E_OUT(Math.min(1, k * 5)) * (1 - E_IN(ramp(k, 0.6, 1)));
      set(t, "torso.x", -0.45 * g2);
      set(t, "torso.z", Math.sin(k * 30) * 0.08 * g2);
      set(t, "neck.x", 0.4 * g2); set(t, "head.x", -0.5 * g2);
      set(t, "armL.sh.x", G.armL.sh.x + 0.9 * g2); set(t, "armL.sh.z", G.armL.sh.z + 0.5 * g2);
      set(t, "armR.sh.x", G.armR.sh.x + 0.9 * g2); set(t, "armR.sh.z", G.armR.sh.z - 0.5 * g2);
      set(t, "rootLean", -0.18 * g2);
      set(t, "squash", 1 - 0.1 * g2);
      if (ctx && ctx.big) {
        set(t, "legL.hip.x", -0.5 * g2); set(t, "legR.hip.x", -0.3 * g2);
        set(t, "rootSpin", g2 * 1.2);
      }
    },
    ko(t, k) {
      const fall = E_IN(Math.min(1, k * 1.4));
      set(t, "torso.x", -0.5 * fall); set(t, "torso.z", 0.15 * fall);
      set(t, "head.x", -0.6 * fall);
      set(t, "armL.sh.x", G.armL.sh.x + 1.5 * fall); set(t, "armL.sh.z", G.armL.sh.z + 0.9 * fall);
      set(t, "armR.sh.x", G.armR.sh.x + 1.5 * fall); set(t, "armR.sh.z", G.armR.sh.z - 0.9 * fall);
      set(t, "legL.hip.x", 0.6 * fall); set(t, "legR.hip.x", -0.4 * fall);
      set(t, "legL.knee.x", 0.8 * fall); set(t, "legR.knee.x", 0.5 * fall);
      set(t, "rootLean", -1.35 * fall);
      set(t, "squash", 1 - 0.12 * bell(k, 0.55, 0.65, 0.72, 0.85));
    },
    win(t, k, ctx) {
      const bob = Math.sin(k * Math.PI * 4);
      set(t, "armL.sh.x", G.armL.sh.x - 1.9 + 0.15 * bob); set(t, "armL.sh.z", 0.52);
      set(t, "armR.sh.x", G.armR.sh.x - 1.9 - 0.15 * bob); set(t, "armR.sh.z", -0.52);
      set(t, "torso.x", -0.08 + 0.05 * bob);
      set(t, "head.y", Math.sin(k * Math.PI * 2) * 0.3);
      set(t, "squash", 1 + 0.06 * bob);
      if (ctx && ctx.tail) set(t, "tail.t1.x", -0.4 - 0.3 * bob);
    },
    dash(t, k) {
      const g2 = bell(k, 0, 0.3, 0.6, 1);
      set(t, "squash", 1 - 0.16 * g2);
      set(t, "torso.x", 0.4 * g2); set(t, "rootLean", 0.2 * g2);
      set(t, "legL.hip.x", -0.5 * g2); set(t, "legR.hip.x", 0.5 * g2);
      set(t, "armL.sh.x", G.armL.sh.x + 0.7 * g2); set(t, "armR.sh.x", G.armR.sh.x - 0.7 * g2);
    },
    crouch(t, k) {
      const g2 = E_OUT(Math.min(1, k * 8));
      set(t, "squash", 1 - 0.18 * g2);
      set(t, "torso.x", 0.22 * g2);
      set(t, "legL.hip.x", 0.45 * g2); set(t, "legR.hip.x", 0.45 * g2);
      set(t, "legL.knee.x", -0.7 * g2); set(t, "legR.knee.x", -0.7 * g2);
    },
  };

  NV.NAIWA = NAIWA;
  NV.MEISHU = MEISHU;
  NV.COMMON = COMMON;
  NV.straightPunch = straightPunch;
  NV.hookPunch = hookPunch;
  NV.clipFor = function (id, kind) {
    const lib = id === "naiwa" ? NAIWA : MEISHU;
    const alias = { punch: "hp", kick: "hk" };
    return lib[kind] || lib[alias[kind]] || COMMON[kind] || null;
  };
})(window.NV);
