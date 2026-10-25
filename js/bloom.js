/* ============================================================
   bloom.js —— 自研泛光后处理（非模块 three 兼容）
   流程：场景 → RT → 提亮(半分辨率) → 双向高斯模糊×N → 合成+Gamma
   · 亮度阈值只让火焰/霓虹/能量弹辉光，角色本体不过曝
   · 画质联动：低档直渲关闭，中档 2 轮模糊，高档 3 轮
   挂在 window.NV.Bloom。
   ============================================================ */
window.NV = window.NV || {};
(function (NV) {
  "use strict";

  var VERT =
    "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  var BRIGHT_FRAG =
    "uniform sampler2D tex; uniform float threshold; varying vec2 vUv;" +
    "void main(){" +
    "  vec3 c = texture2D(tex, vUv).rgb;" +
    "  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));" +
    "  float k = smoothstep(threshold, threshold + 0.18, l);" +
    "  gl_FragColor = vec4(c * k, 1.0);" +
    "}";
  var BLUR_FRAG =
    "uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;" +
    "void main(){" +
    "  vec3 c = vec3(0.0);" +
    "  c += texture2D(tex, vUv - dir * 4.0).rgb * 0.051;" +
    "  c += texture2D(tex, vUv - dir * 3.0).rgb * 0.0918;" +
    "  c += texture2D(tex, vUv - dir * 2.0).rgb * 0.1231;" +
    "  c += texture2D(tex, vUv - dir * 1.0).rgb * 0.1524;" +
    "  c += texture2D(tex, vUv).rgb * 0.1634;" +
    "  c += texture2D(tex, vUv + dir * 1.0).rgb * 0.1524;" +
    "  c += texture2D(tex, vUv + dir * 2.0).rgb * 0.1231;" +
    "  c += texture2D(tex, vUv + dir * 3.0).rgb * 0.0918;" +
    "  c += texture2D(tex, vUv + dir * 4.0).rgb * 0.051;" +
    "  gl_FragColor = vec4(c, 1.0);" +
    "}";
  var COMP_FRAG =
    "uniform sampler2D sceneTex; uniform sampler2D bloomTex; uniform float strength; uniform float gamma; varying vec2 vUv;" +
    "void main(){" +
    "  vec3 c = texture2D(sceneTex, vUv).rgb;" +
    "  vec3 b = texture2D(bloomTex, vUv).rgb;" +
    "  c += b * strength;" +
    "  c = pow(max(c, 0.0), vec3(1.0 / gamma));" +
    "  gl_FragColor = vec4(c, 1.0);" +
    "}";

  var Bloom = {
    enabled: false,
    strength: 0.85,
    threshold: 0.68,
    _r: null, _scene: null, _cam: null,
    _rtScene: null, _rtA: null, _rtB: null,
    _quadScene: null, _quadCam: null,
    _mBright: null, _mBlur: null, _mComp: null,
    _iters: 3,
    _boost: 0,               // 大招期间临时增强
    _w: 0, _h: 0,

    init: function (renderer, scene, camera) {
      this._r = renderer; this._scene = scene; this._cam = camera;
      try {
        this._quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this._quadScene = new THREE.Scene();
        this._mBright = new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: BRIGHT_FRAG,
          uniforms: { tex: { value: null }, threshold: { value: this.threshold } },
          depthTest: false, depthWrite: false,
        });
        this._mBlur = new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: BLUR_FRAG,
          uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2(1, 0) } },
          depthTest: false, depthWrite: false,
        });
        this._mComp = new THREE.ShaderMaterial({
          vertexShader: VERT, fragmentShader: COMP_FRAG,
          uniforms: {
            sceneTex: { value: null }, bloomTex: { value: null },
            strength: { value: this.strength }, gamma: { value: 2.2 },
          },
          depthTest: false, depthWrite: false,
        });
        var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._mBright);
        quad.frustumCulled = false;
        this._quadScene.add(quad);
        this.resize();
        this.enabled = true;
        if (NV.QUALITY && NV.QUALITY.onChange) {
          NV.QUALITY.onChange(function (tier) {
            Bloom._iters = tier >= 2 ? 3 : 2;
            Bloom.enabled = tier >= 1;
          }.bind(this));
          Bloom._iters = NV.QUALITY.tier >= 2 ? 3 : 2;
          Bloom.enabled = NV.QUALITY.tier >= 1;
        }
      } catch (e) {
        console.warn("Bloom init failed", e);
        this.enabled = false;
      }
    },

    resize: function () {
      if (!this._r) return;
      var size = this._r.getDrawingBufferSize ? this._r.getDrawingBufferSize(new THREE.Vector2())
        : { x: innerWidth, y: innerHeight };
      var w = Math.max(2, size.x | 0), h = Math.max(2, size.y | 0);
      if (w === this._w && h === this._h) return;
      this._w = w; this._h = h;
      var opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
      var optsND = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
      if (this._rtScene) this._rtScene.dispose();
      if (this._rtA) this._rtA.dispose();
      if (this._rtB) this._rtB.dispose();
      this._rtScene = new THREE.WebGLRenderTarget(w, h, opts);
      this._rtA = new THREE.WebGLRenderTarget(w >> 1, h >> 1, optsND);
      this._rtB = new THREE.WebGLRenderTarget(w >> 1, h >> 1, optsND);
    },

    /* 大招演出期间增强辉光 */
    boost: function (v) { this._boost = v; },

    _pass: function (mat, target) {
      this._quadScene.children[0].material = mat;
      this._r.setRenderTarget(target);
      this._r.clear();
      this._r.render(this._quadScene, this._quadCam);
    },

    /* 返回 false 表示未启用（调用方回退直渲） */
    render: function () {
      if (!this.enabled || !this._rtScene) return false;
      var r = this._r;
      this.resize();
      /* 1. 场景 → RT（材质内已完成色调映射，输出为线性） */
      r.setRenderTarget(this._rtScene);
      r.clear();
      r.render(this._scene, this._cam);
      /* 2. 提亮 */
      this._mBright.uniforms.tex.value = this._rtScene.texture;
      this._mBright.uniforms.threshold.value = this.threshold;
      this._pass(this._mBright, this._rtA);
      /* 3. 分离模糊 ×N */
      var hw = 1 / this._rtA.width, hh = 1 / this._rtA.height;
      for (var i = 0; i < this._iters; i++) {
        var sc = 1 + i * 0.85;
        this._mBlur.uniforms.tex.value = this._rtA.texture;
        this._mBlur.uniforms.dir.value.set(hw * 1.4 * sc, 0);
        this._pass(this._mBlur, this._rtB);
        this._mBlur.uniforms.tex.value = this._rtB.texture;
        this._mBlur.uniforms.dir.value.set(0, hh * 1.4 * sc);
        this._pass(this._mBlur, this._rtA);
      }
      /* 4. 合成 + Gamma → 屏幕 */
      this._mComp.uniforms.sceneTex.value = this._rtScene.texture;
      this._mComp.uniforms.bloomTex.value = this._rtA.texture;
      this._mComp.uniforms.strength.value = this.strength + this._boost;
      this._pass(this._mComp, null);
      r.setRenderTarget(null);
      return true;
    },
  };

  NV.Bloom = Bloom;
})(window.NV);
