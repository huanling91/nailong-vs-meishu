/* ============================================================
   AAA 氛围舞台：
   - 三层视差（远景原画 / 中景剪影 / 前景波景深粒子）
   - 体积光轴 + 大气辉光 + 地平线光带
   - 地面纹章 / 边缘暗角 / 舞台专属动态（闪电 / 霓虹 / 云海 / 热浪 / 飘云）
   ============================================================ */
(function (T) {
  T.STAGES = [
    {
      id: "duel",
      name: "赤月绝壁",
      pano: "assets/bg-duel.jpg?v=2k1",
      fog: 0x2a0810, bg: 0x12040a,
      hemiSky: "#ff8a6a", hemiGround: "#2a0a12",
      key: 0xff7040, rim: 0xff2244, fill: 0xffaa66,
      exposure: 1.12, groundFrac: 0.08, fx: "sparks",
      floorTint: 0x3a2018, dust: 0xff6a40,
      shafts: { n: 5, color: 0xff6a48, op: 0.16 },
      emblem: 0xff8855,
    },
    {
      id: "peak",
      name: "云海天阶",
      pano: "assets/bg-peak.jpg?v=2k1",
      fog: 0x1a2438, bg: 0x0c1828,
      hemiSky: "#c8e0ff", hemiGround: "#1a2830",
      key: 0xffe0b0, rim: 0x88c8ff, fill: 0xaad0ff,
      exposure: 1.16, groundFrac: 0.07, fx: "mist",
      floorTint: 0x4a5560, dust: 0xd8eeff,
      shafts: { n: 6, color: 0xbfe0ff, op: 0.15 },
      emblem: 0x9cc8ff,
    },
    {
      id: "forge",
      name: "熔岩锻场",
      pano: "assets/bg-forge.jpg?v=2k1",
      fog: 0x2a0a04, bg: 0x120604,
      hemiSky: "#ff7a40", hemiGround: "#2a0c06",
      key: 0xff6a22, rim: 0xff2208, fill: 0xffaa44,
      exposure: 1.08, groundFrac: 0.1, fx: "embers",
      floorTint: 0x4a2210, dust: 0xff5a18,
      shafts: { n: 4, color: 0xff8a3a, op: 0.15 },
      emblem: 0xffa050,
    },
    {
      id: "street",
      name: "雨巷霓虹",
      pano: "assets/bg-street.jpg?v=2k1",
      fog: 0x081018, bg: 0x060812,
      hemiSky: "#66d0ff", hemiGround: "#0a1018",
      key: 0x44ddff, rim: 0xff44aa, fill: 0x8866ff,
      exposure: 1.05, groundFrac: 0.09, fx: "rain",
      floorTint: 0x1a2430, dust: 0x88ddff,
      shafts: { n: 4, color: 0x5ad0ff, op: 0.12 },
      emblem: 0x66d8ff,
    },
    {
      id: "temple",
      name: "樱庭神社",
      pano: "assets/bg-temple.jpg?v=2k1",
      fog: 0x2a140c, bg: 0x1a0c08,
      hemiSky: "#ffc090", hemiGround: "#2a1810",
      key: 0xffb070, rim: 0xff6a8a, fill: 0xffaa66,
      exposure: 1.2, groundFrac: 0.09, fx: "petals",
      floorTint: 0x5a3a28, dust: 0xffc8d8,
      shafts: { n: 6, color: 0xffc9a0, op: 0.17 },
      emblem: 0xffb890,
    },
  ];

  T.stageById = function (id) {
    for (let i = 0; i < T.STAGES.length; i++) if (T.STAGES[i].id === id) return T.STAGES[i];
    return T.STAGES[0];
  };

  /* ---------- 程序化贴图 ---------- */
  function makeTex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // 体积光束：横向柔边 + 纵向衰减
  function beamTexture() {
    return makeTex(128, 512, function (g) {
      let grd = g.createLinearGradient(0, 0, 128, 0);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.5, "rgba(255,255,255,0.9)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 128, 512);
      g.globalCompositeOperation = "destination-in";
      grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, "rgba(255,255,255,0.95)");
      grd.addColorStop(0.55, "rgba(255,255,255,0.5)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 128, 512);
    });
  }

  // 雨丝：竖向柔线
  function streakTexture() {
    return makeTex(32, 128, function (g) {
      const grd = g.createLinearGradient(0, 6, 0, 122);
      grd.addColorStop(0, "rgba(255,255,255,0)");
      grd.addColorStop(0.25, "rgba(255,255,255,0.9)");
      grd.addColorStop(0.75, "rgba(255,255,255,0.9)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.strokeStyle = grd; g.lineWidth = 7; g.lineCap = "round";
      g.beginPath(); g.moveTo(16, 8); g.lineTo(16, 120); g.stroke();
    });
  }

  // 中性白纹章（可按舞台着色）
  function sigilTexture() {
    return makeTex(512, 512, function (g) {
      g.translate(256, 256);
      g.strokeStyle = "rgba(255,255,255,0.95)";
      g.lineWidth = 7;
      g.beginPath(); g.arc(0, 0, 232, 0, 6.2832); g.stroke();
      g.lineWidth = 2.5;
      g.beginPath(); g.arc(0, 0, 196, 0, 6.2832); g.stroke();
      g.beginPath(); g.arc(0, 0, 118, 0, 6.2832); g.stroke();
      // 内四角菱形
      for (let i = 0; i < 4; i++) {
        g.save(); g.rotate(i * Math.PI / 2);
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(0, -160); g.lineTo(26, -134); g.lineTo(0, -108); g.lineTo(-26, -134);
        g.closePath(); g.stroke();
        g.restore();
      }
      // 外圈刻度
      g.lineWidth = 6;
      for (let i = 0; i < 36; i++) {
        g.save(); g.rotate(i * Math.PI / 18);
        const long = i % 3 === 0;
        g.beginPath(); g.moveTo(0, -232); g.lineTo(0, long ? -204 : -220); g.stroke();
        g.restore();
      }
    });
  }

  // 横向黑色渐隐（fadeDir=1 左实右虚，-1 镜像）
  function fadeTexture(dir) {
    return makeTex(256, 128, function (g) {
      const grd = g.createLinearGradient(0, 0, 256, 0);
      const a = "rgba(0,0,0,", b = "rgba(0,0,0,0)";
      if (dir > 0) { grd.addColorStop(0, a + "1)"); grd.addColorStop(1, b); }
      else { grd.addColorStop(0, b); grd.addColorStop(1, a + "1)"); }
      // 纵向也柔一点
      g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
      g.globalCompositeOperation = "destination-in";
      const v = g.createLinearGradient(0, 0, 0, 128);
      v.addColorStop(0, "rgba(255,255,255,0.25)");
      v.addColorStop(0.35, "rgba(255,255,255,1)");
      v.addColorStop(1, "rgba(255,255,255,0.25)");
      g.fillStyle = v; g.fillRect(0, 0, 256, 128);
    });
  }

  /* 从原画派生中景剪影层：模糊 + 压暗，制造纵深 */
  function midFromArt(img) {
    const w = Math.min(1024, img.naturalWidth || img.width);
    const h = Math.max(220, Math.round(w * 0.42));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const ih = img.naturalHeight || img.height;
    const sy = ih * 0.34, sh = ih - sy;
    let filtered = false;
    try {
      if (typeof g.filter === "string") {
        g.filter = "blur(12px) brightness(0.44) saturate(1.3) contrast(1.15)";
        filtered = true;
      }
    } catch (e) {}
    if (filtered) {
      g.drawImage(img, 0, sy, img.naturalWidth || w, sh, 0, 0, w, h);
      g.filter = "none";
    } else {
      // 老内核兜底：先缩小再放大近似模糊
      const t = document.createElement("canvas");
      t.width = Math.max(8, w >> 3); t.height = Math.max(6, h >> 3);
      const tg = t.getContext("2d");
      tg.drawImage(img, 0, sy, img.naturalWidth || w, sh, 0, 0, t.width, t.height);
      g.imageSmoothingEnabled = true;
      g.drawImage(t, 0, 0, t.width, t.height, 0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, 0, w, h);
    }
    // 顶部渐隐，别遮死远景
    g.globalCompositeOperation = "destination-in";
    const fade = g.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, "rgba(255,255,255,0)");
    fade.addColorStop(0.42, "rgba(255,255,255,0.85)");
    fade.addColorStop(1, "rgba(255,255,255,1)");
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(c);
    if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  T.buildArena = function (scene, renderer, stageId) {
    const half = T.STAGE_HALF;
    const current = { spec: T.stageById(stageId || "duel") };
    const anim = [];

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const polishTex = function (tex, sharp) {
      if (!tex) return tex;
      if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
      else tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = maxAniso;
      if (sharp) {
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
      } else {
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
      }
      tex.needsUpdate = true;
      return tex;
    };

    /* ============ 远景层（视差 0.06，由 game.js 驱动） ============ */
    const panoMat = new THREE.MeshBasicMaterial({
      toneMapped: false, depthWrite: false, fog: false,
    });
    const pano = new THREE.Mesh(new THREE.PlaneGeometry(24, 15.3), panoMat);
    pano.renderOrder = -20;
    scene.add(pano);

    /* ============ 中景剪影层（视差 0.38） ============ */
    const midMat = new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, fog: false, toneMapped: false,
    });
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(40, 8.8), midMat);
    mid.position.set(0, 1.9, -5.4);
    mid.renderOrder = -12;
    scene.add(mid);

    /* ============ 地面 ============ */
    const floorMat = new THREE.MeshStandardMaterial({
      roughness: 0.8, metalness: 0.12, envMapIntensity: 0.32,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 10, 14), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    function layoutPano(spec, aspect) {
      const ar = aspect || (16 / 9);
      const h = 12.4;
      const w = h * ar;
      pano.geometry.dispose();
      pano.geometry = new THREE.PlaneGeometry(w, h);
      const g = spec.groundFrac == null ? 0.08 : spec.groundFrac;
      pano.position.set(pano.position.x, h * (0.5 - g), -9.4);
    }

    function floorFromArt(img, spec) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = Math.max(160, Math.round(h * 0.4));
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      const gFrac = spec.groundFrac == null ? 0.08 : spec.groundFrac;
      const sy = Math.max(0, h * (1 - Math.max(0.22, gFrac + 0.14)));
      g.drawImage(img, 0, sy, w, h - sy, 0, 0, c.width, c.height);
      const fade = g.createLinearGradient(0, 0, 0, c.height);
      fade.addColorStop(0, "rgba(0,0,0,0.22)");
      fade.addColorStop(0.35, "rgba(0,0,0,0.04)");
      fade.addColorStop(1, "rgba(0,0,0,0.38)");
      g.fillStyle = fade;
      g.fillRect(0, 0, c.width, c.height);
      const tex = new THREE.CanvasTexture(c);
      polishTex(tex);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(1.15, 1);
      return tex;
    }

    function setArt(spec) {
      const img = new Image();
      img.onload = function () {
        const tex = new THREE.Texture(img);
        polishTex(tex, true);
        if (panoMat.map && panoMat.map.dispose) panoMat.map.dispose();
        panoMat.map = tex;
        panoMat.needsUpdate = true;
        if (floorMat.map && floorMat.map.dispose) floorMat.map.dispose();
        floorMat.map = floorFromArt(img, spec);
        floorMat.color.setHex(0xffffff);
        floorMat.needsUpdate = true;
        if (midMat.map && midMat.map.dispose) midMat.map.dispose();
        midMat.map = midFromArt(img);
        midMat.needsUpdate = true;
        layoutPano(spec, img.width / Math.max(1, img.height));
      };
      img.src = spec.pano;
    }

    /* 尽头半透明暗角 */
    const veilMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide,
    });
    for (const x of [-half - 0.4, half + 0.4]) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 8), veilMat);
      v.position.set(x, 3.2, 0.4);
      scene.add(v);
    }

    /* ============ 体积光轴 ============ */
    const beamTex = beamTexture();
    const shaftGroup = new THREE.Group();
    shaftGroup.position.set(0, 0, -6.4);
    shaftGroup.renderOrder = -9;
    scene.add(shaftGroup);
    const shafts = [];
    const SHAFT_N = 6;
    for (let i = 0; i < SHAFT_N; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 12.5),
        new THREE.MeshBasicMaterial({
          map: beamTex, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
        })
      );
      const k = i / (SHAFT_N - 1);
      m.position.set(-6.4 + k * 12.8 + (i % 2 ? 0.7 : -0.5), 5.4, -0.3 - (i % 3) * 0.4);
      m.rotation.z = (i % 2 ? 1 : -1) * (0.22 + 0.1 * (i % 3));
      shaftGroup.add(m);
      shafts.push(m);
    }

    /* ============ 大气辉光（地平线上方两团呼吸光） ============ */
    const atmo = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(17, 8),
        new THREE.MeshBasicMaterial({
          map: T.fxTextures.dot, transparent: true, opacity: 0.08,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
        })
      );
      m.position.set(i ? 4.6 : -4.6, 2.6, -6.9);
      m.renderOrder = -8;
      scene.add(m);
      atmo.push(m);
    }

    /* ============ 地平线光带（远处地面辉光） ============ */
    const horizonGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(38, 2.6),
      new THREE.MeshBasicMaterial({
        map: T.fxTextures.dot, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })
    );
    horizonGlow.rotation.x = -Math.PI / 2;
    horizonGlow.position.set(0, 0.05, -6.2);
    scene.add(horizonGlow);

    /* ============ 地面光斑（近景双色） ============ */
    const glowGeo = new THREE.PlaneGeometry(6.4, 6.4);
    const glowA = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
      color: 0xff8844, transparent: true, opacity: 0.07, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    glowA.rotation.x = -Math.PI / 2;
    glowA.position.set(-4.2, 0.02, 0.6);
    scene.add(glowA);
    const glowB = glowA.clone();
    glowB.material = glowA.material.clone();
    glowB.material.color.setHex(0x44ccff);
    glowB.position.set(4.6, 0.02, 0.4);
    scene.add(glowB);

    /* ============ 中央纹章 ============ */
    const emblem = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4),
      new THREE.MeshBasicMaterial({
        map: sigilTexture(), transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      })
    );
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.set(0, 0.032, 0);
    scene.add(emblem);

    /* ============ 地面两端渐隐（舞台更暗、更聚焦） ============ */
    const fadeL = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 18),
      new THREE.MeshBasicMaterial({ map: fadeTexture(1), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })
    );
    fadeL.rotation.x = -Math.PI / 2;
    fadeL.position.set(-half - 2.6, 0.07, 0);
    scene.add(fadeL);
    const fadeR = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 18),
      new THREE.MeshBasicMaterial({ map: fadeTexture(-1), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })
    );
    fadeR.rotation.x = -Math.PI / 2;
    fadeR.position.set(half + 2.6, 0.07, 0);
    scene.add(fadeR);

    /* ============ 雨巷霓虹招牌 ============ */
    const neonGroup = new THREE.Group();
    neonGroup.visible = false;
    scene.add(neonGroup);
    const neonTex = makeTex(64, 160, function (g) {
      g.strokeStyle = "rgba(255,255,255,0.95)";
      g.lineWidth = 7;
      g.strokeRect(10, 10, 44, 140);
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(18, 120); g.lineTo(32, 34); g.lineTo(46, 120); g.closePath(); g.stroke();
    });
    const neons = [];
    [[-6.4, 3.4, 0x44e0ff], [-2.6, 4.3, 0xff4ad0], [6.8, 2.9, 0xffb044]].forEach(function (cfg, i) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 1.55),
        new THREE.MeshBasicMaterial({
          map: neonTex, transparent: true, opacity: 0.8,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
        })
      );
      m.material.color.setHex(cfg[2]);
      m.position.set(cfg[0], cfg[1], -8.7);
      neonGroup.add(m);
      neons.push({ mesh: m, seed: i * 3.7 + 1.2, base: cfg[2] });
    });

    /* ============ 赤月飘云 / 云海天阶 ============ */
    const driftClouds = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(17, 3.4),
        new THREE.MeshBasicMaterial({
          map: T.fxTextures.smoke, color: 0x160509, transparent: true, opacity: 0.34,
          depthWrite: false, toneMapped: false, fog: false,
        })
      );
      m.position.set(0, 5.2 - i * 1.3, -8.5);
      m.visible = false;
      m.userData = { speed: 0.22 + i * 0.14, off: i * 17 };
      scene.add(m);
      driftClouds.push(m);
    }
    const seaClouds = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 2.8 - i * 0.5),
        new THREE.MeshBasicMaterial({
          map: T.fxTextures.smoke, color: 0xdfeaf6, transparent: true, opacity: 0.2 - i * 0.045,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
        })
      );
      m.position.set((i - 1) * 3.4, 0.55 + i * 0.34, -6.4 - i * 0.7);
      m.visible = false;
      m.userData = { speed: 0.1 + i * 0.07, off: i * 11, phase: i * 2.1 };
      scene.add(m);
      seaClouds.push(m);
    }

    /* ============ 熔岩地底辉光 ============ */
    const forgeLight = new THREE.PointLight(0xff5a18, 0, 9, 1.8);
    forgeLight.position.set(0, 0.5, -1.4);
    scene.add(forgeLight);

    /* ============ 天气粒子（主层） ============ */
    const FX_N = 130;
    const weatherGeo = new THREE.BufferGeometry();
    const wpos = new Float32Array(FX_N * 3);
    const wvel = [];
    const wseed = new Float32Array(FX_N);
    function scatterWeather(kind) {
      for (let i = 0; i < FX_N; i++) {
        wpos[i * 3] = (Math.random() - 0.5) * 22;
        wpos[i * 3 + 1] = Math.random() * 8;
        wpos[i * 3 + 2] = -4 + Math.random() * 7;
        wseed[i] = Math.random() * 6.28;
        if (kind === "rain") wvel[i] = [0.55 + Math.random() * 0.3, -10.5 - Math.random() * 5, 0];
        else if (kind === "embers" || kind === "sparks") wvel[i] = [(Math.random() - 0.5) * 0.6, 1.1 + Math.random() * 1.9, 0];
        else if (kind === "petals") wvel[i] = [0.8 + Math.random() * 0.6, -0.55 - Math.random() * 0.5, 0];
        else wvel[i] = [(Math.random() - 0.5) * 0.25, 0.12 + Math.random() * 0.1, 0];
      }
      weatherGeo.attributes.position.needsUpdate = true;
    }
    weatherGeo.setAttribute("position", new THREE.BufferAttribute(wpos, 3));
    const weatherMat = new THREE.PointsMaterial({
      size: 0.07, color: 0xffe8c8, transparent: true, opacity: 0.42,
      map: T.fxTextures.dot, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const weather = new THREE.Points(weatherGeo, weatherMat);
    scene.add(weather);
    let weatherKind = "mist";
    scatterWeather("mist");

    /* ============ 前景波景深粒子（近相机大光斑） ============ */
    const BK_N = 26;
    const bokehGeo = new THREE.BufferGeometry();
    const bpos = new Float32Array(BK_N * 3);
    const bseed = new Float32Array(BK_N);
    for (let i = 0; i < BK_N; i++) {
      bpos[i * 3] = (Math.random() - 0.5) * 18;
      bpos[i * 3 + 1] = Math.random() * 5.4;
      bpos[i * 3 + 2] = 2.4 + Math.random() * 1.6;
      bseed[i] = Math.random() * 6.28;
    }
    bokehGeo.setAttribute("position", new THREE.BufferAttribute(bpos, 3));
    const bokehMat = new THREE.PointsMaterial({
      size: 0.7, color: 0xffe8c8, transparent: true, opacity: 0.085,
      map: T.fxTextures.dot, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const bokeh = new THREE.Points(bokehGeo, bokehMat);
    scene.add(bokeh);

    /* ============ 熔岩热浪（缓慢上升的暖雾） ============ */
    const HT_N = 16;
    const heatGeo = new THREE.BufferGeometry();
    const hpos = new Float32Array(HT_N * 3);
    const hseed = new Float32Array(HT_N);
    for (let i = 0; i < HT_N; i++) {
      hpos[i * 3] = (Math.random() - 0.5) * 16;
      hpos[i * 3 + 1] = Math.random() * 3;
      hpos[i * 3 + 2] = -2 + Math.random() * 3;
      hseed[i] = Math.random() * 6.28;
    }
    heatGeo.setAttribute("position", new THREE.BufferAttribute(hpos, 3));
    const heatMat = new THREE.PointsMaterial({
      size: 1.5, color: 0xff7a30, transparent: true, opacity: 0.13,
      map: T.fxTextures.heat, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const heat = new THREE.Points(heatGeo, heatMat);
    heat.visible = false;
    scene.add(heat);

    /* ---------- 灯光 ---------- */
    const hemi = new THREE.HemisphereLight(current.spec.hemiSky, current.spec.hemiGround, 0.62);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(current.spec.key, 1.15);
    key.position.set(3.4, 8.2, 5.2);
    key.castShadow = false;
    scene.add(key);
    const rim = new THREE.DirectionalLight(current.spec.rim, 0.55);
    rim.position.set(-5.4, 4.2, -4);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(current.spec.fill, 0.28);
    fill.position.set(0, 2.2, 8);
    scene.add(fill);

    const mkSpot = function (x, color) {
      const s = new THREE.SpotLight(color, 10, 16, 0.5, 0.7, 1.4);
      s.position.set(x, 6.2, 2.4);
      s.target.position.set(x * 0.65, 0.4, 0);
      scene.add(s, s.target);
      return s;
    };
    const spotL = mkSpot(-3.2, 0xffd0a0);
    const spotR = mkSpot(3.2, 0xffe8c8);

    const follow = [];
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(i ? 0xffd27a : 0xfff0c8, 2.6, 3.6, 2);
      l.position.set(i ? 1.9 : -1.9, 1.2, 0.9);
      scene.add(l);
      follow.push(l);
    }

    const shadows = [];
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: T.fxTextures.shadow, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false,
      }));
      s.rotation.x = -Math.PI / 2;
      s.position.set(i ? 1.9 : -1.9, 0.02, 0);
      scene.add(s);
      shadows.push(s);
    }

    /* ---------- 闪电状态（雨巷） ---------- */
    let boltNext = 4 + Math.random() * 6, boltT = 0, boltSeq = 0;

    function applySpec(spec) {
      current.spec = spec;
      scene.background = new THREE.Color(spec.bg);
      scene.fog = new THREE.Fog(spec.fog, 36, 78);
      renderer.toneMappingExposure = spec.exposure;
      hemi.color.set(spec.hemiSky);
      hemi.groundColor.set(spec.hemiGround);
      key.color.setHex(spec.key);
      rim.color.setHex(spec.rim);
      fill.color.setHex(spec.fill);
      spotL.color.setHex(spec.key);
      spotR.color.setHex(spec.fill);
      glowA.material.color.setHex(spec.key);
      glowB.material.color.setHex(spec.rim);
      horizonGlow.material.color.setHex(spec.key);
      emblem.material.color.setHex(spec.emblem || spec.fill);
      atmo[0].material.color.setHex(spec.rim);
      atmo[1].material.color.setHex(spec.key);
      follow[0].color.setHex(spec.fill);
      follow[1].color.setHex(spec.key);
      const sc = (spec.shafts || {});
      for (let i = 0; i < shafts.length; i++) {
        shafts[i].material.color.setHex(sc.color || spec.rim);
        shafts[i].visible = i < (sc.n || 5);
      }
      const isRain = spec.id === "street";
      neonGroup.visible = isRain;
      driftClouds.forEach(function (m) { m.visible = spec.id === "duel"; });
      seaClouds.forEach(function (m) { m.visible = spec.id === "peak"; });
      heat.visible = spec.id === "forge";
      forgeLight.visible = spec.id === "forge";
      forgeLight.color.setHex(spec.dust || 0xff5a18);
      heatMat.color.setHex(spec.dust || 0xff5a18);
      boltNext = 3 + Math.random() * 6;
      boltT = 0;
      /* 从雷雨舞台切走时，闪电的提亮必须复位 */
      panoMat.color.setRGB(1, 1, 1);
      hemi.intensity = 0.62;
      setArt(spec);
      weatherKind = spec.fx || "mist";
      scatterWeather(weatherKind);
      if (weather.material.map && weather.material.map !== T.fxTextures.dot &&
          weather.material.map !== T.fxTextures.ember &&
          weather.material.map !== T.fxTextures.milk &&
          weather.material.map !== T.fxTextures.smoke) {
        weather.material.map.dispose();
      }
      weather.material.color.setHex(spec.dust || 0xffe8c8);
      if (weatherKind === "rain") {
        weather.material.map = streakTexture();
        weather.material.size = 0.46;
        weather.material.opacity = 0.4;
      } else if (weatherKind === "embers" || weatherKind === "sparks") {
        weather.material.map = T.fxTextures.ember;
        weather.material.size = 0.13;
        weather.material.opacity = 0.75;
      } else if (weatherKind === "petals") {
        weather.material.map = T.fxTextures.milk;
        weather.material.size = 0.2;
        weather.material.opacity = 0.6;
      } else {
        weather.material.map = T.fxTextures.smoke;
        weather.material.size = 1.05;
        weather.material.opacity = 0.11;
      }
      weather.material.needsUpdate = true;
      bokehMat.color.setHex(spec.dust || 0xffe8c8);
    }

    applySpec(current.spec);

    /* ============ 每帧氛围动画 ============ */
    anim.push(function (t, dt) {
      const d = dt || 0.016;
      const spec = current.spec;

      /* 体积光轴呼吸 */
      const sop = (spec.shafts && spec.shafts.op) || 0.15;
      for (let i = 0; i < shafts.length; i++) {
        const m = shafts[i];
        if (!m.visible) continue;
        m.material.opacity = sop * (0.7 + 0.3 * Math.sin(t * 0.5 + i * 1.3));
        const s = 1 + 0.06 * Math.sin(t * 0.35 + i * 2.1);
        m.scale.set(s, 1, 1);
      }

      /* 大气辉光 / 地平线光带 / 纹章 */
      for (let i = 0; i < atmo.length; i++) {
        atmo[i].material.opacity = 0.075 + 0.045 * Math.sin(t * 0.33 + i * 2.4);
      }
      horizonGlow.material.opacity = 0.13 + 0.06 * Math.sin(t * 0.9 + 1.2);
      emblem.material.opacity = 0.085 + 0.035 * Math.sin(t * 0.6);
      emblem.rotation.z += d * 0.05;

      /* 灯光呼吸 + 探照灯缓摆 */
      key.intensity = 1.15 * (1 + 0.05 * Math.sin(t * 0.8));
      rim.intensity = 0.55 * (1 + 0.08 * Math.sin(t * 0.5 + 1.4));
      spotL.target.position.x = -2.1 + Math.sin(t * 0.26) * 0.9;
      spotR.target.position.x = 2.1 + Math.sin(t * 0.31 + 2) * 0.9;

      /* 霓虹闪烁 */
      if (neonGroup.visible) {
        for (let i = 0; i < neons.length; i++) {
          const n = neons[i];
          let o = 0.66 + 0.3 * Math.sin(t * 2.2 + n.seed * 4);
          const drop = Math.sin(t * 13.7 + n.seed * 7) * Math.sin(t * 3.1 + n.seed);
          if (drop > 0.88) o *= 0.12;
          n.mesh.material.opacity = o;
        }
      }

      /* 赤月飘云横移 */
      for (let i = 0; i < driftClouds.length; i++) {
        if (!driftClouds[i].visible) continue;
        const u = driftClouds[i].userData;
        driftClouds[i].position.x = ((t * u.speed + u.off) % 36) - 18;
      }
      /* 云海翻涌 */
      for (let i = 0; i < seaClouds.length; i++) {
        if (!seaClouds[i].visible) continue;
        const u = seaClouds[i].userData;
        seaClouds[i].position.x = ((t * u.speed + u.off) % 26) - 13;
        seaClouds[i].material.opacity = (0.16 - i * 0.035) * (0.8 + 0.25 * Math.sin(t * 0.4 + u.phase));
      }
      /* 熔岩地底脉动 */
      if (forgeLight.visible) {
        forgeLight.intensity = 1.5 + 0.85 * Math.sin(t * 2.2) + 0.3 * Math.sin(t * 5.7);
        const ha = heatGeo.attributes.position.array;
        for (let i = 0; i < HT_N; i++) {
          ha[i * 3 + 1] += (0.32 + 0.2 * Math.sin(hseed[i])) * d;
          ha[i * 3] += Math.sin(t * 0.8 + hseed[i]) * 0.12 * d;
          if (ha[i * 3 + 1] > 3.4) {
            ha[i * 3 + 1] = 0.1;
            ha[i * 3] = (Math.random() - 0.5) * 16;
          }
        }
        heatGeo.attributes.position.needsUpdate = true;
        heatMat.opacity = 0.11 + 0.05 * Math.sin(t * 1.7);
      }

      /* 闪电（雨巷）：双闪 + 曝光/半球/全景提亮 */
      if (spec.id === "street") {
        if (boltT <= 0 && t > boltNext) { boltT = 0.34; boltSeq = 0; boltNext = t + 5 + Math.random() * 9; }
        if (boltT > 0) {
          boltT -= d;
          const ph = 0.34 - boltT;
          let e = 0;
          if (ph < 0.08) e = 1 - ph / 0.08;
          else if (ph < 0.13) e = 0.25;
          else if (ph < 0.22) e = 0.3 + (ph - 0.13) / 0.09 * 0.7;
          else e = Math.max(0, 0.95 - (ph - 0.22) / 0.12);
          boltSeq = e;
          hemi.intensity = 0.62 + e * 1.6;
          panoMat.color.setRGB(1 - e * 0.4, 1 - e * 0.22, 1);
          renderer.toneMappingExposure = spec.exposure + e * 0.32;
          weatherMat.opacity = 0.4 + e * 0.35;
        } else if (boltSeq !== 0) {
          boltSeq = 0;
          hemi.intensity = 0.62;
          panoMat.color.setRGB(1, 1, 1);
          renderer.toneMappingExposure = spec.exposure;
          weatherMat.opacity = 0.4;
        }
      }

      /* 主天气粒子 */
      const arr = weatherGeo.attributes.position.array;
      const petalGust = 0.7 + 0.5 * Math.sin(t * 0.21) + (Math.sin(t * 0.05) > 0.55 ? 1.5 : 0);
      for (let i = 0; i < FX_N; i++) {
        const vx = weatherKind === "petals" ? wvel[i][0] * petalGust : wvel[i][0];
        arr[i * 3] += vx * d;
        arr[i * 3 + 1] += wvel[i][1] * d;
        if (weatherKind === "petals") arr[i * 3] += Math.sin(t * 1.4 + wseed[i]) * 0.012;
        if (weatherKind === "embers" || weatherKind === "sparks") arr[i * 3] += Math.sin(t * 2.1 + wseed[i]) * 0.2 * d;
        if (arr[i * 3 + 1] < 0.05) {
          arr[i * 3 + 1] = (weatherKind === "embers" || weatherKind === "sparks") ? 0.1 : 7.6;
          arr[i * 3] = (Math.random() - 0.5) * 22;
        }
        if (arr[i * 3 + 1] > 8.2) arr[i * 3 + 1] = 0.12;
        if (arr[i * 3] > 12) arr[i * 3] = -12;
        if (arr[i * 3] < -12) arr[i * 3] = 12;
      }
      weatherGeo.attributes.position.needsUpdate = true;
      if (weatherKind === "mist") weatherMat.opacity = 0.09 + 0.03 * Math.sin(t * 0.7);
      else if (weatherKind !== "rain") weatherMat.opacity = (weatherKind === "petals" ? 0.6 : 0.75) * (0.85 + 0.15 * Math.sin(t * 1.3));

      /* 前景波光斑：极缓慢漂移 + 闪烁 */
      const ba = bokehGeo.attributes.position.array;
      for (let i = 0; i < BK_N; i++) {
        ba[i * 3] += Math.sin(t * 0.21 + bseed[i]) * 0.05 * d;
        ba[i * 3 + 1] += (0.04 + 0.03 * Math.sin(bseed[i] * 2)) * d;
        if (ba[i * 3 + 1] > 5.6) ba[i * 3 + 1] = 0.2;
        if (ba[i * 3] > 10) ba[i * 3] = -10;
        if (ba[i * 3] < -10) ba[i * 3] = 10;
      }
      bokehGeo.attributes.position.needsUpdate = true;
      bokehMat.opacity = 0.07 + 0.035 * Math.sin(t * 0.6);
    });

    return {
      anim: anim,
      key: key,
      follow: follow,
      shadows: shadows,
      pano: pano,
      mid: mid,
      setStage: function (id) { applySpec(T.stageById(id)); },
      _lastT: 0,
      update: function (t, fighters) {
        const dt = this._lastT ? Math.min(0.033, Math.max(0, t - this._lastT)) : 0.016;
        this._lastT = t;
        for (let i = 0; i < anim.length; i++) anim[i](t, dt);
        if (fighters) {
          for (let i = 0; i < 2; i++) {
            const f = fighters[i];
            if (!f) continue;
            follow[i].position.set(f.x, 1.2 + f.y * 0.5, 0.9);
            const sh = shadows[i];
            sh.position.x = f.x;
            const airK = Math.max(0, 1 - f.y * 0.55);
            sh.scale.setScalar(1.15 * airK + 0.2);
            sh.material.opacity = 0.5 * airK;
          }
        }
      },
    };
  };
})(window.NV);
