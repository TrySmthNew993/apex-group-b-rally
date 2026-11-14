/**
 * Group B WRC Rally — Shared Engine Core & WebGL Resource Manager
 * - Centralized 3D resource disposal (geometries, materials, canvas textures)
 * - Shared WebGLRenderer & ReShade initialization
 * - Shared Garage Showcase scene & turntable lifecycle
 * - Shared Race Stage setup, 120 Hz physics loop, camera rig & lighting tracker
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  var TEXTURE_SLOTS = ['map', 'bumpMap', 'roughnessMap', 'normalMap', 'emissiveMap', 'alphaMap'];

  /**
   * Recursively disposes Three.js geometries, materials, and textures in a subtree
   * so switching cars, restarting stages, or changing quality never leaks GPU memory.
   */
  G.disposeHierarchy = function (root) {
    if (!root) return;
    var seenGeom = typeof Set !== 'undefined' ? new Set() : null;
    var seenMat = typeof Set !== 'undefined' ? new Set() : null;
    var seenTex = typeof Set !== 'undefined' ? new Set() : null;

    function disposeMaterial(mat) {
      if (!mat) return;
      if (seenMat) {
        if (seenMat.has(mat)) return;
        seenMat.add(mat);
      }
      for (var i = 0; i < TEXTURE_SLOTS.length; i++) {
        var tex = mat[TEXTURE_SLOTS[i]];
        if (tex && typeof tex.dispose === 'function') {
          if (!seenTex || !seenTex.has(tex)) {
            if (seenTex) seenTex.add(tex);
            tex.dispose();
          }
        }
      }
      if (typeof mat.dispose === 'function') {
        mat.dispose();
      }
    }

    if (typeof root.traverse === 'function') {
      root.traverse(function (node) {
        if (node.geometry && typeof node.geometry.dispose === 'function') {
          if (!seenGeom || !seenGeom.has(node.geometry)) {
            if (seenGeom) seenGeom.add(node.geometry);
            node.geometry.dispose();
          }
        }
        if (node.material) {
          if (Array.isArray(node.material)) {
            for (var m = 0; m < node.material.length; m++) {
              disposeMaterial(node.material[m]);
            }
          } else {
            disposeMaterial(node.material);
          }
        }
      });
    }
  };

  G.formatTime = function (sec) {
    if (sec === null || sec === undefined || !isFinite(sec)) return '--:--.--';
    var mins = Math.floor(sec / 60);
    var rem = sec - mins * 60;
    var secs = Math.floor(rem);
    var cs = Math.floor((rem - secs) * 100);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  };

  G.loadJSON = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return Object.assign({}, fallback);
      return Object.assign({}, fallback, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, fallback);
    }
  };

  G.saveJSON = function (key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (e) {}
  };

  G.detectIsMobile = function () {
    var uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    var touchMacIpad = (navigator.maxTouchPoints || 0) > 1 && window.innerWidth <= 1024;
    return uaMobile || touchMacIpad;
  };

  G.isPhoneControlsActive = function (settings) {
    if (settings.controlMode === 'phone') return true;
    if (settings.controlMode === 'pc') return false;
    return G.detectIsMobile();
  };

  /**
   * Binds pointer/touch handlers cleanly for multi-touch pedals and steering pads.
   */
  G.bindTouchPad = function (el, touchState, keyName) {
    if (!el) return;
    function down(e) {
      e.preventDefault();
      touchState[keyName] = true;
      el.classList.add('pressed');
      if (el.setPointerCapture && e.pointerId !== undefined) {
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      }
    }
    function up(e) {
      e.preventDefault();
      touchState[keyName] = false;
      el.classList.remove('pressed');
    }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', function (e) { e.preventDefault(); }, { passive: false });
  };

  /**
   * Builds the vector SVG turn arrow icon for the co-pilot radio HUD.
   */
  G.buildTurnSvg = function (note, sizePx) {
    var sz = sizePx || 52;
    var col = note.urgency === 'danger' ? '#ef4444' : (note.urgency === 'warn' ? '#facc15' : '#38bdf8');
    if (note.dir === 'CAUTION') {
      return '<svg viewBox="0 0 64 64" width="' + sz + '" height="' + sz + '"><polygon points="32,8 58,54 6,54" fill="none" stroke="' + col + '" stroke-width="5" stroke-linejoin="round"/><text x="32" y="47" text-anchor="middle" fill="' + col + '" font-size="26" font-weight="900">!</text></svg>';
    }
    if (note.dir === 'STRAIGHT') {
      return '<svg viewBox="0 0 64 64" width="' + sz + '" height="' + sz + '"><path d="M32 54 V12 M32 12 L20 24 M32 12 L44 24" fill="none" stroke="' + col + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    var flip = note.dir === 'LEFT' ? 'transform="translate(64,0) scale(-1,1)"' : '';
    var path = '';
    if (note.grade === 'HP') {
      path = 'M20 52 V24 C20 12 44 12 44 24 V44 M44 44 L35 35 M44 44 L53 35';
    } else if (note.grade === 1 || note.grade === 2) {
      path = 'M22 54 V30 Q22 18 34 18 H50 M50 18 L40 9 M50 18 L40 27';
    } else if (note.grade === 3 || note.grade === 4) {
      path = 'M24 54 V34 Q24 22 48 14 M48 14 L36 11 M48 14 L43 24';
    } else {
      path = 'M28 54 Q28 32 42 12 M42 12 L31 15 M42 12 L45 23';
    }
    return '<svg viewBox="0 0 64 64" width="' + sz + '" height="' + sz + '"><g ' + flip + '><path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  };

  /**
   * Creates the shared WebGLRenderer + ReShade pipeline wrapper.
   */
  G.createRallyRenderer = function (canvas, settings, width, height, updateStyle) {
    G.setTextureQuality(settings.quality);
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, updateStyle !== false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = settings.quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var reshade = G.ReshadePipeline ? new G.ReshadePipeline(renderer) : null;
    return { renderer: renderer, reshade: reshade };
  };

  /**
   * Shared Main Menu 3D Service Park Garage Showcase with automatic GPU cleanup on car switch.
   */
  G.GarageShowcase = function (opts) {
    opts = opts || {};
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1016);
    this.scene.fog = new THREE.FogExp2(0x0c1016, 0.045);

    var w = opts.width || window.innerWidth;
    var h = opts.height || Math.max(1, window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(opts.fov || 44, w / h, 0.1, 100);
    if (opts.cameraPos) {
      this.camera.position.set(opts.cameraPos[0], opts.cameraPos[1], opts.cameraPos[2]);
    } else {
      this.camera.position.set(4.1, 2.05, 5.1);
    }
    if (opts.lookAt) {
      this.camera.lookAt(opts.lookAt[0], opts.lookAt[1], opts.lookAt[2]);
    } else {
      this.camera.lookAt(0, 0.72, 0);
    }

    this.pivot = new THREE.Group();
    this.carMesh = null;
    this.turntableYaw = 0.65;

    this.scene.add(new THREE.AmbientLight(0x94a3b8, 0.44));
    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.48));

    var keySpot = new THREE.SpotLight(0xfff1d6, opts.castShadow ? 2.75 : 2.6, 26, Math.PI / 4, 0.42, 1.0);
    keySpot.position.set(4.5, 6.2, 4.5);
    if (opts.castShadow) {
      keySpot.castShadow = true;
      keySpot.shadow.mapSize.set(2048, 2048);
      keySpot.shadow.bias = -0.0005;
    }
    this.scene.add(keySpot);

    var rimSpot = new THREE.SpotLight(0x38bdf8, 1.85, 22, Math.PI / 3.5, 0.45, 1.0);
    rimSpot.position.set(-5.0, 3.6, -4.0);
    this.scene.add(rimSpot);

    if (opts.overheadLight) {
      var overheadSpot = new THREE.SpotLight(0xe2e8f0, 1.25, 20, Math.PI / 3.2, 0.6, 1.0);
      overheadSpot.position.set(0, 7.2, 1.0);
      this.scene.add(overheadSpot);
    }

    if (opts.redAccent) {
      var redAccent = new THREE.PointLight(0xe11d48, 1.15, 12);
      redAccent.position.set(-3.2, 1.2, 3.2);
      this.scene.add(redAccent);
    }

    var floorSize = opts.floorSize || 45;
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize, floorSize),
      new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.36, metalness: 0.36 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    var plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.75, 2.95, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: 0x222936, roughness: 0.35, metalness: 0.55 })
    );
    plinth.position.y = 0.07;
    plinth.receiveShadow = true;
    this.pivot.add(plinth);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.76, 0.025, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xe11d48 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.145;
    this.pivot.add(ring);

    if (opts.includeTruss) {
      var trussMat = new THREE.MeshStandardMaterial({ color: 0x272e3a, roughness: 0.6, metalness: 0.5 });
      [-4.5, 4.5].forEach(function (px) {
        var col = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6, 0.25), trussMat);
        col.position.set(px, 3, -4.5);
        this.scene.add(col);
      }.bind(this));
      var cross = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.28, 0.28), trussMat);
      cross.position.set(0, 5.2, -4.5);
      this.scene.add(cross);

      var bannerTex = G.createBannerTexture('GROUP B SERVICE PARK', 'FIA HOMOLOGATION SPECIALS', '#0f172a', '#e11d48');
      var backBanner = new THREE.Mesh(
        new THREE.PlaneGeometry(6.8, 1.4),
        new THREE.MeshBasicMaterial({ map: bannerTex })
      );
      backBanner.position.set(0, 3.6, -4.35);
      this.scene.add(backBanner);
    }

    this.scene.add(this.pivot);
  };

  G.GarageShowcase.prototype.rebuildCar = function (carId, tyreId) {
    if (this.carMesh) {
      this.pivot.remove(this.carMesh);
      G.disposeHierarchy(this.carMesh);
      this.carMesh = null;
    }
    var car = G.getCar(carId);
    var tyre = G.getTyre(tyreId);
    this.carMesh = G.createExteriorCar(car, tyre);
    this.carMesh.position.y = 0.14;
    this.pivot.add(this.carMesh);
  };

  G.GarageShowcase.prototype.update = function (dt, isDragging) {
    if (!isDragging) this.turntableYaw += dt * 0.35;
    this.pivot.rotation.y = this.turntableYaw;
  };

  G.GarageShowcase.prototype.resize = function (w, h) {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  };

  /**
   * Shared Stage Simulation, Lighting, Physics Substepping & Render Orchestrator.
   */
  G.StageEngine = function (renderer, reshade, initialFov) {
    this.renderer = renderer;
    this.reshade = reshade;
    this.raceScene = null;
    this.raceCamera = new THREE.PerspectiveCamera(initialFov || 68, window.innerWidth / Math.max(1, window.innerHeight), 0.08, 650);
    this.activeTrack = null;
    this.cockpitState = null;
    this.carPivot = null;
    this.phys = null;
    this.sunLight = null;
    this.skyMesh = null;
    this.sunOffset = new THREE.Vector3(120, 190, -140);
    this.sunFrustumHalf = 75;

    this.mode = 'MENU'; // 'MENU' | 'COUNTDOWN' | 'RACING' | 'PAUSED' | 'FINISHED'
    this.stageTimer = 0;
    this.countdownTimer = 0;
    this.lastCountdownBeep = 4;
    this.sector1Time = null;
    this.sector2Time = null;
    this.pacenoteCursor = 0;
    this.activePacenote = null;
    this.glanceFactor = 0;
    this.physAccumulator = 0;
    this.FIXED_DT = 1 / 120;
  };

  G.StageEngine.prototype.disposeStage = function () {
    if (this.raceScene) {
      G.disposeHierarchy(this.raceScene);
      this.raceScene = null;
    }
    this.activeTrack = null;
    this.cockpitState = null;
    this.carPivot = null;
    this.phys = null;
    this.sunLight = null;
    this.skyMesh = null;
    this.activePacenote = null;
  };

  G.StageEngine.prototype.startStage = function (trackId, carId, tyreId, settings, baseFov, callbacks) {
    this.disposeStage();
    G.setTextureQuality(settings.quality);
    this.renderer.shadowMap.enabled = settings.quality !== 'low';

    var trackDef = G.getTrack(trackId);
    var carDef = G.getCar(carId);
    var tyreDef = G.getTyre(tyreId);
    var isHigh = settings.quality === 'high';

    G.Audio.setCarProfile(carDef);
    G.Audio.setPaused(false);
    G.Audio.applyVolumes(settings);

    this.raceScene = new THREE.Scene();
    this.raceScene.background = new THREE.Color(trackDef.skyHorizon);
    this.raceScene.fog = new THREE.FogExp2(trackDef.fogColor, trackDef.fogDensity);

    this.skyMesh = G.createSkyDomeMesh
      ? G.createSkyDomeMesh(trackDef, this.sunOffset, isHigh)
      : new THREE.Mesh(
          new THREE.SphereGeometry(520, 24, 16),
          new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
              topColor: { value: new THREE.Color(trackDef.skyTop) },
              bottomColor: { value: new THREE.Color(trackDef.skyHorizon) }
            },
            vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPos; void main() { float h = clamp(normalize(vPos).y * 1.4, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.65)), 1.0); }'
          })
        );
    this.raceScene.add(this.skyMesh);

    this.raceScene.add(new THREE.HemisphereLight(trackDef.skyTop, trackDef.ambientColor, isHigh ? 0.92 : 0.78));

    this.sunLight = new THREE.DirectionalLight(trackDef.sunColor, isHigh ? trackDef.sunIntensity * 1.15 : trackDef.sunIntensity);
    this.sunLight.position.copy(this.sunOffset);
    if (settings.quality !== 'low') {
      this.sunLight.castShadow = true;
      var maxTex = (this.renderer.capabilities && this.renderer.capabilities.maxTextureSize) ? this.renderer.capabilities.maxTextureSize : 2048;
      var smSize = isHigh ? Math.min(4096, maxTex) : 1024;
      this.sunLight.shadow.mapSize.set(smSize, smSize);
      this.sunLight.shadow.camera.near = 10;
      this.sunLight.shadow.camera.far = 480;
      this.sunFrustumHalf = isHigh ? 75 : 105;
      this.sunLight.shadow.camera.left = -this.sunFrustumHalf;
      this.sunLight.shadow.camera.right = this.sunFrustumHalf;
      this.sunLight.shadow.camera.top = this.sunFrustumHalf;
      this.sunLight.shadow.camera.bottom = -this.sunFrustumHalf;
      this.sunLight.shadow.bias = -0.0004;
      this.sunLight.shadow.normalBias = 0.035;
    }
    this.raceScene.add(this.sunLight);
    this.raceScene.add(this.sunLight.target);

    if (isHigh) {
      var bounceLight = new THREE.DirectionalLight(trackDef.skyHorizon, trackDef.sunIntensity * 0.28);
      bounceLight.position.set(-this.sunOffset.x, this.sunOffset.y * 0.45, -this.sunOffset.z);
      this.raceScene.add(bounceLight);
    }

    this.activeTrack = new G.TrackInstance(trackDef, settings.quality).build();
    this.raceScene.add(this.activeTrack.group);

    this.carPivot = new THREE.Group();
    this.cockpitState = G.createCockpitRig(carDef, tyreDef, this.activeTrack);
    this.carPivot.add(this.cockpitState.rig);
    this.carPivot.add(this.raceCamera);
    this.raceScene.add(this.carPivot);

    this.raceCamera.fov = baseFov;
    this.raceCamera.updateProjectionMatrix();

    this.phys = new G.RallyPhysics(carDef, tyreDef, this.activeTrack, settings);

    this.stageTimer = 0;
    this.countdownTimer = 3.2;
    this.lastCountdownBeep = 4;
    this.sector1Time = null;
    this.sector2Time = null;
    this.pacenoteCursor = 0;
    this.glanceFactor = 0;
    this.physAccumulator = 0;

    if (this.activeTrack.pacenotes.length > 0 && callbacks && callbacks.onPacenote) {
      this.activePacenote = this.activeTrack.pacenotes[0];
      callbacks.onPacenote(this.activeTrack.pacenotes[0], this.activeTrack.pacenotes[1] || null, false);
      this.pacenoteCursor = 1;
    }

    this.mode = 'COUNTDOWN';
  };

  G.StageEngine.prototype.returnToMenu = function () {
    this.mode = 'MENU';
    G.Audio.setPaused(true);
    this.disposeStage();
  };

  G.StageEngine.prototype.togglePause = function () {
    if (this.mode === 'RACING' || this.mode === 'COUNTDOWN') {
      this.mode = 'PAUSED';
      G.Audio.setPaused(true);
      return true;
    }
    if (this.mode === 'PAUSED') {
      this.mode = this.countdownTimer > 0 ? 'COUNTDOWN' : 'RACING';
      G.Audio.setPaused(false);
      return false;
    }
    return null;
  };

  G.StageEngine.prototype.toggleLights = function () {
    if (!this.cockpitState) return false;
    this.cockpitState.lightsOn = !this.cockpitState.lightsOn;
    this.cockpitState.headlight.intensity = this.cockpitState.lightsOn ? 1.8 : 0.0;
    return this.cockpitState.lightsOn;
  };

  G.StageEngine.prototype.toggleWipers = function () {
    if (!this.cockpitState) return false;
    this.cockpitState.wiperContinuous = !this.cockpitState.wiperContinuous;
    return this.cockpitState.wiperContinuous;
  };

  G.StageEngine.prototype.resize = function (w, h, baseFov) {
    this.raceCamera.aspect = w / Math.max(1, h);
    if (baseFov) this.raceCamera.fov = baseFov;
    this.raceCamera.updateProjectionMatrix();
  };

  G.StageEngine.prototype.renderScene = function (scene, camera, quality) {
    if (this.reshade) {
      this.reshade.render(scene, camera, quality === 'high');
    } else {
      this.renderer.render(scene, camera);
    }
  };

  G.StageEngine.prototype.stepFrame = function (dt, nowMs, input, targetGlance, baseFov, settings, callbacks) {
    if (this.mode === 'PAUSED' || this.mode === 'FINISHED') {
      this.renderScene(this.raceScene, this.raceCamera, settings.quality);
      return;
    }

    if (this.mode === 'COUNTDOWN') {
      this.countdownTimer -= dt;
      var secCeil = Math.ceil(this.countdownTimer);
      if (this.countdownTimer > 0) {
        if (this.activeTrack && this.activeTrack.startLightBulbs) {
          this.activeTrack.startLightBulbs[0].color.setHex(secCeil <= 3 ? 0xef4444 : 0x331111);
          this.activeTrack.startLightBulbs[1].color.setHex(secCeil <= 2 ? 0xef4444 : 0x331111);
          this.activeTrack.startLightBulbs[2].color.setHex(secCeil <= 1 ? 0xef4444 : 0x331111);
        }
        if (secCeil < this.lastCountdownBeep && secCeil >= 1) {
          this.lastCountdownBeep = secCeil;
          G.Audio.playCountdownBeep(false);
        }
        if (callbacks && callbacks.onCountdown) callbacks.onCountdown(secCeil, false);
      } else {
        this.mode = 'RACING';
        if (this.activeTrack && this.activeTrack.startLightBulbs) {
          this.activeTrack.startLightBulbs.forEach(function (m) { m.color.setHex(0x22c55e); });
        }
        G.Audio.playCountdownBeep(true);
        if (callbacks && callbacks.onCountdown) callbacks.onCountdown(0, true);
      }
    }

    // 120 Hz fixed-timestep physics
    this.physAccumulator += dt;
    while (this.physAccumulator >= this.FIXED_DT) {
      this.phys.step(input, this.FIXED_DT, this.mode === 'RACING');
      this.physAccumulator -= this.FIXED_DT;
    }

    if (this.mode === 'RACING') {
      this.stageTimer += dt;
      if (callbacks && callbacks.onTimer) callbacks.onTimer(this.stageTimer, dt);

      if (this.sector1Time === null && this.phys.trackDist >= this.activeTrack.totalLength * 0.33) {
        this.sector1Time = this.stageTimer;
        if (callbacks && callbacks.onSector) callbacks.onSector('S1', this.sector1Time, 0.33);
      }
      if (this.sector2Time === null && this.phys.trackDist >= this.activeTrack.totalLength * 0.66) {
        this.sector2Time = this.stageTimer;
        if (callbacks && callbacks.onSector) callbacks.onSector('S2', this.sector2Time, 0.66);
      }

      while (
        this.pacenoteCursor < this.activeTrack.pacenotes.length &&
        this.phys.trackDist >= this.activeTrack.pacenotes[this.pacenoteCursor].triggerDist
      ) {
        var note = this.activeTrack.pacenotes[this.pacenoteCursor];
        var nextNote = this.activeTrack.pacenotes[this.pacenoteCursor + 1] || null;
        this.activePacenote = note;
        if (callbacks && callbacks.onPacenote) callbacks.onPacenote(note, nextNote, true);
        this.pacenoteCursor++;
      }

      if (this.phys.trackDist >= this.activeTrack.finishDist) {
        this.mode = 'FINISHED';
        G.Audio.setPaused(true);
        if (callbacks && callbacks.onFinish) callbacks.onFinish(this.stageTimer);
      }
    }

    // Apply car chassis transform
    this.carPivot.position.copy(this.phys.pos);
    this.carPivot.rotation.set(0, 0, 0);
    this.carPivot.rotateY(this.phys.yaw);
    this.carPivot.rotateX(this.phys.pitch);
    this.carPivot.rotateZ(this.phys.roll);

    // 1st-Person Cockpit Camera POV
    this.glanceFactor += (targetGlance - this.glanceFactor) * Math.min(1, dt * 8);
    var headSwayX = Math.max(-0.045, Math.min(0.045, -this.phys.latG * 0.025));
    var headJoltY = Math.max(-0.035, Math.min(0.035, -this.phys.vertVel * 0.008)) +
      (this.phys.impactEvent * (Math.random() - 0.5) * 0.05);
    var headSwayZ = Math.max(-0.03, Math.min(0.03, this.phys.longG * 0.025));

    this.raceCamera.position.set(
      -0.24 + headSwayX + this.glanceFactor * 0.08,
      1.15 + headJoltY,
      0.16 + headSwayZ
    );
    this.raceCamera.rotation.order = 'YXZ';
    this.raceCamera.rotation.y = -0.075 - this.glanceFactor * 0.38;
    this.raceCamera.rotation.x = -0.075 - this.glanceFactor * 0.04;
    this.raceCamera.rotation.z = -this.phys.latG * 0.014;

    var desiredFov = baseFov + Math.min(7, this.phys.speedKmh * 0.038);
    if (Math.abs(this.raceCamera.fov - desiredFov) > 0.1) {
      this.raceCamera.fov += (desiredFov - this.raceCamera.fov) * Math.min(1, dt * 6);
      this.raceCamera.updateProjectionMatrix();
    }

    G.updateCockpitRig(this.cockpitState, this.phys, this.activePacenote, settings, dt, nowMs / 1000);
    this.activeTrack.updateEffects(this.phys.pos, dt);

    if (this.skyMesh) {
      this.skyMesh.position.set(this.phys.pos.x, this.phys.pos.y * 0.2, this.phys.pos.z);
    }
    if (this.sunLight && this.sunLight.castShadow) {
      var texel = (this.sunFrustumHalf * 2) / (this.sunLight.shadow.mapSize.width || 2048);
      var sx = Math.round(this.phys.pos.x / texel) * texel;
      var sz = Math.round(this.phys.pos.z / texel) * texel;
      this.sunLight.target.position.set(sx, this.phys.pos.y, sz);
      this.sunLight.position.set(sx + this.sunOffset.x, this.phys.pos.y + this.sunOffset.y, sz + this.sunOffset.z);
      this.sunLight.target.updateMatrixWorld();
    }

    G.Audio.update({
      rpm: this.phys.rpm,
      redline: this.phys.car.redlineRpm,
      throttle: this.phys.throttle,
      boost: this.phys.boost,
      speedKmh: this.phys.speedKmh,
      slipIntensity: this.phys.slipIntensity,
      surfaceId: this.phys.surfaceId,
      airborne: this.phys.airborne
    }, dt);

    this.renderScene(this.raceScene, this.raceCamera, settings.quality);
  };
})(window.GroupBRally);
