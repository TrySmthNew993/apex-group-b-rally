/**
 * Mobile / iPhone UI & Touch/Gyro Controller for APEX GROUP B Rally
 * Delegates 3D rendering, garage showcase, WebGL disposal, physics substepping,
 * sky/shadow tracking, and camera simulation to `src/core.js`.
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

  var settings = G.loadJSON(STORAGE_SETTINGS, defaultSettings);
  var records = G.loadJSON(STORAGE_RECORDS, {});

  var selectedTrackId = 'forest';
  var selectedCarId = 'bergmeister_q85';
  var selectedTyreId = 'gravel_soft';

  function getViewportSize() {
    if (window.visualViewport) {
      return { w: Math.round(window.visualViewport.width), h: Math.round(window.visualViewport.height) };
    }
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function getAdaptiveFov(w, h) {
    var vw = w || getViewportSize().w;
    var vh = h || getViewportSize().h;
    if (vh > vw) {
      var aspect = Math.max(0.35, vw / Math.max(1, vh));
      var vFov = 2 * Math.atan(Math.tan(38 * Math.PI / 180) / aspect) * (180 / Math.PI);
      return Math.min(104, Math.max(76, vFov));
    }
    return 72;
  }

  // Core Three.js + Engine instances
  var initVp = getViewportSize();
  var canvas = document.getElementById('game-canvas');
  var gfx = G.createRallyRenderer(canvas, settings, initVp.w, initVp.h, false);
  var garage = new G.GarageShowcase({
    fov: 48,
    width: initVp.w,
    height: initVp.h,
    cameraPos: [3.8, 2.0, 5.4],
    lookAt: [0, 0.5, 0],
    floorSize: 40
  });
  var engine = new G.StageEngine(gfx.renderer, gfx.reshade, 74);

  garage.rebuildCar(selectedCarId, selectedTyreId);

  var dragActive = false;
  var lastTouchX = 0;
  var sectorToastTimer = 0;
  var countdownHideTimer = null;
  var glanceToggle = false;

  // Touch, Keyboard & Gyro input state
  var keys = {};
  var touchState = { left: false, right: false, gas: false, brake: false, hb: false };
  var gyroSteer = 0;
  var input = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  // =========================================================================
  // 1. MOBILE MENU UI
  // =========================================================================
  function renderMobileMenu() {
    var trackList = document.getElementById('m-track-list');
    trackList.innerHTML = '';
    G.TRACKS.forEach(function (tr) {
      var card = document.createElement('div');
      card.className = 'm-card' + (tr.id === selectedTrackId ? ' selected' : '');
      var best = records[tr.id] ? G.formatTime(records[tr.id].time) : '--:--.--';
      card.innerHTML =
        '<div class="m-card-row">' +
          '<span class="m-card-title">' + tr.name + '</span>' +
          '<span class="biome-pill biome-' + tr.biome + '">' + tr.biomeLabel + '</span>' +
        '</div>' +
        '<div class="m-card-sub">' + tr.description + '</div>' +
        '<div class="m-card-meta"><span>GOLD: ' + G.formatTime(tr.targetTimes.gold) + '</span><span>BEST: ' + best + '</span></div>';
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
        garage.rebuildCar(selectedCarId, selectedTyreId);
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
        garage.rebuildCar(selectedCarId, selectedTyreId);
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
      '<strong>BEST:</strong> ' + (records[track.id] ? G.formatTime(records[track.id].time) : '--:--.--') + ' • ' + tyre.name;
  }

  function applyMobileControlVisibility() {
    var phoneMode = G.isPhoneControlsActive(settings);
    var ctrlLayer = document.querySelector('.m-controls-layer');
    if (ctrlLayer) ctrlLayer.classList.toggle('hidden', !phoneMode);
    var steerGroup = document.getElementById('steer-pad-group');
    if (steerGroup) steerGroup.style.display = (phoneMode && settings.steerMode === 'buttons') ? 'flex' : 'none';
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
      var prevQuality = settings.quality;
      settings.controlMode = elControlMode.value;
      settings.steerMode = elSteerMode.value;
      settings.assists = elAssists.value;
      settings.transmission = elTrans.value;
      settings.steerSens = parseFloat(elSens.value);
      settings.quality = elQuality.value;
      settings.units = elUnits.value;
      settings.voiceEnabled = elVoice.checked;
      document.getElementById('m-val-sens').textContent = Number(settings.steerSens).toFixed(2);
      G.setTextureQuality(settings.quality);
      gfx.renderer.shadowMap.enabled = settings.quality !== 'low';
      if (settings.quality !== prevQuality) {
        garage.rebuildCar(selectedCarId, selectedTyreId);
      }
      G.Audio.applyVolumes(settings);
      applyMobileControlVisibility();
      G.saveJSON(STORAGE_SETTINGS, settings);
    }

    [elControlMode, elSteerMode, elAssists, elTrans, elSens, elQuality, elUnits, elVoice].forEach(function (el) {
      el.addEventListener('change', update);
      el.addEventListener('input', update);
    });
    applyMobileControlVisibility();
  }

  // =========================================================================
  // 2. VISUAL RADIO HUD & STAGE CALLBACKS
  // =========================================================================
  function displayRadioPacenote(note, _nextNote, playSound) {
    var panel = document.getElementById('radio-panel');
    panel.className = 'm-radio urgency-' + note.urgency;
    document.getElementById('radio-turn-icon').innerHTML = G.buildTurnSvg(note, 36);
    document.getElementById('radio-grade-badge').textContent = note.grade;
    document.getElementById('radio-call-title').textContent = note.title;
    document.getElementById('radio-extra-note').textContent = note.extra || 'ON LINE';

    var st = document.getElementById('radio-road-status');
    st.textContent = note.statusLabel;
    st.className = 'road-status ' + note.statusClass;

    if (engine.cockpitState) {
      engine.cockpitState.callGestureTimer = 1.4;
      engine.cockpitState.callGestureDir = note.dir === 'RIGHT' ? 1 : (note.dir === 'LEFT' ? -1 : 0);
    }
    if (playSound) G.Audio.playRadioCall(note.urgency, note.spoken);
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

  function handleFinish(stageTimer) {
    var tr = G.getTrack(selectedTrackId);
    var prev = records[tr.id] ? records[tr.id].time : Infinity;
    var isPB = stageTimer < prev;
    if (isPB) {
      records[tr.id] = { time: stageTimer, car: selectedCarId, tyre: selectedTyreId };
      G.saveJSON(STORAGE_RECORDS, records);
    }
    var medal = document.getElementById('finish-medal-badge');
    if (stageTimer <= tr.targetTimes.gold) { medal.textContent = '★ GOLD WRC STAGE TIME ★'; medal.className = 'finish-medal gold'; }
    else if (stageTimer <= tr.targetTimes.silver) { medal.textContent = 'SILVER STAGE TIME'; medal.className = 'finish-medal silver'; }
    else { medal.textContent = 'BRONZE STAGE FINISH'; medal.className = 'finish-medal bronze'; }

    document.getElementById('finish-stage-title').textContent = tr.name;
    document.getElementById('finish-total-time').textContent = G.formatTime(stageTimer);
    document.getElementById('finish-pb-banner').classList.toggle('hidden', !isPB);
    document.getElementById('fin-s1').textContent = G.formatTime(engine.sector1Time);
    document.getElementById('fin-s2').textContent = G.formatTime(engine.sector2Time);
    var uf = settings.units === 'mph' ? 0.621371 : 1;
    document.getElementById('fin-top-spd').textContent = Math.round(engine.phys.topSpeedKmh * uf) + (settings.units === 'mph' ? ' MPH' : ' KM/H');
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
      var l1 = document.getElementById('cd-l1'), l2 = document.getElementById('cd-l2'), l3 = document.getElementById('cd-l3');
      var txt = document.getElementById('countdown-text');
      if (!isGo) {
        txt.textContent = String(Math.max(1, secCeil));
        l1.className = 'cd-light' + (secCeil <= 3 ? ' red' : '');
        l2.className = 'cd-light' + (secCeil <= 2 ? ' red' : '');
        l3.className = 'cd-light' + (secCeil <= 1 ? ' red' : '');
      } else {
        txt.textContent = 'GO!';
        l1.className = 'cd-light green'; l2.className = 'cd-light green'; l3.className = 'cd-light green';
        if (countdownHideTimer) clearTimeout(countdownHideTimer);
        countdownHideTimer = setTimeout(function () {
          document.getElementById('countdown-banner').classList.add('hidden');
        }, 700);
      }
    }
  };

  // =========================================================================
  // 3. GYROSCOPE & MULTI-TOUCH BINDINGS
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
    var norm = Math.max(-1, Math.min(1, -raw / 32));
    if (Math.abs(norm) < 0.06) norm = 0;
    gyroSteer = norm;
  }

  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu'].forEach(function (evt) {
    document.addEventListener(evt, function (e) { e.preventDefault(); }, { passive: false });
  });
  var lastTapTime = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTapTime < 300 && !e.target.closest('.m-tab-body')) {
      e.preventDefault();
    }
    lastTapTime = now;
  }, { passive: false });

  G.bindTouchPad(document.getElementById('pad-left'), touchState, 'left');
  G.bindTouchPad(document.getElementById('pad-right'), touchState, 'right');
  G.bindTouchPad(document.getElementById('pad-gas'), touchState, 'gas');
  G.bindTouchPad(document.getElementById('pad-brake'), touchState, 'brake');
  G.bindTouchPad(document.getElementById('pad-hb'), touchState, 'hb');

  document.getElementById('pad-shift-up').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (engine.phys && settings.transmission === 'manual') engine.phys.shiftUp();
  });
  document.getElementById('pad-shift-down').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (engine.phys && settings.transmission === 'manual') engine.phys.shiftDown();
  });

  window.addEventListener('keydown', function (e) { keys[e.code] = true; });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  // =========================================================================
  // 4. STAGE LAUNCH, MENU & VIEWPORT EVENTS
  // =========================================================================
  function startStage() {
    if (countdownHideTimer) { clearTimeout(countdownHideTimer); countdownHideTimer = null; }
    setupGyroIfNeeded();
    var trackDef = G.getTrack(selectedTrackId);
    sectorToastTimer = 0;
    glanceToggle = false;
    touchState = { left: false, right: false, gas: false, brake: false, hb: false };

    engine.startStage(selectedTrackId, selectedCarId, selectedTyreId, settings, getAdaptiveFov(), stageCallbacks);

    document.getElementById('hud-timer').textContent = '00:00.00';
    document.getElementById('hud-gold-target').textContent = G.formatTime(trackDef.targetTimes.gold);
    document.getElementById('sector-toast').classList.add('hidden');
    applyMobileControlVisibility();
    document.getElementById('pad-shift-up').classList.toggle('hidden', settings.transmission !== 'manual');
    document.getElementById('pad-shift-down').classList.toggle('hidden', settings.transmission !== 'manual');
    document.getElementById('btn-lights').classList.toggle('active', engine.cockpitState.lightsOn);

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
    renderMobileMenu();
  }

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
    if (dragActive && engine.mode === 'MENU') {
      garage.turntableYaw += (e.clientX - lastTouchX) * 0.012;
      lastTouchX = e.clientX;
    }
  });
  window.addEventListener('pointerup', function () { dragActive = false; });

  document.getElementById('m-btn-start').addEventListener('click', startStage);
  document.getElementById('btn-pause').addEventListener('click', function () {
    if (engine.togglePause() === true) {
      document.getElementById('pause-stage-info').textContent = G.getTrack(selectedTrackId).name;
      document.getElementById('pause-modal').classList.remove('hidden');
    }
  });
  document.getElementById('btn-resume').addEventListener('click', function () {
    if (engine.togglePause() === false) {
      document.getElementById('pause-modal').classList.add('hidden');
    }
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
    this.classList.toggle('active', engine.toggleWipers());
  });
  document.getElementById('btn-lights').addEventListener('click', function () {
    this.classList.toggle('active', engine.toggleLights());
  });
  document.getElementById('btn-recover').addEventListener('click', function () {
    if (engine.phys && engine.mode === 'RACING') engine.phys.recoverToTrack();
  });

  function updateViewport() {
    var vp = getViewportSize();
    var w = vp.w, h = vp.h;
    gfx.renderer.setSize(w, h, false);
    var isLandscape = w > h && h <= 580;
    garage.camera.fov = isLandscape ? 42 : 48;
    garage.resize(w, h);
    if (isLandscape) {
      garage.camera.position.set(4.5, 2.0, 5.8);
      garage.camera.lookAt(1.5, 0.72, 0);
    } else {
      garage.camera.position.set(3.8, 2.0, 5.4);
      garage.camera.lookAt(0, 0.5, 0);
    }
    engine.resize(w, h, getAdaptiveFov(w, h));
  }

  updateViewport();
  window.addEventListener('resize', updateViewport);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateViewport);
  window.addEventListener('orientationchange', function () {
    setTimeout(updateViewport, 150);
    setTimeout(updateViewport, 380);
  });

  // =========================================================================
  // 5. ANIMATION LOOP
  // =========================================================================
  var lastTime = performance.now();

  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (engine.mode === 'MENU') {
      garage.update(dt, dragActive);
      engine.renderScene(garage.scene, garage.camera, settings.quality);
      return;
    }

    input.throttle = (touchState.gas || keys.KeyW || keys.ArrowUp) ? 1 : 0;
    input.brake = (touchState.brake || keys.KeyS || keys.ArrowDown) ? 1 : 0;
    input.handbrake = !!(touchState.hb || keys.Space);
    var keySteer = ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) - ((keys.KeyD || keys.ArrowRight) ? 1 : 0);
    input.steer = settings.steerMode === 'tilt' && G.isPhoneControlsActive(settings)
      ? gyroSteer
      : ((touchState.left ? 1 : 0) - (touchState.right ? 1 : 0) + keySteer);
    input.steer = Math.max(-1, Math.min(1, input.steer));

    engine.stepFrame(dt, now, input, glanceToggle ? 1.0 : 0.0, getAdaptiveFov(), settings, stageCallbacks);
  }

  renderMobileMenu();
  bindSettings();
  requestAnimationFrame(tick);
})(window.GroupBRally);
