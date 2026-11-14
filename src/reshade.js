/**
 * APEX GROUP B // High-Preset ReShade Post-Processing & Atmospheric Sky
 * Runs exclusively when Quality === 'high' for cinematic lighting, bloom,
 * micro-texture sharpening, filmic color grading, and sun-scattering sky.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  /**
   * Single-pass ReShade WebGL post-processing pipeline:
   * - Linear HDR-style Bloom & Highlight Halation (sun, wet tarmac glints, headlights, snow glare)
   * - LumaSharpen 5-tap micro-detail clarity (gravel, asphalt aggregate, cockpit gauges)
   * - ACES Filmic Tone Mapping + Warm/Cool Split-Tone Grading + Selective Vibrance
   * - Subtle Optical Chromatic Fringe & Cinema Vignette
   */
  G.ReshadePipeline = function (renderer) {
    this.renderer = renderer;
    this.rt = null;
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.texelSize = new THREE.Vector2(1 / 1280, 1 / 720);

    var supportsFloat = renderer.capabilities.isWebGL2 &&
      !!(renderer.extensions && renderer.extensions.get('EXT_color_buffer_float'));
    this.rtType = supportsFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rtSamples = renderer.capabilities.isWebGL2 ? 4 : 0;

    this.material = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        uTexelSize: { value: this.texelSize },
        uExposure: { value: 1.12 },
        uBloomStrength: { value: 0.34 },
        uSharpen: { value: 0.42 },
        uVibrance: { value: 0.24 },
        uContrast: { value: 1.07 }
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = vec4(position.xy, 0.0, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform vec2 uTexelSize;',
        'uniform float uExposure;',
        'uniform float uBloomStrength;',
        'uniform float uSharpen;',
        'uniform float uVibrance;',
        'uniform float uContrast;',
        'varying vec2 vUv;',
        '',
        'float luma(vec3 c) {',
        '  return dot(c, vec3(0.2126, 0.7152, 0.0722));',
        '}',
        '',
        'vec3 acesFilmic(vec3 x) {',
        '  float a = 2.51;',
        '  float b = 0.03;',
        '  float c = 2.43;',
        '  float d = 0.59;',
        '  float e = 0.14;',
        '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
        '}',
        '',
        'void main() {',
        '  vec2 uv = vUv;',
        '  vec2 centered = uv - 0.5;',
        '  float r2 = dot(centered, centered);',
        '',
        '  // Ultra-subtle optical radial fringe only near outer screen edges',
        '  vec2 fringe = centered * (0.0016 * r2);',
        '  vec3 centerCol = vec3(',
        '    texture2D(tDiffuse, clamp(uv + fringe, 0.001, 0.999)).r,',
        '    texture2D(tDiffuse, uv).g,',
        '    texture2D(tDiffuse, clamp(uv - fringe, 0.001, 0.999)).b',
        '  );',
        '',
        '  // 5-tap LumaSharpen micro-detail enhancement',
        '  vec3 nN = texture2D(tDiffuse, clamp(uv + vec2(0.0, uTexelSize.y), 0.001, 0.999)).rgb;',
        '  vec3 nS = texture2D(tDiffuse, clamp(uv - vec2(0.0, uTexelSize.y), 0.001, 0.999)).rgb;',
        '  vec3 nE = texture2D(tDiffuse, clamp(uv + vec2(uTexelSize.x, 0.0), 0.001, 0.999)).rgb;',
        '  vec3 nW = texture2D(tDiffuse, clamp(uv - vec2(uTexelSize.x, 0.0), 0.001, 0.999)).rgb;',
        '  vec3 blur4 = (nN + nS + nE + nW) * 0.25;',
        '  float highPass = clamp(luma(centerCol - blur4), -0.18, 0.18);',
        '  vec3 col = max(vec3(0.0), centerCol + highPass * uSharpen * 1.45);',
        '',
        '  // Soft radial highlight bloom (9-tap dual-ring kernel)',
        '  vec3 bloom = vec3(0.0);',
        '  float wSum = 0.0;',
        '  vec2 off1 = uTexelSize * 3.5;',
        '  vec2 off2 = uTexelSize * 7.5;',
        '  for (int i = 0; i < 4; i++) {',
        '    vec2 dir = i == 0 ? vec2(1.0, 0.0) : (i == 1 ? vec2(-1.0, 0.0) : (i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0)));',
        '    vec2 diag = i == 0 ? vec2(0.7, 0.7) : (i == 1 ? vec2(-0.7, 0.7) : (i == 2 ? vec2(0.7, -0.7) : vec2(-0.7, -0.7)));',
        '    vec3 s1 = texture2D(tDiffuse, clamp(uv + dir * off1, 0.001, 0.999)).rgb;',
        '    vec3 s2 = texture2D(tDiffuse, clamp(uv + diag * off2, 0.001, 0.999)).rgb;',
        '    float b1 = smoothstep(0.62, 1.15, luma(s1));',
        '    float b2 = smoothstep(0.58, 1.15, luma(s2));',
        '    bloom += s1 * b1 * 1.2 + s2 * b2;',
        '    wSum += 2.2;',
        '  }',
        '  col += (bloom / wSum) * uBloomStrength;',
        '',
        '  // ACES Filmic Tone Mapping + Exposure',
        '  col = acesFilmic(col * uExposure);',
        '',
        '  // Filmic Contrast S-Curve + Split-Toning (cool deep shadows, crisp warm sunlit highlights)',
        '  col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);',
        '  float lum = luma(col);',
        '  vec3 shadowTint = vec3(0.95, 0.99, 1.05);',
        '  vec3 highTint = vec3(1.03, 1.01, 0.96);',
        '  col *= mix(shadowTint, highTint, smoothstep(0.15, 0.85, lum));',
        '',
        '  // Selective Vibrance (boosts muted tones without clipping vivid accents)',
        '  float maxC = max(col.r, max(col.g, col.b));',
        '  float minC = min(col.r, min(col.g, col.b));',
        '  float sat = maxC - minC;',
        '  float vibAmt = uVibrance * (1.0 - sat);',
        '  col = mix(vec3(lum), col, 1.0 + vibAmt);',
        '',
        '  // Subtle optical vignette',
        '  float vig = 1.0 - r2 * 0.42;',
        '  col *= clamp(vig, 0.72, 1.0);',
        '',
        '  // Output sRGB gamma',
        '  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });

    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  };

  G.ReshadePipeline.prototype.ensureSize = function () {
    var size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    var w = Math.max(1, Math.floor(size.x));
    var h = Math.max(1, Math.floor(size.y));

    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      if (this.rt) this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: this.rtType,
        depthBuffer: true,
        stencilBuffer: false,
        samples: this.rtSamples
      });
      this.texelSize.set(1 / w, 1 / h);
    }
  };

  G.ReshadePipeline.prototype.render = function (scene, camera, enabled) {
    if (!enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }

    this.ensureSize();
    var prevEncoding = this.renderer.outputEncoding;
    var prevTone = this.renderer.toneMapping;

    // Render linear color into MSAA offscreen target, then grade + ACES + gamma in ReShade pass
    this.renderer.outputEncoding = THREE.LinearEncoding;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.material.uniforms.tDiffuse.value = this.rt.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);

    this.renderer.outputEncoding = prevEncoding;
    this.renderer.toneMapping = prevTone;
  };

  /**
   * Builds a rich Sky Dome Mesh.
   * On High quality, includes directional sun disc, atmospheric Mie corona glow,
   * horizon haze scattering, and subtle drifting high-altitude clouds.
   */
  G.createSkyDomeMesh = function (trackDef, sunOffsetVec, isHigh) {
    var skyGeo = new THREE.SphereGeometry(540, 32, 20);
    var sunDir = sunOffsetVec.clone().normalize();
    var skyMat;

    if (isHigh) {
      skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(trackDef.skyTop) },
          bottomColor: { value: new THREE.Color(trackDef.skyHorizon) },
          sunColor: { value: new THREE.Color(trackDef.sunColor) },
          sunDir: { value: sunDir }
        },
        vertexShader: [
          'varying vec3 vDir;',
          'void main() {',
          '  vDir = normalize(position);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform vec3 topColor;',
          'uniform vec3 bottomColor;',
          'uniform vec3 sunColor;',
          'uniform vec3 sunDir;',
          'varying vec3 vDir;',
          '',
          'float hash21(vec2 p) {',
          '  p = fract(p * vec2(123.34, 456.21));',
          '  p += dot(p, p + 45.32);',
          '  return fract(p.x * p.y);',
          '}',
          '',
          'float noise2(vec2 p) {',
          '  vec2 i = floor(p); vec2 f = fract(p);',
          '  f = f * f * (3.0 - 2.0 * f);',
          '  float a = hash21(i); float b = hash21(i + vec2(1.0, 0.0));',
          '  float c = hash21(i + vec2(0.0, 1.0)); float d = hash21(i + vec2(1.0, 1.0));',
          '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
          '}',
          '',
          'float fbm(vec2 p) {',
          '  float v = 0.0; float a = 0.5;',
          '  for (int i = 0; i < 4; i++) { v += a * noise2(p); p *= 2.05; a *= 0.5; }',
          '  return v;',
          '}',
          '',
          'void main() {',
          '  vec3 d = normalize(vDir);',
          '  float h = clamp(d.y * 1.35, 0.0, 1.0);',
          '  vec3 sky = mix(bottomColor, topColor, pow(h, 0.62));',
          '',
          '  // Soft atmospheric cloud layer',
          '  if (d.y > 0.02) {',
          '    vec2 cloudUv = d.xz / (d.y + 0.18) * 1.4;',
          '    float cl = fbm(cloudUv);',
          '    float cloudMask = smoothstep(0.48, 0.78, cl) * smoothstep(0.02, 0.25, d.y) * 0.36;',
          '    vec3 cloudCol = mix(bottomColor * 1.08, sunColor * 1.15, 0.55);',
          '    sky = mix(sky, cloudCol, cloudMask);',
          '  }',
          '',
          '  // Sun disc + Mie scattering halo',
          '  float sunDot = max(0.0, dot(d, normalize(sunDir)));',
          '  float halo = pow(sunDot, 10.0) * 0.42 + pow(sunDot, 96.0) * 0.75;',
          '  float disc = smoothstep(0.9986, 0.9994, sunDot) * 2.2;',
          '  sky += sunColor * (halo + disc);',
          '',
          '  gl_FragColor = vec4(sky, 1.0);',
          '}'
        ].join('\n')
      });
    } else {
      skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(trackDef.skyTop) },
          bottomColor: { value: new THREE.Color(trackDef.skyHorizon) }
        },
        vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPos; void main() { float h = clamp(normalize(vPos).y * 1.4, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.65)), 1.0); }'
      });
    }

    return new THREE.Mesh(skyGeo, skyMat);
  };
})(window.GroupBRally);
