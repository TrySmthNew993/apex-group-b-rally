/**
 * Main Game Controller:
 * - Three.js WebGL Renderer & Lighting
 * - Main Menu 3D Service Park Garage Showcase
 * - 1st-Person Cockpit POV Camera & Physics Loop (120 Hz fixed substep)
 * - Visual Radio Pacenote Dispatcher, Stage Timer, Sector Splits & Persistence
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  var STORAGE_SETTINGS = 'groupb_rally_settings_v1';
  var STORAGE_RECORDS = 'groupb_rally_records_v1';

  var defaultSettings = {
    controlMode: 'auto',
    assists: 'low',
    transmission: 'auto',
    steerSens: 1.0,
    fov: 68,
    units: 'kmh',
    quality: 'high',
    masterVol: 0.75,
    engineVol: 0.80,
    sfxVol: 0.85,
    voiceEnabled: true
  };

  function detectIsMobile() {
    var uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    var touchMacIpad = (navigator.maxTouchPoints || 0) > 1 && window.innerWidth <= 1024;
    return uaMobile || touchMacIpad;
  }

  function isPhoneControlsActive() {
    if (settings.controlMode === 'phone') return true;
    if (settings.controlMode === 'pc') return false;
    return detectIsMobile();
  }

  var settings = loadJSON(STORAGE_SETTINGS, defaultSettings);
  var records = loadJSON(STORAGE_RECORDS, {});

  var selectedTrackId = 'forest';
  var selectedCarId = 'bergmeister_q85';
  var selectedTyreId = 'gravel_soft';

  // Game modes: 'MENU' | 'COUNTDOWN' | 'RACING' | 'PAUSED' | 'FINISHED'
  var mode = 'MENU';

  // Three.js core objects
  var canvas = document.getElementById('game-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = settings.quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var menuScene = new THREE.Scene();
  var menuCamera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 100);
  var garagePivot = new THREE.Group();
  var garageCarMesh = null;
  var turntableYaw = 0.65;
  var isDraggingGarage = false;
  var lastDragX = 0;

  // Race state
  var raceScene = null;
  var raceCamera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.08, 650);
  var activeTrack = null;
  var cockpitState = null;
  var carPivot = null;
  var phys = null;

  var stageTimer = 0;
  var countdownTimer = 0;
  var lastCountdownBeep = 4;
  var sector1Time = null;
  var sector2Time = null;
  var pacenoteCursor = 0;
  var activePacenote = null;
  var sectorToastTimer = 0;
  var glanceFactor = 0;

  // Input state
  var keys = {};
  var touchState = { left: false, right: false, gas: false, brake: false, hb: false };
  var glanceToggle = false;
  var input = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return Object.assign({}, fallback);
      return Object.assign({}, fallback, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, fallback);
    }
  }

  function saveJSON(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch (e) {}
  }

  function formatTime(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return '--:--.--';
    var mins = Math.floor(sec / 60);
    var rem = sec - mins * 60;
    var whole = Math.floor(rem);
    var cs = Math.floor((rem - whole) * 100);
    return (mins < 10 ? '0' : '') + mins + ':' + (whole < 10 ? '0' : '') + whole + '.' + (cs < 10 ? '0' : '') + cs;
  }

  // =========================================================================
  // 1. SERVICE PARK 3D GARAGE SCENE (MAIN MENU)
  // =========================================================================
  function initMenuScene() {
    menuScene.background = new THREE.Color(0x0c1016);
    menuScene.fog = new THREE.FogExp2(0x0c1016, 0.045);

    menuCamera.position.set(4.1, 2.05, 5.1);
    menuCamera.lookAt(0, 0.72, 0);

    var amb = new THREE.AmbientLight(0x94a3b8, 0.55);
    menuScene.add(amb);

    var keySpot = new THREE.SpotLight(0xfff1d6, 2.4, 24, Math.PI / 4, 0.45, 1.0);
    keySpot.position.set(4.5, 6.2, 4.5);
    keySpot.castShadow = true;
    keySpot.shadow.mapSize.set(1024, 1024);
    menuScene.add(keySpot);

    var rimSpot = new THREE.SpotLight(0x38bdf8, 1.5, 20, Math.PI / 3.5, 0.5, 1.0);
    rimSpot.position.set(-5.0, 3.6, -4.0);
    menuScene.add(rimSpot);

    var redAccent = new THREE.PointLight(0xe11d48, 0.9, 12);
    redAccent.position.set(-3.2, 1.2, 3.2);
    menuScene.add(redAccent);

    // Garage floor & rotating plinth
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(45, 45),
      new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.55, metalness: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    menuScene.add(floor);

    var plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.75, 2.95, 0.14, 48),
      new THREE.MeshStandardMaterial({ color: 0x222936, roughness: 0.35, metalness: 0.55 })
    );
    plinth.position.y = 0.07;
    plinth.receiveShadow = true;
    garagePivot.add(plinth);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.76, 0.025, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xe11d48 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.145;
    garagePivot.add(ring);

    // Service Park Truss Pillars in background
    var trussMat = new THREE.MeshStandardMaterial({ color: 0x272e3a, roughness: 0.6, metalness: 0.5 });
    [-4.5, 4.5].forEach(function (px) {
      var col = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6, 0.25), trussMat);
      col.position.set(px, 3, -4.5);
      menuScene.add(col);
    });
    var cross = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.28, 0.28), trussMat);
    cross.position.set(0, 5.2, -4.5);
    menuScene.add(cross);

    var bannerTex = G.createBannerTexture('GROUP B SERVICE PARK', 'FIA HOMOLOGATION SPECIALS', '#0f172a', '#e11d48');
    var backBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 1.4),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    );
    backBanner.position.set(0, 3.6, -4.35);
    menuScene.add(backBanner);

    menuScene.add(garagePivot);
    rebuildGarageCar();
  }

  function rebuildGarageCar() {
    if (garageCarMesh) {
      garagePivot.remove(garageCarMesh);
    }
    var car = G.getCar(selectedCarId);
    var tyre = G.getTyre(selectedTyreId);
    garageCarMesh = G.createExteriorCar(car, tyre);
    garageCarMesh.position.y = 0.14;
    garagePivot.add(garageCarMesh);
  }

  // =========================================================================
  // 2. MAIN MENU UI POPULATION & EVENTS
  // =========================================================================
  function renderMenuUI() {
    var trackListEl = document.getElementById('track-list');
    trackListEl.innerHTML = '';
    G.TRACKS.forEach(function (tr) {
      var card = document.createElement('div');
      card.className = 'track-card' + (tr.id === selectedTrackId ? ' selected' : '');
      var best = records[tr.id] ? formatTime(records[tr.id].time) : '--:--.--';
      card.innerHTML =
        '<div class="track-card-top">' +
          '<span class="track-title">' + tr.name + '</span>' +
          '<span class="biome-pill biome-' + tr.biome + '">' + tr.biomeLabel + '</span>' +
        '</div>' +
        '<div class="track-desc">' + tr.description + '</div>' +
        '<div class="track-meta">' +
          '<span>GOLD: ' + formatTime(tr.targetTimes.gold) + '</span>' +
          '<span>BEST: ' + best + '</span>' +
        '</div>';
      card.addEventListener('click', function () {
        selectedTrackId = tr.id;
        renderMenuUI();
      });
      trackListEl.appendChild(card);
    });

    var track = G.getTrack(selectedTrackId);

    var tyreListEl = document.getElementById('tyre-list');
    tyreListEl.innerHTML = '';
    G.TYRES.forEach(function (ty) {
      var isRec = ty.id === track.recommendedTyre;
      var card = document.createElement('div');
      card.className = 'tyre-card' + (ty.id === selectedTyreId ? ' selected' : '');
      card.title = ty.description;
      card.innerHTML =
        '<div class="tyre-name"><span class="tyre-dot" style="background:' + ty.sidewallColor + '"></span>' + ty.name + '</div>' +
        '<div class="tyre-tag">' + ty.tag + ' • PEAK SLIP ' + Math.round(ty.slipPeak * 57.3) + '°</div>' +
        (isRec ? '<span class="tyre-rec-pill">★ RECOMMENDED FOR STAGE</span>' : '');
      card.addEventListener('click', function () {
        selectedTyreId = ty.id;
        rebuildGarageCar();
        renderMenuUI();
      });
      tyreListEl.appendChild(card);
    });

    var carListEl = document.getElementById('car-list');
    carListEl.innerHTML = '';
    G.CARS.forEach(function (c) {
      var chip = document.createElement('div');
      chip.className = 'car-chip' + (c.id === selectedCarId ? ' selected' : '');
      chip.innerHTML =
        '<div class="car-chip-name">' + c.name + '</div>' +
        '<div class="car-chip-meta">' + c.drivetrain + ' • ' + c.powerHp + ' HP • ' + c.massKg + ' KG</div>';
      chip.addEventListener('click', function () {
        selectedCarId = c.id;
        rebuildGarageCar();
        renderMenuUI();
      });
      carListEl.appendChild(chip);
    });

    // Update Car Showcase Detail Readouts
    var car = G.getCar(selectedCarId);
    var tyre = G.getTyre(selectedTyreId);

    document.getElementById('car-era-label').textContent = car.era + ' • ' + car.induction;
    document.getElementById('car-name-label').textContent = car.name;
    document.getElementById('car-drivetrain-badge').textContent = car.drivetrain + ' • ' + car.massKg + ' KG';
    document.getElementById('car-summary').textContent = car.summary + ' Tyre selected: ' + tyre.description;

    document.getElementById('stat-power').style.width = car.stats.power + '%';
    document.getElementById('spec-power-val').textContent = car.powerHp + ' HP';
    document.getElementById('stat-weight').style.width = car.stats.weight + '%';
    document.getElementById('spec-weight-val').textContent = car.massKg + ' KG';
    document.getElementById('stat-handling').style.width = car.stats.handling + '%';
    var fPct = Math.round(car.frontWeightBias * 100);
    document.getElementById('spec-bias-val').textContent = fPct + '/' + (100 - fPct) + ' F/R';

    // Compute stage tyre grip match score
    var dominantSurf = track.biome === 'snow' ? 'snow' : (track.biome === 'jungle' ? 'mud' : 'gravel');
    var matchScore = Math.round(Math.min(100, (tyre.surfaceGrip[dominantSurf] || 0.8) * 78));
    document.getElementById('stat-grip').style.width = matchScore + '%';
    document.getElementById('spec-grip-val').textContent = matchScore >= 82 ? 'OPTIMAL' : (matchScore >= 65 ? 'FAIR' : 'RISKY!');

    // Launch bar summary
    document.getElementById('summary-track').textContent = track.name;
    document.getElementById('summary-car').textContent = car.name;
    document.getElementById('summary-tyre').textContent = tyre.name;
    document.getElementById('summary-best').textContent = records[track.id] ? formatTime(records[track.id].time) : '--:--.--';
  }

  function applyControlModeUI() {
    var phoneMode = isPhoneControlsActive();
    document.getElementById('pc-controls-strip').classList.toggle('hidden', phoneMode);
    document.getElementById('touch-controls-layer').classList.toggle('hidden', !phoneMode);
    document.getElementById('touch-action-pills').classList.toggle('hidden', !phoneMode);
    document.getElementById('t-pad-shift-up').classList.toggle('hidden', settings.transmission !== 'manual');
    document.getElementById('t-pad-shift-down').classList.toggle('hidden', settings.transmission !== 'manual');
  }

  function bindSettingsControls() {
    var elControlMode = document.getElementById('set-control-mode');
    var elAssists = document.getElementById('set-assists');
    var elTrans = document.getElementById('set-trans');
    var elSteer = document.getElementById('set-steer-sens');
    var elFov = document.getElementById('set-fov');
    var elUnits = document.getElementById('set-units');
    var elQuality = document.getElementById('set-quality');
    var elMaster = document.getElementById('set-master-vol');
    var elEngine = document.getElementById('set-engine-vol');
    var elSfx = document.getElementById('set-sfx-vol');
    var elVoice = document.getElementById('set-voice');

    elControlMode.value = settings.controlMode || 'auto';
    elAssists.value = settings.assists;
    elTrans.value = settings.transmission;
    elSteer.value = settings.steerSens;
    elFov.value = settings.fov;
    elUnits.value = settings.units;
    elQuality.value = settings.quality;
    elMaster.value = settings.masterVol;
    elEngine.value = settings.engineVol;
    elSfx.value = settings.sfxVol;
    elVoice.checked = !!settings.voiceEnabled;

    function syncLabels() {
      document.getElementById('val-steer-sens').textContent = Number(settings.steerSens).toFixed(2);
      document.getElementById('val-fov').textContent = settings.fov;
      document.getElementById('val-master-vol').textContent = Math.round(settings.masterVol * 100);
      document.getElementById('val-engine-vol').textContent = Math.round(settings.engineVol * 100);
      document.getElementById('val-sfx-vol').textContent = Math.round(settings.sfxVol * 100);
    }
    syncLabels();

    function onChange() {
      settings.controlMode = elControlMode.value;
      settings.assists = elAssists.value;
      settings.transmission = elTrans.value;
      settings.steerSens = parseFloat(elSteer.value);
      settings.fov = parseInt(elFov.value, 10);
      settings.units = elUnits.value;
      settings.quality = elQuality.value;
      settings.masterVol = parseFloat(elMaster.value);
      settings.engineVol = parseFloat(elEngine.value);
      settings.sfxVol = parseFloat(elSfx.value);
      settings.voiceEnabled = elVoice.checked;

      renderer.shadowMap.enabled = settings.quality !== 'low';
      raceCamera.fov = settings.fov;
      raceCamera.updateProjectionMatrix();
      G.Audio.applyVolumes(settings);
      applyControlModeUI();
      saveJSON(STORAGE_SETTINGS, settings);
      syncLabels();
    }

    [elControlMode, elAssists, elTrans, elSteer, elFov, elUnits, elQuality, elMaster, elEngine, elSfx, elVoice].forEach(function (el) {
      el.addEventListener('input', onChange);
      el.addEventListener('change', onChange);
    });
    applyControlModeUI();
  }

  // =========================================================================
  // 3. VISUAL CO-PILOT RADIO SVG TURN ICONS & DISPATCHER
  // =========================================================================
  function buildTurnSvg(note) {
    var col = note.urgency === 'danger' ? '#ef4444' : (note.urgency === 'warn' ? '#facc15' : '#38bdf8');
    if (note.dir === 'CAUTION') {
      return '<svg viewBox="0 0 64 64" width="52" height="52"><polygon points="32,8 58,54 6,54" fill="none" stroke="' + col + '" stroke-width="5" stroke-linejoin="round"/><text x="32" y="47" text-anchor="middle" fill="' + col + '" font-size="26" font-weight="900">!</text></svg>';
    }
    if (note.dir === 'STRAIGHT') {
      return '<svg viewBox="0 0 64 64" width="52" height="52"><path d="M32 54 V12 M32 12 L20 24 M32 12 L44 24" fill="none" stroke="' + col + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    var flip = note.dir === 'LEFT' ? 'transform="translate(64,0) scale(-1,1)"' : '';
    var path = '';
    if (note.grade === 'HP') {
      // Hairpin U-turn arrow
      path = 'M20 52 V24 C20 12 44 12 44 24 V44 M44 44 L35 35 M44 44 L53 35';
    } else if (note.grade === 1 || note.grade === 2) {
      // Sharp 90-110 deg bend
      path = 'M22 54 V30 Q22 18 34 18 H50 M50 18 L40 9 M50 18 L40 27';
    } else if (note.grade === 3 || note.grade === 4) {
      // Medium 45-60 deg bend
      path = 'M24 54 V34 Q24 22 48 14 M48 14 L36 11 M48 14 L43 24';
    } else {
      // Fast sweeping 5/6 kink
      path = 'M28 54 Q28 32 42 12 M42 12 L31 15 M42 12 L45 23';
    }
    return '<svg viewBox="0 0 64 64" width="52" height="52"><g ' + flip + '><path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  }

  function displayRadioPacenote(note, nextNote, playSound) {
    activePacenote = note;
    var panel = document.getElementById('radio-panel');
    panel.classList.remove('urgency-info', 'urgency-warn', 'urgency-danger');
    panel.classList.add('urgency-' + note.urgency);

    panel.classList.remove('pulse');
    void panel.offsetWidth; // trigger reflow for pulse
    panel.classList.add('pulse');

    document.getElementById('radio-turn-icon').innerHTML = buildTurnSvg(note);
    document.getElementById('radio-grade-badge').textContent = note.grade;
    document.getElementById('radio-call-title').textContent = note.title;
    document.getElementById('radio-extra-note').textContent = note.extra || 'ON LINE';

    var statusEl = document.getElementById('radio-road-status');
    statusEl.textContent = note.statusLabel;
    statusEl.className = 'road-status ' + note.statusClass;

    var nextText = nextNote ? (nextNote.title + ' • ' + nextNote.statusLabel) : 'STAGE FINISH AHEAD';
    document.getElementById('radio-next-text').textContent = nextText;

    if (cockpitState) {
      cockpitState.callGestureTimer = 1.4;
      cockpitState.callGestureDir = note.dir === 'RIGHT' ? 1 : (note.dir === 'LEFT' ? -1 : 0);
    }

    if (playSound) {
      G.Audio.playRadioCall(note.urgency, note.spoken);
    }
  }

  // =========================================================================
  // 4. STAGE LAUNCH, COUNTDOWN, RACE LOOP & FINISH
  // =========================================================================
  function startStage() {
    G.Audio.init();
    G.Audio.applyVolumes(settings);

    var trackDef = G.getTrack(selectedTrackId);
    var carDef = G.getCar(selectedCarId);
    var tyreDef = G.getTyre(selectedTyreId);

    G.Audio.setCarProfile(carDef);

    // Build fresh 3D race scene
    raceScene = new THREE.Scene();
    raceScene.background = new THREE.Color(trackDef.skyHorizon);
    raceScene.fog = new THREE.FogExp2(trackDef.fogColor, trackDef.fogDensity);

    // Sky Dome Gradient
    var skyGeo = new THREE.SphereGeometry(520, 24, 16);
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(trackDef.skyTop) },
        bottomColor: { value: new THREE.Color(trackDef.skyHorizon) }
      },
      vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vPos; void main() { float h = clamp(normalize(vPos).y * 1.4, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.65)), 1.0); }'
    });
    raceScene.add(new THREE.Mesh(skyGeo, skyMat));

    // Biome Lighting
    var hemi = new THREE.HemisphereLight(trackDef.skyTop, trackDef.ambientColor, 0.78);
    raceScene.add(hemi);

    var sun = new THREE.DirectionalLight(trackDef.sunColor, trackDef.sunIntensity);
    sun.position.set(120, 190, -140);
    if (settings.quality !== 'low') {
      sun.castShadow = true;
      sun.shadow.mapSize.set(settings.quality === 'high' ? 2048 : 1024, settings.quality === 'high' ? 2048 : 1024);
      sun.shadow.camera.near = 20;
      sun.shadow.camera.far = 520;
      var d = 140;
      sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
      sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
    }
    raceScene.add(sun);

    // Build Track + Scenery
    activeTrack = new G.TrackInstance(trackDef, settings.quality).build();
    raceScene.add(activeTrack.group);

    // Build 1st-Person Car Cockpit Rig
    carPivot = new THREE.Group();
    cockpitState = G.createCockpitRig(carDef, tyreDef, activeTrack);
    carPivot.add(cockpitState.rig);
    carPivot.add(raceCamera);
    raceScene.add(carPivot);

    raceCamera.fov = settings.fov;
    raceCamera.updateProjectionMatrix();

    // Initialize Physics
    phys = new G.RallyPhysics(carDef, tyreDef, activeTrack, settings);

    // Reset race timers & HUD
    stageTimer = 0;
    countdownTimer = 3.2;
    lastCountdownBeep = 4;
    sector1Time = null;
    sector2Time = null;
    pacenoteCursor = 0;
    sectorToastTimer = 0;

    document.getElementById('hud-stage-name').textContent = trackDef.name;
    document.getElementById('hud-timer').textContent = '00:00.00';
    document.getElementById('hud-gold-target').textContent = formatTime(trackDef.targetTimes.gold);
    document.getElementById('hud-best-time').textContent = records[trackDef.id] ? formatTime(records[trackDef.id].time) : '--:--.--';
    document.getElementById('sector-toast').classList.add('hidden');

    if (activeTrack.pacenotes.length > 0) {
      displayRadioPacenote(activeTrack.pacenotes[0], activeTrack.pacenotes[1], false);
      pacenoteCursor = 1;
    }

    // Show Race Overlay, hide Menu & Modals
    applyControlModeUI();
    glanceToggle = false;
    touchState = { left: false, right: false, gas: false, brake: false, hb: false };
    document.getElementById('t-btn-glance').classList.remove('active');
    document.getElementById('t-btn-lights').classList.toggle('active', cockpitState.lightsOn);
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('finish-modal').classList.add('hidden');
    document.getElementById('race-overlay').classList.remove('hidden');
    document.getElementById('countdown-banner').classList.remove('hidden');

    mode = 'COUNTDOWN';
  }

  function showSectorToast(label, splitTime, targetFraction) {
    var toast = document.getElementById('sector-toast');
    var refTime = records[selectedTrackId]
      ? records[selectedTrackId].time * targetFraction
      : G.getTrack(selectedTrackId).targetTimes.gold * targetFraction;
    var delta = splitTime - refTime;
    var sign = delta <= 0 ? '-' : '+';
    toast.textContent = label + ' ' + formatTime(splitTime) + ' (' + sign + Math.abs(delta).toFixed(2) + 's)';
    toast.className = 'sector-toast' + (delta > 0 ? ' slow' : '');
    toast.classList.remove('hidden');
    sectorToastTimer = 3.4;
  }

  function finishStage() {
    mode = 'FINISHED';
    G.Audio.setPaused(true);

    var trackDef = G.getTrack(selectedTrackId);
    var prevBest = records[trackDef.id] ? records[trackDef.id].time : Infinity;
    var isNewPB = stageTimer < prevBest;
    if (isNewPB) {
      records[trackDef.id] = {
        time: stageTimer,
        car: selectedCarId,
        tyre: selectedTyreId
      };
      saveJSON(STORAGE_RECORDS, records);
    }

    var medalEl = document.getElementById('finish-medal-badge');
    if (stageTimer <= trackDef.targetTimes.gold) {
      medalEl.textContent = '★ GOLD WRC STAGE TIME ★';
      medalEl.className = 'finish-medal gold';
    } else if (stageTimer <= trackDef.targetTimes.silver) {
      medalEl.textContent = 'SILVER STAGE TIME';
      medalEl.className = 'finish-medal silver';
    } else {
      medalEl.textContent = 'BRONZE STAGE FINISH';
      medalEl.className = 'finish-medal bronze';
    }

    document.getElementById('finish-stage-title').textContent = trackDef.name;
    document.getElementById('finish-total-time').textContent = formatTime(stageTimer);
    document.getElementById('finish-pb-banner').classList.toggle('hidden', !isNewPB);

    document.getElementById('fin-s1').textContent = formatTime(sector1Time);
    document.getElementById('fin-s2').textContent = formatTime(sector2Time);
    var unitFactor = settings.units === 'mph' ? 0.621371 : 1.0;
    var unitLbl = settings.units === 'mph' ? ' MPH' : ' KM/H';
    document.getElementById('fin-top-spd').textContent = Math.round(phys.topSpeedKmh * unitFactor) + unitLbl;
    document.getElementById('fin-drift').textContent = Math.round(phys.maxDriftDeg) + '°';
    document.getElementById('fin-tyre').textContent = Math.round(phys.tyreHealth * 100) + '%';
    document.getElementById('fin-off').textContent = String(phys.offTrackPenaltyCount);

    document.getElementById('finish-modal').classList.remove('hidden');
  }

  function returnToMenu() {
    mode = 'MENU';
    G.Audio.setPaused(true);
    document.getElementById('race-overlay').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('finish-modal').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    renderMenuUI();
  }

  function togglePause() {
    if (mode === 'RACING' || mode === 'COUNTDOWN') {
      mode = 'PAUSED';
      G.Audio.setPaused(true);
      document.getElementById('pause-stage-info').textContent = G.getTrack(selectedTrackId).name;
      document.getElementById('pause-modal').classList.remove('hidden');
    } else if (mode === 'PAUSED') {
      mode = countdownTimer > 0 ? 'COUNTDOWN' : 'RACING';
      document.getElementById('pause-modal').classList.add('hidden');
    }
  }

  // =========================================================================
  // 5. KEYBOARD & MOUSE INPUT LISTENERS
  // =========================================================================
  window.addEventListener('keydown', function (e) {
    if (keys[e.code]) return;
    keys[e.code] = true;

    if (e.code === 'Escape') {
      if (mode === 'RACING' || mode === 'COUNTDOWN' || mode === 'PAUSED') {
        togglePause();
      }
      return;
    }

    if (mode !== 'RACING' && mode !== 'COUNTDOWN') return;

    if (e.code === 'KeyE' && settings.transmission === 'manual' && phys) {
      phys.shiftUp();
    } else if (e.code === 'KeyQ' && settings.transmission === 'manual' && phys) {
      phys.shiftDown();
    } else if (e.code === 'KeyV' && cockpitState) {
      cockpitState.wiperContinuous = !cockpitState.wiperContinuous;
    } else if (e.code === 'KeyL' && cockpitState) {
      cockpitState.lightsOn = !cockpitState.lightsOn;
      cockpitState.headlight.intensity = cockpitState.lightsOn ? 1.8 : 0.0;
    } else if (e.code === 'KeyR' && phys && mode === 'RACING') {
      phys.recoverToTrack();
    }
  });

  window.addEventListener('keyup', function (e) {
    keys[e.code] = false;
  });

  function bindTouchPad(el, keyName) {
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
  }

  bindTouchPad(document.getElementById('t-pad-left'), 'left');
  bindTouchPad(document.getElementById('t-pad-right'), 'right');
  bindTouchPad(document.getElementById('t-pad-gas'), 'gas');
  bindTouchPad(document.getElementById('t-pad-brake'), 'brake');
  bindTouchPad(document.getElementById('t-pad-hb'), 'hb');

  document.getElementById('t-pad-shift-up').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (phys && settings.transmission === 'manual') phys.shiftUp();
  });
  document.getElementById('t-pad-shift-down').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (phys && settings.transmission === 'manual') phys.shiftDown();
  });
  document.getElementById('t-btn-glance').addEventListener('click', function () {
    glanceToggle = !glanceToggle;
    this.classList.toggle('active', glanceToggle);
  });
  document.getElementById('t-btn-wipers').addEventListener('click', function () {
    if (cockpitState) {
      cockpitState.wiperContinuous = !cockpitState.wiperContinuous;
      this.classList.toggle('active', cockpitState.wiperContinuous);
    }
  });
  document.getElementById('t-btn-lights').addEventListener('click', function () {
    if (cockpitState) {
      cockpitState.lightsOn = !cockpitState.lightsOn;
      cockpitState.headlight.intensity = cockpitState.lightsOn ? 1.8 : 0.0;
      this.classList.toggle('active', cockpitState.lightsOn);
    }
  });
  document.getElementById('t-btn-recover').addEventListener('click', function () {
    if (phys && mode === 'RACING') phys.recoverToTrack();
  });
  document.getElementById('t-btn-pause').addEventListener('click', togglePause);

  function sampleInputs() {
    var thr = (keys.KeyW || keys.ArrowUp || touchState.gas) ? 1 : 0;
    var brk = (keys.KeyS || keys.ArrowDown || touchState.brake) ? 1 : 0;
    var left = (keys.KeyA || keys.ArrowLeft || touchState.left) ? 1 : 0;
    var right = (keys.KeyD || keys.ArrowRight || touchState.right) ? 1 : 0;
    input.throttle = thr;
    input.brake = brk;
    input.steer = left - right; // +1 = LEFT, -1 = RIGHT
    input.handbrake = !!(keys.Space || touchState.hb);
  }

  // Main Menu Tabs & Garage Drag-to-Rotate
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
  });

  var spacer = document.querySelector('.showcase-spacer');
  spacer.addEventListener('mousedown', function (e) {
    isDraggingGarage = true;
    lastDragX = e.clientX;
  });
  window.addEventListener('mousemove', function (e) {
    if (isDraggingGarage && mode === 'MENU') {
      var dx = e.clientX - lastDragX;
      lastDragX = e.clientX;
      turntableYaw += dx * 0.01;
    }
  });
  window.addEventListener('mouseup', function () { isDraggingGarage = false; });

  // Button Bindings
  document.getElementById('btn-start-stage').addEventListener('click', startStage);
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-restart').addEventListener('click', startStage);
  document.getElementById('btn-quit-menu').addEventListener('click', returnToMenu);
  document.getElementById('btn-finish-retry').addEventListener('click', startStage);
  document.getElementById('btn-finish-menu').addEventListener('click', returnToMenu);
  document.getElementById('btn-finish-next').addEventListener('click', function () {
    var idx = G.TRACKS.findIndex(function (t) { return t.id === selectedTrackId; });
    selectedTrackId = G.TRACKS[(idx + 1) % G.TRACKS.length].id;
    startStage();
  });

  window.addEventListener('resize', function () {
    var w = window.innerWidth;
    var h = window.innerHeight;
    renderer.setSize(w, h);
    menuCamera.aspect = w / h;
    menuCamera.updateProjectionMatrix();
    raceCamera.aspect = w / h;
    raceCamera.updateProjectionMatrix();
  });

  // =========================================================================
  // 6. MAIN ANIMATION & FIXED-TIMESTEP PHYSICS LOOP
  // =========================================================================
  var lastTime = performance.now();
  var physAccumulator = 0;
  var FIXED_DT = 1 / 120;

  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (mode === 'MENU') {
      if (!isDraggingGarage) turntableYaw += dt * 0.35;
      garagePivot.rotation.y = turntableYaw;
      renderer.render(menuScene, menuCamera);
      return;
    }

    if (mode === 'PAUSED' || mode === 'FINISHED') {
      renderer.render(raceScene, raceCamera);
      return;
    }

    sampleInputs();

    // Handle 3..2..1..GO! Start Countdown
    if (mode === 'COUNTDOWN') {
      countdownTimer -= dt;
      var secCeil = Math.ceil(countdownTimer);
      var l1 = document.getElementById('cd-l1');
      var l2 = document.getElementById('cd-l2');
      var l3 = document.getElementById('cd-l3');
      var txt = document.getElementById('countdown-text');

      if (countdownTimer > 0) {
        txt.textContent = String(Math.max(1, secCeil));
        l1.className = 'cd-light' + (secCeil <= 3 ? ' red' : '');
        l2.className = 'cd-light' + (secCeil <= 2 ? ' red' : '');
        l3.className = 'cd-light' + (secCeil <= 1 ? ' red' : '');

        if (activeTrack && activeTrack.startLightBulbs) {
          activeTrack.startLightBulbs[0].color.setHex(secCeil <= 3 ? 0xef4444 : 0x331111);
          activeTrack.startLightBulbs[1].color.setHex(secCeil <= 2 ? 0xef4444 : 0x331111);
          activeTrack.startLightBulbs[2].color.setHex(secCeil <= 1 ? 0xef4444 : 0x331111);
        }

        if (secCeil < lastCountdownBeep && secCeil >= 1) {
          lastCountdownBeep = secCeil;
          G.Audio.playCountdownBeep(false);
        }
      } else {
        mode = 'RACING';
        txt.textContent = 'GO!';
        l1.className = 'cd-light green';
        l2.className = 'cd-light green';
        l3.className = 'cd-light green';
        if (activeTrack && activeTrack.startLightBulbs) {
          activeTrack.startLightBulbs.forEach(function (m) { m.color.setHex(0x22c55e); });
        }
        G.Audio.playCountdownBeep(true);
        setTimeout(function () {
          document.getElementById('countdown-banner').classList.add('hidden');
        }, 700);
      }
    }

    // Fixed 120 Hz Physics Integration
    physAccumulator += dt;
    while (physAccumulator >= FIXED_DT) {
      phys.step(input, FIXED_DT, mode === 'RACING');
      physAccumulator -= FIXED_DT;
    }

    // Update Stage Timer & Sector Splits
    if (mode === 'RACING') {
      stageTimer += dt;
      document.getElementById('hud-timer').textContent = formatTime(stageTimer);

      if (sector1Time === null && phys.trackDist >= activeTrack.totalLength * 0.33) {
        sector1Time = stageTimer;
        showSectorToast('SECTOR 1', sector1Time, 0.33);
      }
      if (sector2Time === null && phys.trackDist >= activeTrack.totalLength * 0.66) {
        sector2Time = stageTimer;
        showSectorToast('SECTOR 2', sector2Time, 0.66);
      }

      if (sectorToastTimer > 0) {
        sectorToastTimer -= dt;
        if (sectorToastTimer <= 0) {
          document.getElementById('sector-toast').classList.add('hidden');
        }
      }

      // Dispatch Co-Pilot Radio Commands based on track distance ahead
      while (pacenoteCursor < activeTrack.pacenotes.length &&
             phys.trackDist >= activeTrack.pacenotes[pacenoteCursor].triggerDist) {
        var note = activeTrack.pacenotes[pacenoteCursor];
        var nextNote = activeTrack.pacenotes[pacenoteCursor + 1] || null;
        displayRadioPacenote(note, nextNote, true);
        pacenoteCursor++;
      }

      // Finish line check!
      if (phys.trackDist >= activeTrack.finishDist) {
        finishStage();
      }
    }

    // Apply car chassis transform
    carPivot.position.copy(phys.pos);
    carPivot.rotation.set(0, 0, 0);
    carPivot.rotateY(phys.yaw);
    carPivot.rotateX(phys.pitch);
    carPivot.rotateZ(phys.roll);

    // 1st-Person Cockpit Camera POV inside the car (Driver Left Seat)
    // Positioned so road, hood, steering wheel, analog gauges, center map screen, AND co-pilot are visible!
    var targetGlance = (keys.KeyC || glanceToggle) ? 1.0 : 0.0;
    glanceFactor += (targetGlance - glanceFactor) * Math.min(1, dt * 8);

    var headSwayX = Math.max(-0.045, Math.min(0.045, -phys.latG * 0.025));
    var headJoltY = Math.max(-0.035, Math.min(0.035, -phys.vertVel * 0.008)) + (phys.impactEvent * (Math.random() - 0.5) * 0.05);
    var headSwayZ = Math.max(-0.03, Math.min(0.03, phys.longG * 0.025));

    // Slightly angled (-0.07 rad) toward center-right naturally frames center map screen + co-pilot on right!
    raceCamera.position.set(-0.24 + headSwayX + glanceFactor * 0.08, 1.15 + headJoltY, 0.16 + headSwayZ);
    raceCamera.rotation.order = 'YXZ';
    raceCamera.rotation.y = -0.075 - glanceFactor * 0.38;
    raceCamera.rotation.x = -0.075 - glanceFactor * 0.04;
    raceCamera.rotation.z = -phys.latG * 0.014;

    // Subtle speed FOV punch
    var desiredFov = settings.fov + Math.min(7, phys.speedKmh * 0.038);
    if (Math.abs(raceCamera.fov - desiredFov) > 0.1) {
      raceCamera.fov += (desiredFov - raceCamera.fov) * Math.min(1, dt * 6);
      raceCamera.updateProjectionMatrix();
    }

    // Update animated cockpit (Steering Wheel, Co-Pilot, Gauges, Physical Track Map Screen, Wipers)
    G.updateCockpitRig(cockpitState, phys, activePacenote, settings, dt, now / 1000);

    // Update biome weather & tyre spray particles
    activeTrack.updateEffects(phys.pos, dt);

    // Update Web Audio synthesis
    G.Audio.update({
      rpm: phys.rpm,
      redline: phys.car.redlineRpm,
      throttle: phys.throttle,
      boost: phys.boost,
      speedKmh: phys.speedKmh,
      slipIntensity: phys.slipIntensity,
      surfaceId: phys.surfaceId,
      airborne: phys.airborne
    }, dt);

    renderer.render(raceScene, raceCamera);
  }

  // Boot Application
  initMenuScene();
  renderMenuUI();
  bindSettingsControls();
  requestAnimationFrame(tick);
})(window.GroupBRally);
