/**
 * Procedural Web Audio Engine for Group B WRC Rally
 * Synthesizes 4/5-cylinder engines, supercharger/turbo whine, wastegate flutter,
 * surface tyre noise, water splashes, and co-pilot radio comms.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  function RallyAudio() {
    this.ctx = null;
    this.masterGain = null;
    this.engineGain = null;
    this.sfxGain = null;

    this.running = false;
    this.muted = false;
    this.masterVol = 0.75;
    this.engineVol = 0.80;
    this.sfxVol = 0.85;
    this.voiceEnabled = true;

    this.osc1 = null;
    this.osc2 = null;
    this.subOsc = null;
    this.turboOsc = null;
    this.superOsc = null;
    this.engineFilter = null;
    this.turboGain = null;
    this.superGain = null;

    this.surfaceSource = null;
    this.surfaceFilter = null;
    this.surfaceGain = null;

    this.noiseBuffer = null;
    this.lastBoost = 0;
    this.flutterCooldown = 0;
    this.currentCarProfile = { cylinders: 4, baseFreq: 50, supercharger: 0, turboWhine: 0.8, flutter: 0.9 };
  }

  RallyAudio.prototype.init = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
      return;
    }

    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVol;
    this.masterGain.connect(this.ctx.destination);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.masterGain);

    // Build shared 2-second white/pink noise buffer
    var sr = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, sr * 2, sr);
    var data = this.noiseBuffer.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < data.length; i++) {
      var white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.35) * 0.45;
    }

    // Soft-clipping rally exhaust distortion
    var shaper = this.ctx.createWaveShaper();
    var curve = new Float32Array(256);
    for (var j = 0; j < 256; j++) {
      var x = (j * 2) / 256 - 1;
      curve[j] = ((3 + 12) * x * 20 * (Math.PI / 180)) / (Math.PI + 12 * Math.abs(x));
    }
    shaper.curve = curve;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 450;
    this.engineFilter.Q.value = 2.8;

    shaper.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.subOsc = this.ctx.createOscillator();
    this.subOsc.type = 'sine';

    var g1 = this.ctx.createGain(); g1.gain.value = 0.32;
    var g2 = this.ctx.createGain(); g2.gain.value = 0.25;
    var gSub = this.ctx.createGain(); gSub.gain.value = 0.35;

    this.osc1.connect(g1); g1.connect(shaper);
    this.osc2.connect(g2); g2.connect(shaper);
    this.subOsc.connect(gSub); gSub.connect(shaper);

    // Forced induction oscillators
    this.turboOsc = this.ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboGain = this.ctx.createGain();
    this.turboGain.gain.value = 0;
    this.turboOsc.connect(this.turboGain);
    this.turboGain.connect(this.engineGain);

    this.superOsc = this.ctx.createOscillator();
    this.superOsc.type = 'triangle';
    this.superGain = this.ctx.createGain();
    this.superGain.gain.value = 0;
    this.superOsc.connect(this.superGain);
    this.superGain.connect(this.engineGain);

    // Surface gravel/mud/snow noise loop
    this.surfaceSource = this.ctx.createBufferSource();
    this.surfaceSource.buffer = this.noiseBuffer;
    this.surfaceSource.loop = true;

    this.surfaceFilter = this.ctx.createBiquadFilter();
    this.surfaceFilter.type = 'bandpass';
    this.surfaceFilter.frequency.value = 800;
    this.surfaceFilter.Q.value = 1.0;

    this.surfaceGain = this.ctx.createGain();
    this.surfaceGain.gain.value = 0;

    this.surfaceSource.connect(this.surfaceFilter);
    this.surfaceFilter.connect(this.surfaceGain);
    this.surfaceGain.connect(this.sfxGain);

    this.osc1.start();
    this.osc2.start();
    this.subOsc.start();
    this.turboOsc.start();
    this.superOsc.start();
    this.surfaceSource.start();

    this.running = true;
  };

  RallyAudio.prototype.setCarProfile = function (car) {
    if (car && car.audio) {
      this.currentCarProfile = car.audio;
    }
  };

  RallyAudio.prototype.applyVolumes = function (settings) {
    if (settings) {
      this.masterVol = settings.masterVol !== undefined ? settings.masterVol : this.masterVol;
      this.engineVol = settings.engineVol !== undefined ? settings.engineVol : this.engineVol;
      this.sfxVol = settings.sfxVol !== undefined ? settings.sfxVol : this.sfxVol;
      this.voiceEnabled = settings.voiceEnabled !== undefined ? settings.voiceEnabled : this.voiceEnabled;
    }
    if (!this.ctx) return;
    var now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVol, now, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.04);
  };

  RallyAudio.prototype.setPaused = function (paused) {
    if (!this.ctx || !this.running) return;
    var now = this.ctx.currentTime;
    if (paused) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.surfaceGain.gain.setTargetAtTime(0, now, 0.06);
    }
  };

  RallyAudio.prototype.update = function (state, dt) {
    if (!this.ctx || !this.running || this.ctx.state !== 'running') return;

    var now = this.ctx.currentTime;
    var prof = this.currentCarProfile;
    var rpmRatio = Math.max(0.1, Math.min(1.15, state.rpm / state.redline));

    // Firing frequency depends on RPM and cylinder count (5-cyl has off-beat harmonics!)
    var baseHz = prof.baseFreq * (0.65 + rpmRatio * 3.85);
    var harmonicRatio = prof.cylinders === 5 ? 1.25 : 1.5;

    this.osc1.frequency.setTargetAtTime(baseHz, now, 0.025);
    this.osc2.frequency.setTargetAtTime(baseHz * harmonicRatio, now, 0.025);
    this.subOsc.frequency.setTargetAtTime(baseHz * 0.5, now, 0.025);

    var throttleLoad = 0.35 + state.throttle * 0.65;
    this.engineFilter.frequency.setTargetAtTime(220 + rpmRatio * 1400 + state.throttle * 700, now, 0.03);
    this.engineGain.gain.setTargetAtTime(0.24 * this.engineVol * throttleLoad, now, 0.04);

    // Turbo spool whine
    var boostNorm = Math.max(0, Math.min(1, state.boost / 2.2));
    this.turboOsc.frequency.setTargetAtTime(1600 + boostNorm * 3200, now, 0.05);
    this.turboGain.gain.setTargetAtTime(prof.turboWhine * boostNorm * 0.045 * this.engineVol, now, 0.05);

    // Supercharger whine (linear with RPM)
    this.superOsc.frequency.setTargetAtTime(750 + rpmRatio * 2900, now, 0.03);
    this.superGain.gain.setTargetAtTime(prof.supercharger * (0.015 + rpmRatio * 0.045) * this.engineVol, now, 0.04);

    // Wastegate turbo flutter chirp on throttle lift after boost!
    this.flutterCooldown = Math.max(0, this.flutterCooldown - dt);
    if (prof.flutter > 0.2 && this.lastBoost > 0.75 && state.throttle < 0.15 && this.flutterCooldown <= 0) {
      this.playTurboFlutter(prof.flutter);
      this.flutterCooldown = 0.55;
    }
    this.lastBoost = state.boost;

    // Surface gravel / mud / snow / ice scrub audio
    var speedNorm = Math.min(1, state.speedKmh / 140);
    var slipNorm = Math.min(1, state.slipIntensity || 0);
    var surfVol = (speedNorm * 0.12 + slipNorm * 0.26) * (state.airborne ? 0 : 1);

    var freq = 850;
    var q = 0.9;
    if (state.surfaceId === 'mud' || state.surfaceId === 'slush') {
      freq = 440 + slipNorm * 220;
      q = 1.6;
    } else if (state.surfaceId === 'puddle') {
      freq = 1200 + speedNorm * 650;
      q = 0.6;
      surfVol *= 1.5;
    } else if (state.surfaceId === 'wet_tarmac') {
      freq = 1480 + speedNorm * 600 + slipNorm * 400;
      q = 0.9;
      surfVol = (speedNorm * 0.16 + slipNorm * 0.24) * (state.airborne ? 0 : 1);
    } else if (state.surfaceId === 'tarmac') {
      freq = slipNorm > 0.22 ? (1900 + slipNorm * 950) : (620 + speedNorm * 240);
      q = slipNorm > 0.22 ? 4.2 : 0.7;
      surfVol = (speedNorm * 0.05 + slipNorm * 0.30) * (state.airborne ? 0 : 1);
    } else if (state.surfaceId === 'ice') {
      freq = 2100 + slipNorm * 900;
      q = 2.8;
    } else if (state.surfaceId === 'snow') {
      freq = 1350 + slipNorm * 500;
      q = 1.2;
    } else if (state.surfaceId === 'gravel' || state.surfaceId === 'dirt') {
      freq = 920 + slipNorm * 450;
      q = 0.85;
    }

    this.surfaceFilter.frequency.setTargetAtTime(freq, now, 0.04);
    this.surfaceFilter.Q.setTargetAtTime(q, now, 0.04);
    this.surfaceGain.gain.setTargetAtTime(surfVol, now, 0.05);
  };

  RallyAudio.prototype.playTurboFlutter = function (intensity) {
    if (!this.ctx || !this.running) return;
    var now = this.ctx.currentTime;
    // Classic Group B "stututu" amplitude-modulated high whistle burst
    for (var i = 0; i < 4; i++) {
      var t = now + i * 0.068;
      var osc = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3400 - i * 320, t);
      osc.frequency.exponentialRampToValueAtTime(2100 - i * 240, t + 0.055);
      var amp = (0.075 * intensity) * Math.pow(0.72, i) * this.engineVol;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.065);
    }
  };

  RallyAudio.prototype.playShiftPop = function () {
    if (!this.ctx || !this.running || !this.noiseBuffer) return;
    var now = this.ctx.currentTime;
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    var filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(420, now);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18 * this.engineVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.5, 0.1);
  };

  RallyAudio.prototype.playSplash = function () {
    if (!this.ctx || !this.running || !this.noiseBuffer) return;
    var now = this.ctx.currentTime;
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    var filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1400, now);
    filt.frequency.exponentialRampToValueAtTime(450, now + 0.35);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxGain);
    src.start(now, 0.1, 0.4);
  };

  RallyAudio.prototype.playImpact = function (strength) {
    if (!this.ctx || !this.running) return;
    var now = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
    g.gain.setValueAtTime(Math.min(0.45, strength * 0.35), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.24);
  };

  RallyAudio.prototype.playCountdownBeep = function (isGo) {
    if (!this.ctx || !this.running) return;
    var now = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = isGo ? 880 : 440;
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.38 : 0.16));
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.4 : 0.18));
  };

  RallyAudio.prototype.playRadioCall = function (urgency, spokenText) {
    if (!this.ctx || !this.running) return;
    var now = this.ctx.currentTime;

    // Radio PTT squelch click ("kssshh")
    if (this.noiseBuffer) {
      var src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      var filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 2400;
      filt.Q.value = 2.0;
      var ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.12, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      src.connect(filt);
      filt.connect(ng);
      ng.connect(this.sfxGain);
      src.start(now, Math.random() * 0.5, 0.09);
    }

    // Crisp intercom tone (higher pitch for acute hairpin / hazard!)
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = urgency === 'danger' ? 1180 : (urgency === 'warn' ? 920 : 720);
    g.gain.setValueAtTime(0.07, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now + 0.02);
    osc.stop(now + 0.14);

    // Optional Co-Pilot Spoken Pacenote via Web Speech API
    if (this.voiceEnabled && spokenText && typeof window.speechSynthesis !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
        var utter = new SpeechSynthesisUtterance(spokenText);
        utter.rate = 1.28;
        utter.pitch = 0.96;
        utter.volume = Math.min(1, this.masterVol * this.sfxVol);
        window.speechSynthesis.speak(utter);
      } catch (e) {
        // Ignore if speech synthesis blocked by environment
      }
    }
  };

  G.Audio = new RallyAudio();
})(window.GroupBRally);
