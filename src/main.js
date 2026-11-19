/**
 * Desktop / Adaptive Main UI & Input Controller
 * Delegates 3D rendering, garage showcase, WebGL disposal, physics substepping,
 * sky/shadow tracking, and camera simulation to `src/core.js`.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  var STORAGE_SETTINGS = 'groupb_rally_settings_v1';
  var STORAGE_RECORDS = 'groupb_rally_records_v1';

  var defaultSettings = {
    controlMode: 'auto',
    assists: 'arcade',
    transmission: 'auto',
    steerSens: 1.0,
    fov: 68,
    units: 'kmh',
    quality: 'high',
    weather: 'auto',
    masterVol: 0.75,
    engineVol: 0.80,
    sfxVol: 0.85,
    voiceEnabled: true
  };

  function getBaseFov() {
    var aspect = window.innerWidth / Math.max(1, window.innerHeight);
    if (aspect < 1.0) {
      return Math.min(104, Math.round(settings.fov / Math.max(0.55, aspect * 1.15)));
    }
    return settings.fov;
  }

  var settings = G.loadJSON(STORAGE_SETTINGS, defaultSettings);
  var records = G.loadJSON(STORAGE_RECORDS, {});

  var selectedTrackId = 'forest';
  var selectedCarId = 'bergmeister_q85';
  var selectedTyreId = 'gravel_soft';

  // Core Three.js + Engine instances
  var canvas = document.getElementById('game-canvas');
  var gfx = G.createRallyRenderer(canvas, settings, window.innerWidth, window.innerHeight, true);
  var garage = new G.GarageShowcase({
    fov: 44,
    width: window.innerWidth,
    height: window.innerHeight,
    cameraPos: [4.1, 2.05, 5.1],
    lookAt: [0, 0.72, 0],
    castShadow: true,
    overheadLight: true,
    redAccent: true,
    includeTruss: true
  });
  var engine = new G.StageEngine(gfx.renderer, gfx.reshade, settings.fov);

  garage.rebuildCar(selectedCarId, selectedTyreId);

  var isDraggingGarage = false;
  var lastDragX = 0;
  var sectorToastTimer = 0;
  var countdownHideTimer = null;

  // Input state
  var keys = {};
  var touchState = { left: false, right: false, gas: false, brake: false, hb: false };
  var glanceToggle = false;
  var input = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  // =========================================================================
  // 1. MAIN MENU UI POPULATION & EVENTS
  // =========================================================================
  function renderMenuUI() {
    var trackListEl = document.getElementById('track-list');
    trackListEl.innerHTML = '';
    G.TRACKS.forEach(function (tr) {
      var card = document.createElement('div');
      card.className = 'track-card' + (tr.id === selectedTrackId ? ' selected' : '');
      var best = records[tr.id] ? G.formatTime(records[tr.id].time) : '--:--.--';
      card.innerHTML =
        '<div class="track-card-top">' +
          '<span class="track-title">' + tr.name + '</span>' +
          '<span class="biome-pill biome-' + tr.biome + '">' + tr.biomeLabel + '</span>' +
        '</div>' +
        '<div class="track-desc">' + tr.description + '</div>' +
        '<div class="track-meta">' +
          '<span>GOLD: ' + G.formatTime(tr.targetTimes.gold) + '</span>' +
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
        garage.rebuildCar(selectedCarId, selectedTyreId);
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
        garage.rebuildCar(selectedCarId, selectedTyreId);
        renderMenuUI();
      });
      carListEl.appendChild(chip);
    });

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

    var dominantSurf = track.biome === 'snow' ? 'snow'
      : (track.biome === 'jungle' ? 'mud'
      : (track.biome === 'tarmac' ? 'tarmac'
      : (track.biome === 'wet_tarmac' ? 'wet_tarmac' : 'gravel')));
    var matchScore = Math.round(Math.min(100, (tyre.surfaceGrip[dominantSurf] || 0.8) * 78));
    document.getElementById('stat-grip').style.width = matchScore + '%';
    document.getElementById('spec-grip-val').textContent = matchScore >= 82 ? 'OPTIMAL' : (matchScore >= 65 ? 'FAIR' : 'RISKY!');
  }

  function applyControlModeUI() {
    var phoneMode = G.isPhoneControlsActive(settings);
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
    var elWeather = document.getElementById('set-weather');
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
    elWeather.value = settings.weather || 'auto';
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
      var prevQuality = settings.quality;
      settings.controlMode = elControlMode.value;
      settings.assists = elAssists.value;
      settings.transmission = elTrans.value;
      settings.steerSens = parseFloat(elSteer.value);
      settings.fov = parseInt(elFov.value, 10);
      settings.units = elUnits.value;
      settings.quality = elQuality.value;
      settings.weather = elWeather.value;
      settings.masterVol = parseFloat(elMaster.value);
      settings.engineVol = parseFloat(elEngine.value);
      settings.sfxVol = parseFloat(elSfx.value);
      settings.voiceEnabled = elVoice.checked;

      G.setTextureQuality(settings.quality);
      gfx.renderer.shadowMap.enabled = settings.quality !== 'low';
      if (settings.quality !== prevQuality) {
        garage.rebuildCar(selectedCarId, selectedTyreId);
      }
      engine.raceCamera.fov = getBaseFov();
      engine.raceCamera.updateProjectionMatrix();
      G.Audio.applyVolumes(settings);
      applyControlModeUI();
      G.saveJSON(STORAGE_SETTINGS, settings);
      syncLabels();
    }

    [elControlMode, elAssists, elTrans, elSteer, elFov, elUnits, elQuality, elWeather, elMaster, elEngine, elSfx, elVoice].forEach(function (el) {
      el.addEventListener('change', onChange);
      el.addEventListener('input', onChange);
    });
    applyControlModeUI();
  }

  // =========================================================================
  // 2. VISUAL CO-PILOT RADIO HUD & STAGE UI CALLBACKS
  // =========================================================================
  function displayRadioPacenote(note, nextNote, playSound) {
    var panel = document.getElementById('radio-panel');
    panel.classList.remove('urgency-info', 'urgency-warn', 'urgency-danger');
    panel.classList.add('urgency-' + note.urgency);

    panel.classList.remove('pulse');
    void panel.offsetWidth;
    panel.classList.add('pulse');

    document.getElementById('radio-turn-icon').innerHTML = G.buildTurnSvg(note, 52);
    document.getElementById('radio-grade-badge').textContent = note.grade;
    document.getElementById('radio-call-title').textContent = note.title;
    document.getElementById('radio-extra-note').textContent = note.extra || 'ON LINE';

    var statusEl = document.getElementById('radio-road-status');
    statusEl.textContent = note.statusLabel;
    statusEl.className = 'road-status ' + note.statusClass;

    var nextText = nextNote ? (nextNote.title + ' • ' + nextNote.statusLabel) : 'STAGE FINISH AHEAD';
    document.getElementById('radio-next-text').textContent = nextText;

    if (engine.cockpitState) {
      engine.cockpitState.callGestureTimer = 1.4;
      engine.cockpitState.callGestureDir = note.dir === 'RIGHT' ? 1 : (note.dir === 'LEFT' ? -1 : 0);
    }

    if (playSound) {
      G.Audio.playRadioCall(note.urgency, note.spoken);
    }
  }

  function showSectorToast(label, splitTime, targetFraction) {
    var toast = document.getElementById('sector-toast');
    var refTime = records[selectedTrackId]
      ? records[selectedTrackId].time * targetFraction
      : G.getTrack(selectedTrackId).targetTimes.gold * targetFraction;
    var delta = splitTime - refTime;
    var sign = delta <= 0 ? '-' : '+';
    toast.textContent = label + ' ' + G.formatTime(splitTime) + ' (' + sign + Math.abs(delta).toFixed(2) + 's)';
    toast.className = 'sector-toast' + (delta > 0 ? ' slow' : '');
    toast.classList.remove('hidden');
    sectorToastTimer = 3.4;
  }

  function handleFinish(stageTimer) {
    var trackDef = G.getTrack(selectedTrackId);
    var prevBest = records[trackDef.id] ? records[trackDef.id].time : Infinity;
    var isNewPB = stageTimer < prevBest;
    if (isNewPB) {
      records[trackDef.id] = { time: stageTimer, car: selectedCarId, tyre: selectedTyreId };
      G.saveJSON(STORAGE_RECORDS, records);
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
    document.getElementById('finish-total-time').textContent = G.formatTime(stageTimer);
    document.getElementById('finish-pb-banner').classList.toggle('hidden', !isNewPB);

    document.getElementById('fin-s1').textContent = G.formatTime(engine.sector1Time);
    document.getElementById('fin-s2').textContent = G.formatTime(engine.sector2Time);
    var unitFactor = settings.units === 'mph' ? 0.621371 : 1.0;
    var unitLbl = settings.units === 'mph' ? ' MPH' : ' KM/H';
    document.getElementById('fin-top-spd').textContent = Math.round(engine.phys.topSpeedKmh * unitFactor) + unitLbl;
    document.getElementById('fin-drift').textContent = Math.round(engine.phys.maxDriftDeg) + '°';
    document.getElementById('fin-tyre').textContent = Math.round(engine.phys.tyreHealth * 100) + '%';
    document.getElementById('fin-off').textContent = String(engine.phys.offTrackPenaltyCount);
    document.getElementById('finish-modal').classList.remove('hidden');
  }

  var stageCallbacks = {
    onPacenote: displayRadioPacenote,
    onSector: showSectorToast,
    onFinish: handleFinish,
    onTimer: function (t, dt) {
      document.getElementById('hud-timer').textContent = G.formatTime(t);
      if (sectorToastTimer > 0) {
        sectorToastTimer -= dt;
        if (sectorToastTimer <= 0) document.getElementById('sector-toast').classList.add('hidden');
      }
    },
    onCountdown: function (secCeil, isGo) {
      var l1 = document.getElementById('cd-l1');
      var l2 = document.getElementById('cd-l2');
      var l3 = document.getElementById('cd-l3');
      var cdText = document.getElementById('countdown-text');
      if (!isGo) {
        cdText.textContent = String(Math.max(1, secCeil));
        l1.className = 'cd-light' + (secCeil <= 3 ? ' red' : '');
        l2.className = 'cd-light' + (secCeil <= 2 ? ' red' : '');
        l3.className = 'cd-light' + (secCeil <= 1 ? ' red' : '');
      } else {
        cdText.textContent = 'GO!';
        l1.className = 'cd-light green';
        l2.className = 'cd-light green';
        l3.className = 'cd-light green';
        if (countdownHideTimer) clearTimeout(countdownHideTimer);
        countdownHideTimer = setTimeout(function () {
          document.getElementById('countdown-banner').classList.add('hidden');
        }, 700);
      }
    }
  };

  function startStage() {
    if (countdownHideTimer) { clearTimeout(countdownHideTimer); countdownHideTimer = null; }
    var trackDef = G.getTrack(selectedTrackId);
    sectorToastTimer = 0;

    engine.startStage(selectedTrackId, selectedCarId, selectedTyreId, settings, getBaseFov(), stageCallbacks);

    document.getElementById('hud-stage-name').textContent = trackDef.name;
    document.getElementById('hud-timer').textContent = '00:00.00';
    document.getElementById('hud-gold-target').textContent = G.formatTime(trackDef.targetTimes.gold);
    document.getElementById('hud-best-time').textContent = records[trackDef.id] ? G.formatTime(records[trackDef.id].time) : '--:--.--';
    document.getElementById('sector-toast').classList.add('hidden');

    applyControlModeUI();
    glanceToggle = false;
    touchState.left = false;
    touchState.right = false;
    touchState.gas = false;
    touchState.brake = false;
    touchState.hb = false;
    document.querySelectorAll('.t-touch-btn.pressed').forEach(function (el) { el.classList.remove('pressed'); });
    document.getElementById('t-btn-glance').classList.remove('active');
    document.getElementById('t-btn-lights').classList.toggle('active', engine.cockpitState.lightsOn);
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('finish-modal').classList.add('hidden');
    document.getElementById('race-overlay').classList.remove('hidden');
    document.getElementById('countdown-banner').classList.remove('hidden');
  }

  function returnToMenu() {
    engine.returnToMenu();
    document.getElementById('race-overlay').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('finish-modal').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    renderMenuUI();
  }

  function togglePause() {
    var paused = engine.togglePause();
    if (paused === true) {
      document.getElementById('pause-stage-info').textContent = G.getTrack(selectedTrackId).name;
      document.getElementById('pause-modal').classList.remove('hidden');
    } else if (paused === false) {
      document.getElementById('pause-modal').classList.add('hidden');
    }
  }

  // =========================================================================
  // 3. KEYBOARD, TOUCH & UI EVENT LISTENERS
  // =========================================================================
  window.addEventListener('keydown', function (e) {
    if (keys[e.code]) return;
    keys[e.code] = true;

    if (e.code === 'Escape') {
      if (engine.mode === 'RACING' || engine.mode === 'COUNTDOWN' || engine.mode === 'PAUSED') {
        togglePause();
      }
      return;
    }

    if (engine.mode !== 'RACING' && engine.mode !== 'COUNTDOWN') return;

    if (e.code === 'KeyE' && settings.transmission === 'manual' && engine.phys) {
      engine.phys.shiftUp();
    } else if (e.code === 'KeyQ' && settings.transmission === 'manual' && engine.phys) {
      engine.phys.shiftDown();
    } else if (e.code === 'KeyV') {
      engine.toggleWipers();
    } else if (e.code === 'KeyL') {
      engine.toggleLights();
    } else if (e.code === 'KeyR' && engine.phys && engine.mode === 'RACING') {
      engine.phys.recoverToTrack();
    }
  });

  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  G.bindTouchPad(document.getElementById('t-pad-left'), touchState, 'left');
  G.bindTouchPad(document.getElementById('t-pad-right'), touchState, 'right');
  G.bindTouchPad(document.getElementById('t-pad-gas'), touchState, 'gas');
  G.bindTouchPad(document.getElementById('t-pad-brake'), touchState, 'brake');
  G.bindTouchPad(document.getElementById('t-pad-hb'), touchState, 'hb');

  document.getElementById('t-pad-shift-up').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (engine.phys && settings.transmission === 'manual') engine.phys.shiftUp();
  });
  document.getElementById('t-pad-shift-down').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (engine.phys && settings.transmission === 'manual') engine.phys.shiftDown();
  });
  document.getElementById('t-btn-glance').addEventListener('click', function () {
    glanceToggle = !glanceToggle;
    this.classList.toggle('active', glanceToggle);
  });
  document.getElementById('t-btn-wipers').addEventListener('click', function () {
    this.classList.toggle('active', engine.toggleWipers());
  });
  document.getElementById('t-btn-lights').addEventListener('click', function () {
    this.classList.toggle('active', engine.toggleLights());
  });
  document.getElementById('t-btn-recover').addEventListener('click', function () {
    if (engine.phys && engine.mode === 'RACING') engine.phys.recoverToTrack();
  });
  document.getElementById('t-btn-pause').addEventListener('click', togglePause);

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
  });

  var spacer = document.querySelector('.showcase-spacer');
  spacer.addEventListener('mousedown', function (e) { isDraggingGarage = true; lastDragX = e.clientX; });
  window.addEventListener('mousemove', function (e) {
    if (isDraggingGarage && engine.mode === 'MENU') {
      garage.turntableYaw += (e.clientX - lastDragX) * 0.01;
      lastDragX = e.clientX;
    }
  });
  window.addEventListener('mouseup', function () { isDraggingGarage = false; });

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
    var w = window.innerWidth, h = window.innerHeight;
    gfx.renderer.setSize(w, h);
    garage.resize(w, h);
    engine.resize(w, h, getBaseFov());
  });

  // =========================================================================
  // 4. ANIMATION LOOP
  // =========================================================================
  var lastTime = performance.now();

  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (engine.mode === 'MENU') {
      garage.update(dt, isDraggingGarage);
      engine.renderScene(garage.scene, garage.camera, settings.quality);
      return;
    }

    input.throttle = (keys.KeyW || keys.ArrowUp || touchState.gas) ? 1 : 0;
    input.brake = (keys.KeyS || keys.ArrowDown || touchState.brake) ? 1 : 0;
    input.steer = ((keys.KeyA || keys.ArrowLeft || touchState.left) ? 1 : 0) -
                  ((keys.KeyD || keys.ArrowRight || touchState.right) ? 1 : 0);
    input.handbrake = !!(keys.Space || touchState.hb);

    var targetGlance = (keys.KeyC || glanceToggle) ? 1.0 : 0.0;
    engine.stepFrame(dt, now, input, targetGlance, getBaseFov(), settings, stageCallbacks);
  }

  renderMenuUI();
  bindSettingsControls();
  requestAnimationFrame(tick);
})(window.GroupBRally);
