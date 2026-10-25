/* ============================================================
   混元 GLB 接入：按网格包围盒落地、缩放到格斗身高。
   · GLB 为无骨骼静态雕塑（约 81 万顶点 + 3 张内嵌大贴图），
     因此接入时压缩贴图尺寸，避免显存爆掉导致 WebGL 上下文丢失（黑屏）。
   ============================================================ */
(function (NV) {
  "use strict";
  const T = NV;
  const MAX_TEX = 512;   // 4K 贴图压到 512，避免两套精模把 GPU 卡死

  /* 把过大的贴图缩到 maxSize，返回新贴图（不需要则返回原贴图） */
  function shrinkTexture(tex, maxSize) {
    if (!tex || !tex.image) return tex;
    const img = tex.image;
    const w = img.width || img.naturalWidth || 0;
    const h = img.height || img.naturalHeight || 0;
    if (!w || !h) return tex;
    const big = Math.max(w, h);
    if (big <= maxSize) return tex;
    try {
      const scale = maxSize / big;
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, cw, ch);
      const nt = new THREE.CanvasTexture(c);
      nt.colorSpace = tex.colorSpace;
      nt.flipY = tex.flipY;
      nt.wrapS = tex.wrapS;
      nt.wrapT = tex.wrapT;
      nt.anisotropy = tex.anisotropy;
      nt.needsUpdate = true;
      if (tex.dispose) tex.dispose();
      return nt;
    } catch (e) {
      return tex;
    }
  }

  T.optimizeGlbTextures = function (object, maxSize) {
    const lim = maxSize || MAX_TEX;
    const slots = ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "specularMap", "alphaMap"];
    const cache = new Map();
    object.traverse(function (o) {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (!m) continue;
        for (let k = 0; k < slots.length; k++) {
          const s = slots[k];
          if (!m[s]) continue;
          let nt = cache.get(m[s]);
          if (!nt) { nt = shrinkTexture(m[s], lim); cache.set(m[s], nt); }
          if (nt !== m[s]) { m[s] = nt; }
        }
        m.needsUpdate = true;
      }
    });
  };

  T.describeGlb = function (object) {
    let meshes = 0, verts = 0, mats = {};
    object.traverse(function (o) {
      if (!o.isMesh) return;
      meshes++;
      const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (pos) verts += pos.count;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (!m) continue;
        ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap"].forEach(function (s) {
          if (m[s]) mats[s] = (mats[s] || 0) + 1;
        });
      }
    });
    return { meshes: meshes, vertices: verts, maps: mats };
  };

  function dummyArm() {
    const sh = new THREE.Group();
    const fa = new THREE.Group();
    const hand = new THREE.Group();
    sh.add(fa);
    fa.add(hand);
    return { sh: sh, fa: fa, hand: hand };
  }
  function dummyLeg() {
    const hip = new THREE.Group();
    const knee = new THREE.Group();
    const ankle = new THREE.Group();
    hip.add(knee);
    knee.add(ankle);
    return { hip: hip, knee: knee, ankle: ankle };
  }

  function meshBox(object) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3();
    let has = false;
    object.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      box.expandByObject(o);
      has = true;
    });
    if (!has) box.setFromObject(object);
    return box;
  }

  T.wrapGlbObject = function (object, kind, opts) {
    opts = opts || {};
    const height = opts.height || 1.62;
    const box = meshBox(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(0.001, size.y);

    const inner = new THREE.Group();
    inner.add(object);
    inner.position.set(-center.x, -box.min.y, -center.z);

    const holder = new THREE.Group();
    holder.add(inner);
    holder.scale.setScalar(scale);
    if (opts.yaw) holder.rotation.y = opts.yaw;

    const mats = {};
    let mi = 0;
    object.traverse(function (o) {
      if (!o.isMesh) return;
      o.frustumCulled = true;
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.geometry) {
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      }
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (!m) continue;
        mats["m" + (mi++)] = m;
        m.side = THREE.FrontSide;
        if (m.map && "colorSpace" in THREE) m.map.colorSpace = THREE.SRGBColorSpace;
        if (m.emissiveMap && "colorSpace" in THREE) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        m.envMapIntensity = 0.4;
        if (m.roughness == null) m.roughness = 0.48;
        if (m.metalness == null) m.metalness = 0.05;
        if (m.clearcoat != null) m.clearcoat = 0;
        if (m.specularIntensity != null) m.specularIntensity = Math.min(m.specularIntensity, 0.25);
        if (m.specularColor && m.specularColor.setRGB) m.specularColor.setRGB(0.18, 0.18, 0.18);
      }
    });

    const root = new THREE.Group();
    root.userData.kind = kind;
    const bodyG = new THREE.Group();
    root.add(bodyG);
    const torso = new THREE.Group();
    torso.position.y = 0.74;
    bodyG.add(torso);

    const visual = new THREE.Group();
    visual.position.y = -0.74;
    visual.add(holder);
    torso.add(visual);

    const neck = new THREE.Group();
    neck.position.set(0, 0.76, 0.02);
    torso.add(neck);
    const head = new THREE.Group();
    neck.add(head);

    const armL = dummyArm();
    const armR = dummyArm();
    const legL = dummyLeg();
    const legR = dummyLeg();
    torso.add(armL.sh, armR.sh, legL.hip, legR.hip);

    const tailRoot = new THREE.Group();
    const t1 = new THREE.Group();
    const t2 = new THREE.Group();
    const t3 = new THREE.Group();
    tailRoot.add(t1); t1.add(t2); t2.add(t3);
    torso.add(tailRoot);

    root.userData.height = height;
    const model = {
      root: root,
      bones: {
        body: bodyG, torso: torso, neck: neck, head: head,
        armL: armL, armR: armR, legL: legL, legR: legR,
        tail: { root: tailRoot, t1: t1, t2: t2, t3: t3 },
        visual: visual,
      },
      mats: mats,
      idle: { bodyY: 0, torsoY: 0.74, torsoX: 0, neckX: 0 },
      kind: kind,
      fromGlb: true,
    };
    T.attachFightLimbs(model, kind === "naiwa" ? "#E3C257" : "#F7C41D");
    return model;
  };

  function parseGlb(url, onProgress) {
    return new Promise(function (resolve, reject) {
      if (!THREE.GLTFLoader) {
        reject(new Error("缺少 GLTFLoader"));
        return;
      }
      const loader = new THREE.GLTFLoader();
      loader.load(url, function (gltf) {
        resolve(gltf.scene || gltf.scenes[0]);
      }, onProgress, reject);
    });
  }

  T.loadGlbFighter = function (url, kind, opts) {
    opts = opts || {};
    return parseGlb(url, opts.onProgress).then(function (scene) {
      // 关键：先压缩内嵌大贴图，再包装（避免 4K 贴图×6 撑爆显存）
      if (opts.optimize !== false) T.optimizeGlbTextures(scene, opts.maxTex || MAX_TEX);
      const model = T.wrapGlbObject(scene, kind, opts);
      model.glbInfo = T.describeGlb(scene);
      return model;
    });
  };
})(window.NV);
