/**
 * Mobile / iPhone Controller for APEX GROUP B Rally
 * - Multi-touch steering pads, Gas/Brake/Handbrake pedals & Manual shift buttons
 * - Optional iOS Gyroscope Tilt Steering (with permission request)
 * - Adaptive Portrait/Landscape Cockpit FOV so Co-Pilot & 3D Dashboard Map remain visible
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  var STORAGE_SETTINGS = 'groupb_mobile_settings_v1';
  var STORAGE_RECORDS = 'groupb_rally_records_v1';

  var defaultSettings = {
    controlMode: 'auto',
    steerMode: 'buttons',
    assists: 'arcade',
    transmission: 'auto',
    steerSens: 1.0,
    quality: 'medium',
    units: 'kmh',
    voiceEnabled: true,
    masterVol: 0.75,
    engineVol: 0.80,
    sfxVol: 0.85
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
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
  }

  var settings = loadJSON(STORAGE_SETTINGS, defaultSettings);
  var records = loadJSON(STORAGE_RECORDS, {});

  var selectedTrackId = 'forest';
  var selectedCarId = 'bergmeister_q85';
  var selectedTyreId = 'gravel_soft';
  var mode = 'MENU';

  function getViewportSize() {
    if (window.visualViewport) {
      return { w: Math.round(window.visualViewport.width), h: Math.round(window.visualViewport.height) };
    }
    return { w: window.innerWidth, h: window.innerHeight };
  }

  // Three.js Renderer
  var canvas = document.getElementById('game-canvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  var initVp = getViewportSize();
  renderer.setSize(initVp.w, initVp.h, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = settings.quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var menuScene = new THREE.Scene();
  var menuCamera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 100);
  var garagePivot = new THREE.Group();
  var garageCarMesh = null;
  var turntableYaw = 0.65;
  var dragActive = false;
  var lastTouchX = 0;

  var raceScene = null;
  var raceCamera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 650);
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
  var glanceToggle = false;
  var glanceFactor = 0;

  // Touch & Gyro input state
  var touchState = { left: false, right: false, gas: false, brake: false, hb: false };
  var gyroSteer = 0;
  var input = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  function getAdaptiveFov(w, h) {
    var vw = w || getViewportSize().w;
    var vh = h || getViewportSize().h;
    if (vh > vw) {
      // Preserve comfortable horizontal cockpit FOV in portrait mode
      var aspect = Math.max(0.35, vw / Math.max(1, vh));
      var vFov = 2 * Math.atan(Math.tan(38 * Math.PI / 180) / aspect) * (180 / Math.PI);
      return Math.min(104, Math.max(76, vFov));
    }
    return 72;
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
  // 1. GARAGE SHOWCASE SCENE
  // =========================================================================
  function initMenuScene() {
    menuScene.background = new THREE.Color(0x0c1016);
    menuScene.fog = new THREE.FogExp2(0x0c1016, 0.045);

    menuCamera.position.set(3.8, 2.0, 5.4);
    menuCamera.lookAt(0, 0.5, 0);

    menuScene.add(new THREE.AmbientLight(0x94a3b8, 0.65));
    var keySpot = new THREE.SpotLight(0xfff1d6, 2.3, 24, Math.PI / 4, 0.45, 1.0);
    keySpot.position.set(4.5, 6.2, 4.5);
    menuScene.add(keySpot);

    var rimSpot = new THREE.SpotLight(0x38bdf8, 1.4, 20, Math.PI / 3.5, 0.5, 1.0);
    rimSpot.position.set(-5.0, 3.6, -4.0);
    menuScene.add(rimSpot);

    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.6, metalness: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    menuScene.add(floor);

    var plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.75, 2.95, 0.14, 40),
      new THREE.MeshStandardMaterial({ color: 0x222936, roughness: 0.35, metalness: 0.55 })
    );
    plinth.position.y = 0.07;
    garagePivot.add(plinth);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.76, 0.025, 8, 56),
      new THREE.MeshBasicMaterial({ color: 0xe11d48 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.145;
    garagePivot.add(ring);

    menuScene.add(garagePivot);
    rebuildGarageCar();
  }

  function rebuildGarageCar() {
    if (garageCarMesh) garagePivot.remove(garageCarMesh);
    garageCarMesh = G.createExteriorCar(G.getCar(selectedCarId), G.getTyre(selectedTyreId));
    garageCarMesh.position.y = 0.14;
    garagePivot.add(garageCarMesh);
  }

  // =========================================================================
  // 2. MOBILE MENU UI
  // =========================================================================
  function renderMobileMenu() {
    var trackList = document.getElementById('m-track-list');
    trackList.innerHTML = '';
    G.TRACKS.forEach(function (tr) {
      var card = document.createElement('div');
      card.className = 'm-card' + (tr.id === selectedTrackId ? ' selected' : '');
      var best = records[tr.id] ? formatTime(records[tr.id].time) : '--:--.--';
      card.innerHTML =
        '<div class="m-card-row">' +
          '<span class="m-card-title">' + tr.name + '</span>' +
          '<span class="biome-pill biome-' + tr.biome + '">' + tr.biomeLabel + '</span>' +
        '</div>' +
        '<div class="m-card-sub">' + tr.description + '</div>' +
        '<div class="m-card-meta"><span>GOLD: ' + formatTime(tr.targetTimes.gold) + '</span><span>BEST: ' + best + '</span></div>';
      card.addEventListener('click', function () {
        selectedTrackId = tr.id;
        renderMobileMenu();
      });
      trackList.appendChild(card);
    });

    var carList = document.getElementById('m-car-list');
    carList.innerHTML = '';
    G.CARS.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'm-card' + (c.id === selectedCarId ? ' selected' : '');
      var fPct = Math.round(c.frontWeightBias * 100);
      card.innerHTML =
        '<div class="m-card-row">' +
          '<span class="m-card-title">' + c.name + '</span>' +
          '<span class="biome-pill biome-jungle">' + c.drivetrain + ' • ' + c.powerHp + ' HP</span>' +
        '</div>' +
        '<div class="m-card-sub">' + c.summary + '</div>' +
        '<div class="m-card-meta"><span>MASS: ' + c.massKg + ' KG</span><span>BIAS: ' + fPct + '/' + (100 - fPct) + ' F/R</span></div>';
      card.addEventListener('click', function () {
        selectedCarId = c.id;
        rebuildGarageCar();
        renderMobileMenu();
      });
      carList.appendChild(card);
    });

    var track = G.getTrack(selectedTrackId);
    var tyreList = document.getElementById('m-tyre-list');
    tyreList.innerHTML = '';
    G.TYRES.forEach(function (ty) {
      var rec = ty.id === track.recommendedTyre;
      var card = document.createElement('div');
      card.className = 'm-card' + (ty.id === selectedTyreId ? ' selected' : '');
      card.innerHTML =
        '<div class="m-card-row"><span class="m-card-title" style="font-size:12px;">' + ty.name + '</span></div>' +
        '<div class="m-card-sub">' + ty.tag + (rec ? ' • <strong style="color:#4ade80;">★ BEST</strong>' : '') + '</div>';
      card.addEventListener('click', function () {
        selectedTyreId = ty.id;
        rebuildGarageCar();
        renderMobileMenu();
      });
      tyreList.appendChild(card);
    });

    var car = G.getCar(selectedCarId);
    var tyre = G.getTyre(selectedTyreId);
    document.getElementById('m-car-name').textContent = car.name;
    document.getElementById('m-car-pill').textContent = car.drivetrain + ' • ' + car.massKg + ' KG';
    document.getElementById('m-sum-track').innerHTML = '<strong>STAGE:</strong> ' + track.name;
    document.getElementById('m-sum-best').innerHTML =
      '<strong>BEST:</strong> ' + (records[track.id] ? formatTime(records[track.id].time) : '--:--.--') + ' • ' + tyre.name;
  }

  function applyMobileControlVisibility() {
    var phoneMode = isPhoneControlsActive();
    var ctrlLayer = document.querySelector('.m-controls-layer');
    if (ctrlLayer) ctrlLayer.classList.toggle('hidden', !phoneMode);
    document.getElementById('m-steer-zone').classList.toggle('hidden', !phoneMode || settings.steerMode === 'tilt');
  }

  function bindSettings() {
    var elControlMode = document.getElementById('m-control-mode');
    var elSteerMode = document.getElementById('m-steer-mode');
    var elAssists = document.getElementById('m-assists');
    var elTrans = document.getElementById('m-trans');
    var elSens = document.getElementById('m-steer-sens');
    var elQuality = document.getElementById('m-quality');
    var elUnits = document.getElementById('m-units');
    var elVoice = document.getElementById('m-voice');

    elControlMode.value = settings.controlMode || 'auto';
    elSteerMode.value = settings.steerMode;
    elAssists.value = settings.assists;
    elTrans.value = settings.transmission;
    elSens.value = settings.steerSens;
    elQuality.value = settings.quality;
    elUnits.value = settings.units;
    elVoice.checked = !!settings.voiceEnabled;
    document.getElementById('m-val-sens').textContent = Number(settings.steerSens).toFixed(2);

    function update() {
      settings.controlMode = elControlMode.value;
      settings.steerMode = elSteerMode.value;
      settings.assists = elAssists.value;
      settings.transmission = elTrans.value;
      settings.steerSens = parseFloat(elSens.value);
      settings.quality = elQuality.value;
      settings.units = elUnits.value;
      settings.voiceEnabled = elVoice.checked;
      document.getElementById('m-val-sens').textContent = Number(settings.steerSens).toFixed(2);
      renderer.shadowMap.enabled = settings.quality !== 'low';
      G.Audio.applyVolumes(settings);
      applyMobileControlVisibility();
      saveJSON(STORAGE_SETTINGS, settings);
    }

    [elControlMode, elSteerMode, elAssists, elTrans, elSens, elQuality, elUnits, elVoice].forEach(function (el) {
      el.addEventListener('change', update);
      el.addEventListener('input', update);
    });
    applyMobileControlVisibility();
  }

  // =========================================================================
  // 3. VISUAL RADIO COMMANDS
  // =========================================================================
  function buildTurnSvg(note) {
    var col = note.urgency === 'danger' ? '#ef4444' : (note.urgency === 'warn' ? '#facc15' : '#38bdf8');
    if (note.dir === 'CAUTION') {
      return '<svg viewBox="0 0 64 64" width="36" height="36"><polygon points="32,8 58,54 6,54" fill="none" stroke="' + col + '" stroke-width="5" stroke-linejoin="round"/><text x="32" y="47" text-anchor="middle" fill="' + col + '" font-size="26" font-weight="900">!</text></svg>';
    }
    if (note.dir === 'STRAIGHT') {
      return '<svg viewBox="0 0 64 64" width="36" height="36"><path d="M32 54 V12 M32 12 L20 24 M32 12 L44 24" fill="none" stroke="' + col + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    var flip = note.dir === 'LEFT' ? 'transform="translate(64,0) scale(-1,1)"' : '';
    var path = note.grade === 'HP'
      ? 'M20 52 V24 C20 12 44 12 44 24 V44 M44 44 L35 35 M44 44 L53 35'
      : (note.grade <= 2
        ? 'M22 54 V30 Q22 18 34 18 H50 M50 18 L40 9 M50 18 L40 27'
        : 'M24 54 V34 Q24 22 48 14 M48 14 L36 11 M48 14 L43 24');
    return '<svg viewBox="0 0 64 64" width="36" height="36"><g ' + flip + '><path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  }

  function displayRadioPacenote(note, playSound) {
    activePacenote = note;
    var panel = document.getElementById('radio-panel');
    panel.className = 'm-radio urgency-' + note.urgency;
    document.getElementById('radio-turn-icon').innerHTML = buildTurnSvg(note);
    document.getElementById('radio-grade-badge').textContent = note.grade;
    document.getElementById('radio-call-title').textContent = note.title;
    document.getElementById('radio-extra-note').textContent = note.extra || 'ON LINE';

    var st = document.getElementById('radio-road-status');
    st.textContent = note.statusLabel;
    st.className = 'road-status ' + note.statusClass;

    if (cockpitState) {
      cockpitState.callGestureTimer = 1.4;
      cockpitState.callGestureDir = note.dir === 'RIGHT' ? 1 : (note.dir === 'LEFT' ? -1 : 0);
    }
    if (playSound) G.Audio.playRadioCall(note.urgency, note.spoken);
  }

  // =========================================================================
  // 4. GYROSCOPE & MULTI-TOUCH PEDAL BINDING
  // =========================================================================
  function setupGyroIfNeeded() {
    if (settings.steerMode !== 'tilt') return;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (resp) {
        if (resp === 'granted') window.addEventListener('deviceorientation', onOrientation);
      }).catch(function () {});
    } else {
      window.addEventListener('deviceorientation', onOrientation);
    }
  }

  function onOrientation(e) {
    if (settings.steerMode !== 'tilt') return;
    var landscape = window.innerWidth > window.innerHeight;
    var raw = landscape ? (e.beta || 0) : (e.gamma || 0);
    // Normalize ~32 deg full lock tilt
    var norm = Math.max(-1, Math.min(1, -raw / 32));
    if (Math.abs(norm) < 0.06) norm = 0;
    gyroSteer = norm;
  }

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

  // Suppress iOS Safari pinch-zoom, double-tap zoom, pull-to-refresh & long-press haptics/menus
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu'].forEach(function (evt) {
    document.addEventListener(evt, function (e) { e.preventDefault(); }, { passive: false });
  });
  var lastTapTime = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTapTime < 300) {
      // Block rapid double-tap zoom while still allowing normal button taps
      if (!e.target.closest('.m-tab-body')) {
        e.preventDefault();
      }
    }
    lastTapTime = now;
  }, { passive: false });

  bindTouchPad(document.getElementById('pad-left'), 'left');
  bindTouchPad(document.getElementById('pad-right'), 'right');
  bindTouchPad(document.getElementById('pad-gas'), 'gas');
  bindTouchPad(document.getElementById('pad-brake'), 'brake');
  bindTouchPad(document.getElementById('pad-hb'), 'hb');

  document.getElementById('pad-shift-up').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (phys && settings.transmission === 'manual') phys.shiftUp();
  });
  document.getElementById('pad-shift-down').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (phys && settings.transmission === 'manual') phys.shiftDown();
  });

  // =========================================================================
  // 5. START STAGE, PAUSE & FINISH
  // =========================================================================
  function startStage() {
    G.Audio.init();
    G.Audio.applyVolumes(settings);
    setupGyroIfNeeded();

    var trackDef = G.getTrack(selectedTrackId);
    var carDef = G.getCar(selectedCarId);
    var tyreDef = G.getTyre(selectedTyreId);
    G.Audio.setCarProfile(carDef);

    raceScene = new THREE.Scene();
    raceScene.background = new THREE.Color(trackDef.skyHorizon);
    raceScene.fog = new THREE.FogExp2(trackDef.fogColor, trackDef.fogDensity);

    var skyGeo = new THREE.SphereGeometry(520, 20, 14);
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

    raceScene.add(new THREE.HemisphereLight(trackDef.skyTop, trackDef.ambientColor, 0.8));
    var sun = new THREE.DirectionalLight(trackDef.sunColor, trackDef.sunIntensity);
    sun.position.set(120, 190, -140);
    if (settings.quality !== 'low') {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 20; sun.shadow.camera.far = 480;
      sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
      sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
    }
    raceScene.add(sun);

    activeTrack = new G.TrackInstance(trackDef, settings.quality).build();
    raceScene.add(activeTrack.group);

    carPivot = new THREE.Group();
    cockpitState = G.createCockpitRig(carDef, tyreDef, activeTrack);
    carPivot.add(cockpitState.rig);
    carPivot.add(raceCamera);
    raceScene.add(carPivot);

    raceCamera.fov = getAdaptiveFov();
    raceCamera.updateProjectionMatrix();

    phys = new G.RallyPhysics(carDef, tyreDef, activeTrack, settings);

    stageTimer = 0;
    countdownTimer = 3.2;
    lastCountdownBeep = 4;
    sector1Time = null;
    sector2Time = null;
    pacenoteCursor = 0;
    sectorToastTimer = 0;
    glanceToggle = false;
    touchState = { left: false, right: false, gas: false, brake: false, hb: false };

    document.getElementById('hud-timer').textContent = '00:00.00';
    document.getElementById('hud-gold-target').textContent = formatTime(trackDef.targetTimes.gold);
    document.getElementById('sector-toast').classList.add('hidden');
    applyMobileControlVisibility();
    document.getElementById('pad-shift-up').classList.toggle('hidden', settings.transmission !== 'manual');
    document.getElementById('pad-shift-down').classList.toggle('hidden', settings.transmission !== 'manual');
    document.getElementById('btn-lights').classList.toggle('active', cockpitState.lightsOn);

    if (activeTrack.pacenotes.length > 0) {
      displayRadioPacenote(activeTrack.pacenotes[0], false);
      pacenoteCursor = 1;
    }

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('finish-modal').classList.add('hidden');
    document.getElementById('race-overlay').classList.remove('hidden');
    document.getElementById('countdown-banner').classList.remove('hidden');

    mode = 'COUNTDOWN';
  }

  function showSectorToast(label, splitTime, frac) {
    var toast = document.getElementById('sector-toast');
    var ref = records[selectedTrackId] ? records[selectedTrackId].time * frac : G.getTrack(selectedTrackId).targetTimes.gold * frac;
    var d = splitTime - ref;
    toast.textContent = label + ' ' + (d <= 0 ? '-' : '+') + Math.abs(d).toFixed(2) + 's';
    toast.className = 'sector-toast' + (d > 0 ? ' slow' : '');
    toast.classList.remove('hidden');
    sectorToastTimer = 3.2;
  }

  function finishStage() {
    mode = 'FINISHED';
    G.Audio.setPaused(true);
    var tr = G.getTrack(selectedTrackId);
    var prev = records[tr.id] ? records[tr.id].time : Infinity;
    var isPB = stageTimer < prev;
    if (isPB) {
      records[tr.id] = { time: stageTimer, car: selectedCarId, tyre: selectedTyreId };
      saveJSON(STORAGE_RECORDS, records);
    }
    var medal = document.getElementById('finish-medal-badge');
    if (stageTimer <= tr.targetTimes.gold) { medal.textContent = '★ GOLD WRC STAGE TIME ★'; medal.className = 'finish-medal gold'; }
    else if (stageTimer <= tr.targetTimes.silver) { medal.textContent = 'SILVER STAGE TIME'; medal.className = 'finish-medal silver'; }
    else { medal.textContent = 'BRONZE STAGE FINISH'; medal.className = 'finish-medal bronze'; }

    document.getElementById('finish-stage-title').textContent = tr.name;
    document.getElementById('finish-total-time').textContent = formatTime(stageTimer);
    document.getElementById('finish-pb-banner').classList.toggle('hidden', !isPB);
    document.getElementById('fin-s1').textContent = formatTime(sector1Time);
    document.getElementById('fin-s2').textContent = formatTime(sector2Time);
    var uf = settings.units === 'mph' ? 0.621371 : 1;
    document.getElementById('fin-top-spd').textContent = Math.round(phys.topSpeedKmh * uf) + (settings.units === 'mph' ? ' MPH' : ' KM/H');
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
    renderMobileMenu();
  }

  // UI Event Listeners
  document.querySelectorAll('.m-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.m-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.m-panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
    });
  });

  var dragArea = document.getElementById('m-showcase-drag');
  dragArea.addEventListener('pointerdown', function (e) { dragActive = true; lastTouchX = e.clientX; });
  window.addEventListener('pointermove', function (e) {
    if (dragActive && mode === 'MENU') {
      turntableYaw += (e.clientX - lastTouchX) * 0.012;
      lastTouchX = e.clientX;
    }
  });
  window.addEventListener('pointerup', function () { dragActive = false; });

  document.getElementById('m-btn-start').addEventListener('click', startStage);
  document.getElementById('btn-pause').addEventListener('click', function () {
    if (mode === 'RACING' || mode === 'COUNTDOWN') {
      mode = 'PAUSED';
      G.Audio.setPaused(true);
      document.getElementById('pause-stage-info').textContent = G.getTrack(selectedTrackId).name;
      document.getElementById('pause-modal').classList.remove('hidden');
    }
  });
  document.getElementById('btn-resume').addEventListener('click', function () {
    mode = countdownTimer > 0 ? 'COUNTDOWN' : 'RACING';
    document.getElementById('pause-modal').classList.add('hidden');
  });
  document.getElementById('btn-restart').addEventListener('click', startStage);
  document.getElementById('btn-quit-menu').addEventListener('click', returnToMenu);
  document.getElementById('btn-finish-retry').addEventListener('click', startStage);
  document.getElementById('btn-finish-menu').addEventListener('click', returnToMenu);
  document.getElementById('btn-finish-next').addEventListener('click', function () {
    var idx = G.TRACKS.findIndex(function (t) { return t.id === selectedTrackId; });
    selectedTrackId = G.TRACKS[(idx + 1) % G.TRACKS.length].id;
    startStage();
  });

  document.getElementById('btn-glance').addEventListener('click', function () {
    glanceToggle = !glanceToggle;
    this.classList.toggle('active', glanceToggle);
  });
  document.getElementById('btn-wipers').addEventListener('click', function () {
    if (cockpitState) {
      cockpitState.wiperContinuous = !cockpitState.wiperContinuous;
      this.classList.toggle('active', cockpitState.wiperContinuous);
    }
  });
  document.getElementById('btn-lights').addEventListener('click', function () {
    if (cockpitState) {
      cockpitState.lightsOn = !cockpitState.lightsOn;
      cockpitState.headlight.intensity = cockpitState.lightsOn ? 1.8 : 0.0;
      this.classList.toggle('active', cockpitState.lightsOn);
    }
  });
  document.getElementById('btn-recover').addEventListener('click', function () {
    if (phys && mode === 'RACING') phys.recoverToTrack();
  });

  function updateViewport() {
    var vp = getViewportSize();
    var w = vp.w, h = vp.h;
    renderer.setSize(w, h, false);
    var isLandscape = w > h && h <= 580;
    menuCamera.aspect = w / h;
    menuCamera.fov = isLandscape ? 42 : 48;
    menuCamera.updateProjectionMatrix();
    if (isLandscape) {
      menuCamera.position.set(4.5, 2.0, 5.8);
      menuCamera.lookAt(1.5, 0.72, 0); // shifts 3D car cleanly into the left showcase half
    } else {
      menuCamera.position.set(3.8, 2.0, 5.4);
      menuCamera.lookAt(0, 0.5, 0);
    }
    raceCamera.aspect = w / h;
    raceCamera.fov = getAdaptiveFov(w, h);
    raceCamera.updateProjectionMatrix();
  }

  updateViewport();
  window.addEventListener('resize', updateViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewport);
  }
  window.addEventListener('orientationchange', function () {
    setTimeout(updateViewport, 150);
    setTimeout(updateViewport, 380);
  });

  // =========================================================================
  // 6. MAIN LOOP
  // =========================================================================
  var lastTime = performance.now();
  var physAcc = 0;
  var FIXED_DT = 1 / 120;

  // Keyboard support (active in PC mode or when testing on desktop)
  var keys = {};
  window.addEventListener('keydown', function (e) {
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (e.code === 'Escape' && (mode === 'RACING' || mode === 'COUNTDOWN')) {
      mode = 'PAUSED';
      G.Audio.setPaused(true);
      document.getElementById('pause-stage-info').textContent = G.getTrack(selectedTrackId).name;
      document.getElementById('pause-modal').classList.remove('hidden');
    } else if (mode === 'RACING' || mode === 'COUNTDOWN') {
      if (e.code === 'KeyE' && settings.transmission === 'manual' && phys) phys.shiftUp();
      else if (e.code === 'KeyQ' && settings.transmission === 'manual' && phys) phys.shiftDown();
      else if (e.code === 'KeyV' && cockpitState) cockpitState.wiperContinuous = !cockpitState.wiperContinuous;
      else if (e.code === 'KeyL' && cockpitState) {
        cockpitState.lightsOn = !cockpitState.lightsOn;
        cockpitState.headlight.intensity = cockpitState.lightsOn ? 1.8 : 0.0;
      } else if (e.code === 'KeyR' && phys && mode === 'RACING') phys.recoverToTrack();
    }
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (mode === 'MENU') {
      if (!dragActive) turntableYaw += dt * 0.35;
      garagePivot.rotation.y = turntableYaw;
      renderer.render(menuScene, menuCamera);
      return;
    }

    if (mode === 'PAUSED' || mode === 'FINISHED') {
      renderer.render(raceScene, raceCamera);
      return;
    }

    input.throttle = (touchState.gas || keys.KeyW || keys.ArrowUp) ? 1 : 0;
    input.brake = (touchState.brake || keys.KeyS || keys.ArrowDown) ? 1 : 0;
    input.handbrake = !!(touchState.hb || keys.Space);
    var keySteer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
    input.steer = settings.steerMode === 'tilt' && isPhoneControlsActive()
      ? gyroSteer
      : ((touchState.left ? 1 : 0) - (touchState.right ? 1 : 0) + keySteer);
    input.steer = Math.max(-1, Math.min(1, input.steer));

    if (mode === 'COUNTDOWN') {
      countdownTimer -= dt;
      var secCeil = Math.ceil(countdownTimer);
      var l1 = document.getElementById('cd-l1'), l2 = document.getElementById('cd-l2'), l3 = document.getElementById('cd-l3');
      var txt = document.getElementById('countdown-text');
      if (countdownTimer > 0) {
        txt.textContent = String(Math.max(1, secCeil));
        l1.className = 'cd-light' + (secCeil <= 3 ? ' red' : '');
        l2.className = 'cd-light' + (secCeil <= 2 ? ' red' : '');
        l3.className = 'cd-light' + (secCeil <= 1 ? ' red' : '');
        if (secCeil < lastCountdownBeep && secCeil >= 1) { lastCountdownBeep = secCeil; G.Audio.playCountdownBeep(false); }
      } else {
        mode = 'RACING';
        txt.textContent = 'GO!';
        l1.className = 'cd-light green'; l2.className = 'cd-light green'; l3.className = 'cd-light green';
        G.Audio.playCountdownBeep(true);
        setTimeout(function () { document.getElementById('countdown-banner').classList.add('hidden'); }, 700);
      }
    }

    physAcc += dt;
    while (physAcc >= FIXED_DT) {
      phys.step(input, FIXED_DT, mode === 'RACING');
      physAcc -= FIXED_DT;
    }

    if (mode === 'RACING') {
      stageTimer += dt;
      document.getElementById('hud-timer').textContent = formatTime(stageTimer);
      if (sector1Time === null && phys.trackDist >= activeTrack.totalLength * 0.33) {
        sector1Time = stageTimer; showSectorToast('S1', sector1Time, 0.33);
      }
      if (sector2Time === null && phys.trackDist >= activeTrack.totalLength * 0.66) {
        sector2Time = stageTimer; showSectorToast('S2', sector2Time, 0.66);
      }
      if (sectorToastTimer > 0) {
        sectorToastTimer -= dt;
        if (sectorToastTimer <= 0) document.getElementById('sector-toast').classList.add('hidden');
      }
      while (pacenoteCursor < activeTrack.pacenotes.length && phys.trackDist >= activeTrack.pacenotes[pacenoteCursor].triggerDist) {
        displayRadioPacenote(activeTrack.pacenotes[pacenoteCursor], true);
        pacenoteCursor++;
      }
      if (phys.trackDist >= activeTrack.finishDist) finishStage();
    }

    carPivot.position.copy(phys.pos);
    carPivot.rotation.set(0, 0, 0);
    carPivot.rotateY(phys.yaw);
    carPivot.rotateX(phys.pitch);
    carPivot.rotateZ(phys.roll);

    glanceFactor += ((glanceToggle ? 1 : 0) - glanceFactor) * Math.min(1, dt * 8);
    var headSwayX = Math.max(-0.04, Math.min(0.04, -phys.latG * 0.022));
    var headJoltY = Math.max(-0.03, Math.min(0.03, -phys.vertVel * 0.007));

    raceCamera.position.set(-0.24 + headSwayX + glanceFactor * 0.08, 1.15 + headJoltY, 0.17);
    raceCamera.rotation.order = 'YXZ';
    raceCamera.rotation.y = -0.09 - glanceFactor * 0.36;
    raceCamera.rotation.x = -0.075 - glanceFactor * 0.04;
    raceCamera.rotation.z = -phys.latG * 0.012;

    G.updateCockpitRig(cockpitState, phys, activePacenote, settings, dt, now / 1000);
    activeTrack.updateEffects(phys.pos, dt);
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

  initMenuScene();
  renderMobileMenu();
  bindSettings();
  requestAnimationFrame(tick);
})(window.GroupBRally);
