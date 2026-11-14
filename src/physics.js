/**
 * 120 Hz Rally Vehicle Physics Engine
 * Models Car Mass & Weight Distribution, Longitudinal/Lateral Weight Transfer,
 * Tyre Compound x Surface Friction, Slip Angle Curves, Turbo/Supercharger Boost,
 * Suspension Pitch/Roll/Airtime, and AWD/RWD Drivetrain Dynamics.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  var GRAVITY = 9.81;

  function RallyPhysics(carDef, tyreDef, trackInstance, settings) {
    this.car = carDef;
    this.tyre = tyreDef;
    this.track = trackInstance;
    this.settings = settings || {};

    this.reset();
  }

  RallyPhysics.prototype.reset = function () {
    var startSample = this.track.samples[3];
    var yaw = Math.atan2(-startSample.horizTan.x, -startSample.horizTan.z);

    this.pos = new THREE.Vector3(startSample.pos.x, startSample.pos.y + 0.05, startSample.pos.z);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = yaw;
    this.yawRate = 0;

    this.steerAngle = 0;
    this.steerWheelVis = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;

    this.gear = 1;
    this.rpm = this.car.idleRpm;
    this.boost = 0;
    this.shiftCooldown = 0;

    // Suspension & weight transfer state
    this.pitch = 0;
    this.roll = 0;
    this.vertVel = 0;
    this.airborne = false;
    this.loadFactor = 1.0;
    this.longG = 0;
    this.latG = 0;

    // Tyre thermal & wear state
    var ambient = this.track.def.biome === 'snow' ? 18 : (this.track.def.biome === 'jungle' ? 36 : 26);
    this.tyreTemp = ambient;
    this.tyreHealth = 1.0;

    // Track progress & telemetry
    this.sampleIdx = 3;
    this.trackDist = startSample.dist;
    this.maxTrackDist = startSample.dist;
    this.surfaceId = startSample.surfaceId;
    this.effectiveGrip = 0.9;
    this.speedMs = 0;
    this.speedKmh = 0;
    this.slipAngleDeg = 0;
    this.maxDriftDeg = 0;
    this.topSpeedKmh = 0;
    this.slipIntensity = 0;
    this.offRoad = 0;
    this.justSplashed = false;
    this.splashCooldown = 0;
    this.impactEvent = 0;
    this.offTrackPenaltyCount = 0;
    this.wasWayOffTrack = false;
  };

  RallyPhysics.prototype.shiftUp = function () {
    if (this.gear < this.car.gearRatios.length && this.shiftCooldown <= 0) {
      this.gear++;
      this.shiftCooldown = 0.16;
      G.Audio.playShiftPop();
    }
  };

  RallyPhysics.prototype.shiftDown = function () {
    if (this.gear > -1 && this.shiftCooldown <= 0) {
      this.gear--;
      if (this.gear === 0) this.gear = -1;
      this.shiftCooldown = 0.16;
      G.Audio.playShiftPop();
    }
  };

  RallyPhysics.prototype.recoverToTrack = function () {
    var s = this.track.samples[Math.max(2, this.sampleIdx)];
    this.pos.set(s.pos.x, s.pos.y + 0.15, s.pos.z);
    this.vel.set(0, 0, 0);
    this.yaw = Math.atan2(-s.horizTan.x, -s.horizTan.z);
    this.yawRate = 0;
    this.vertVel = 0;
    this.pitch = 0;
    this.roll = 0;
    this.gear = 1;
    this.rpm = this.car.idleRpm;
    this.boost = 0;
  };

  /**
   * Main fixed-timestep integration step (e.g. dt = 1/120 sec)
   */
  RallyPhysics.prototype.step = function (input, dt, raceActive) {
    var car = this.car;
    var tyre = this.tyre;
    var track = this.track;

    this.justSplashed = false;
    this.impactEvent = 0;
    this.splashCooldown = Math.max(0, this.splashCooldown - dt);
    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);

    // 1. Sample track geometry & surface beneath car
    var q = track.queryAt(this.pos.x, this.pos.z, this.sampleIdx);
    this.sampleIdx = q.sampleIdx;
    this.trackDist = q.dist;
    if (q.dist > this.maxTrackDist) this.maxTrackDist = q.dist;
    this.surfaceId = q.surfaceId;
    this.offRoad = q.offRoad;

    var surf = G.SURFACES[q.surfaceId] || G.SURFACES.gravel;

    // Track off-track excursions for post-stage stats
    if (q.offRoad > 0.75) {
      if (!this.wasWayOffTrack) {
        this.wasWayOffTrack = true;
        this.offTrackPenaltyCount++;
      }
    } else if (q.offRoad < 0.2) {
      this.wasWayOffTrack = false;
    }

    // Smooth input smoothing + steering sensitivity from settings
    var sens = this.settings.steerSens !== undefined ? this.settings.steerSens : 1.0;
    var targetThrottle = raceActive ? input.throttle : (input.throttle * 0.65); // Can rev engine at start line!
    var targetBrake = raceActive ? input.brake : 0;
    this.handbrake = raceActive ? !!input.handbrake : false;

    this.throttle += (targetThrottle - this.throttle) * Math.min(1, dt * 14);
    this.brake += (targetBrake - this.brake) * Math.min(1, dt * 16);

    // Local forward & right basis vectors
    var sinY = Math.sin(this.yaw);
    var cosY = Math.cos(this.yaw);
    var fwdX = -sinY, fwdZ = -cosY;
    var rgtX = cosY, rgtZ = -sinY;

    var vFwd = this.vel.x * fwdX + this.vel.z * fwdZ;
    var vRgt = this.vel.x * rgtX + this.vel.z * rgtZ;
    var speed = Math.hypot(vFwd, vRgt);
    this.speedMs = speed;
    this.speedKmh = speed * 3.6;
    if (this.speedKmh > this.topSpeedKmh) this.topSpeedKmh = this.speedKmh;

    // 2. Steering Physics (affected by car weight bias, tyre sidewall sharpness & speed)
    var assistMode = this.settings.assists || 'arcade';
    var isArcade = assistMode === 'arcade';
    var speedSteerLimit = isArcade
      ? 1.0 / (1.0 + (speed / 58.0) * (speed / 58.0))
      : 1.0 / (1.0 + (speed / 36.0) * (speed / 36.0));
    var maxSteer = car.maxSteerAngle * ((isArcade ? 0.58 : 0.36) + (isArcade ? 0.42 : 0.64) * speedSteerLimit);

    // Automatic countersteer assist (strongest in Arcade, off in Pure Sim)
    var counterAssist = 0;
    if (assistMode !== 'off' && speed > 5) {
      var slipDir = Math.atan2(vRgt, Math.max(2, Math.abs(vFwd)));
      var assistWeight = isArcade ? 0.80 : (assistMode === 'medium' ? 0.48 : 0.22);
      var assistCap = isArcade ? 0.38 : 0.22;
      counterAssist = Math.max(-assistCap, Math.min(assistCap, slipDir * assistWeight));
    }

    var desiredSteer = input.steer * maxSteer * sens + counterAssist;
    desiredSteer = Math.max(-car.maxSteerAngle, Math.min(car.maxSteerAngle, desiredSteer));
    var steerRate = car.steerSpeed * tyre.turnInSharpness * (1.05 - (car.massKg - 880) * 0.0005) * (isArcade ? 1.45 : 1.0);
    this.steerAngle += (desiredSteer - this.steerAngle) * Math.min(1, dt * steerRate);

    // Visual steering wheel reflects driver steer + subtle self-aligning road kickback
    var kickback = Math.sin(q.dist * 1.4) * Math.min(0.06, speed * 0.0015);
    this.steerWheelVis += (this.steerAngle * 1.35 + kickback - this.steerWheelVis) * Math.min(1, dt * 16);

    // 3. Vertical Suspension, Crests & Jumps
    var roadBump = Math.sin(q.dist * surf.bumpFreq) * surf.bumpAmp * Math.min(1.4, speed / 22);
    if (q.offRoad > 0.1) {
      roadBump += Math.sin(q.dist * 4.5) * 0.06 * Math.min(1.2, q.offRoad);
    }
    var targetY = q.groundY + roadBump;

    if (this.pos.y > targetY + 0.05) {
      this.airborne = true;
      this.vertVel -= GRAVITY * dt;
      this.pos.y += this.vertVel * dt;
      this.loadFactor = 0.0;
      if (this.pos.y <= targetY) {
        var impactVel = Math.abs(this.vertVel);
        this.pos.y = targetY;
        this.vertVel = 0;
        this.airborne = false;
        this.loadFactor = Math.min(1.9, 1.0 + impactVel * 0.14);
        if (impactVel > 2.2) {
          G.Audio.playImpact(Math.min(1.0, impactVel * 0.15));
          this.impactEvent = Math.min(1.0, impactVel * 0.15);
        }
      }
    } else {
      // Smoothly track road vertical profile; launch into air if crest drops away fast!
      var prevY = this.pos.y;
      var nextY = targetY;
      var requiredVertVel = (nextY - prevY) / dt;
      if (requiredVertVel < this.vertVel - 3.2 && speed > 18) {
        // Crest launch!
        this.airborne = true;
        this.pos.y = prevY + this.vertVel * dt;
        this.loadFactor = 0.05;
      } else {
        this.airborne = false;
        this.vertVel = this.vertVel * 0.75 + Math.max(-12, Math.min(12, requiredVertVel)) * 0.25;
        this.pos.y = nextY;
        // Weight load gets light over crests and heavy in compression dips
        var vertAccel = (this.vertVel - requiredVertVel) / Math.max(0.01, dt);
        this.loadFactor = Math.max(0.28, Math.min(1.75, 1.0 - (q.slope * speed * 0.012) - vertAccel * 0.002));
      }
    }

    // 4. Engine, Forced Induction (Turbo Lag vs Supercharger) & Gearbox
    var wheelRadius = 0.34;
    var currentRatio = this.gear === -1 ? -3.45 : car.gearRatios[Math.max(0, this.gear - 1)];
    var wheelRpm = (Math.abs(vFwd) / (2 * Math.PI * wheelRadius)) * 60;
    var coupledRpm = wheelRpm * Math.abs(currentRatio) * car.finalDrive;

    // Allow revving freely at start line or clutch slip during launch
    var targetRpm = raceActive
      ? Math.max(car.idleRpm + this.throttle * 1800, coupledRpm)
      : (car.idleRpm + this.throttle * (car.redlineRpm * 0.78));

    if (!raceActive || this.handbrake) {
      targetRpm = Math.max(targetRpm, car.idleRpm + this.throttle * (car.redlineRpm * 0.85));
    }
    targetRpm = Math.min(car.redlineRpm, targetRpm);
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * (this.throttle > 0.2 ? 11 : 6.5));

    // Automatic transmission shifting (unless manual selected)
    if (raceActive && this.settings.transmission !== 'manual' && this.shiftCooldown <= 0) {
      if (this.gear >= 1 && this.rpm > car.redlineRpm * 0.91 && this.gear < car.gearRatios.length && vFwd > 4) {
        this.gear++;
        this.shiftCooldown = 0.28;
        G.Audio.playShiftPop();
      } else if (this.gear > 1 && this.rpm < car.redlineRpm * 0.44 && this.brake > 0.1) {
        this.gear--;
        this.shiftCooldown = 0.25;
      } else if (this.gear === 1 && vFwd < 0.8 && this.brake > 0.45 && this.throttle < 0.1) {
        this.gear = -1;
        this.shiftCooldown = 0.35;
      } else if (this.gear === -1 && this.throttle > 0.25 && vFwd > -1.0) {
        this.gear = 1;
        this.shiftCooldown = 0.30;
      }
    }

    // Boost pressure simulation
    var rpmFrac = Math.max(0, (this.rpm - 2200) / (car.redlineRpm - 2200));
    var targetBoost = 0;
    if (car.induction === 'SUPERCHARGER') {
      targetBoost = this.throttle * car.maxBoostBar * Math.min(1, 0.35 + rpmFrac * 0.75);
    } else if (car.induction === 'TWINCHARGED') {
      targetBoost = this.throttle * car.maxBoostBar * Math.min(1, 0.42 + rpmFrac * 0.85);
    } else {
      // Classic Group B Turbo lag below ~3600 RPM, explosive spool above!
      var spoolFactor = Math.max(0.08, Math.pow(Math.min(1, rpmFrac * 1.15), 1.55));
      targetBoost = this.throttle * car.maxBoostBar * spoolFactor;
    }
    var spoolSpeed = targetBoost > this.boost ? car.turboSpool : 7.5;
    this.boost += (targetBoost - this.boost) * Math.min(1, dt * spoolSpeed);

    // Torque curve
    var torqueCurve = 0.62 + 0.38 * Math.sin(Math.min(1, this.rpm / car.redlineRpm) * Math.PI * 0.85);
    var boostBonus = 0.72 + 0.38 * (this.boost / Math.max(1, car.maxBoostBar));
    var engineTorque = this.throttle * car.peakTorqueNm * torqueCurve * boostBonus;
    if (this.rpm >= car.redlineRpm * 0.985) engineTorque *= 0.25; // Soft rev limiter

    // Reverse throttle vs brake when pressing S / Down
    var driveForce = 0;
    var brakeForce = 0;
    if (raceActive) {
      if (this.gear === -1 && this.brake > 0.1 && vFwd <= 1.2) {
        driveForce = -this.brake * car.peakTorqueNm * 3.4 * car.finalDrive / wheelRadius * 0.45;
      } else {
        driveForce = (engineTorque * Math.abs(currentRatio) * car.finalDrive * 0.78) / wheelRadius;
        if (this.gear === -1) driveForce = -Math.abs(driveForce) * 0.5;
        if (vFwd < -0.5 && this.throttle > 0.1) {
          brakeForce = this.throttle * car.massKg * 14.0;
        } else {
          brakeForce = this.brake * car.massKg * (isArcade ? 16.5 : 13.8);
        }
      }
    }

    // 5. Tyre Grip, Temperature, Wear & Weight Transfer Forces!
    var tyreGripMult = tyre.surfaceGrip[q.surfaceId] || 0.8;
    var offRoadFactor = q.offRoad > 0.05
      ? Math.max(isArcade ? 0.92 : (assistMode === 'medium' ? 0.78 : 0.62), 1.0 - q.offRoad * (isArcade ? 0.08 : 0.30))
      : 1.0;

    // Tyre temp warms under lateral slip & braking, settles toward ambient
    var ambientTemp = track.def.biome === 'snow' ? 18 : (track.def.biome === 'jungle' ? 36 : 26);
    var heatGen = (this.slipIntensity * 12.0 + (speed / 45) * 2.2) * dt;
    this.tyreTemp += heatGen - (this.tyreTemp - ambientTemp) * 0.03 * dt;
    this.tyreTemp = Math.max(ambientTemp, Math.min(125, this.tyreTemp));

    // Wear builds slightly faster when mismatched tyres run on wrong rough ground
    var mismatchPenalty = tyreGripMult < 0.75 ? 1.8 : 1.0;
    this.tyreHealth = Math.max(0.55, this.tyreHealth - tyre.wearRate * mismatchPenalty * (0.2 + this.slipIntensity) * dt);

    var tempDiff = Math.abs(this.tyreTemp - tyre.optimalTemp);
    var tempMod = Math.max(0.88, 1.03 - tempDiff * 0.0022);
    var wearMod = 0.72 + 0.28 * this.tyreHealth;

    var mu = surf.baseGrip * tyreGripMult * offRoadFactor * tempMod * wearMod;
    if (isArcade) {
      mu = Math.max(1.55, mu * 1.85);
    } else if (assistMode === 'medium') {
      mu = Math.max(1.10, mu * 1.35);
    } else if (assistMode === 'low') {
      mu *= 1.15;
    }
    this.effectiveGrip = mu;

    // Puddle hydroplane splash trigger
    if (q.surfaceId === 'puddle' && speed > 14 && this.splashCooldown <= 0 && !this.airborne) {
      this.justSplashed = true;
      this.splashCooldown = 1.8;
      G.Audio.playSplash();
    }

    // Static + Dynamic Longitudinal Weight Transfer onto Front & Rear Axles!
    var totalNormal = car.massKg * GRAVITY * this.loadFactor;
    var hCg = 0.52;
    var dWeightLong = car.massKg * (this.longG * GRAVITY) * (hCg / car.wheelbase);
    var fzFront = Math.max(totalNormal * 0.18, totalNormal * car.frontWeightBias - dWeightLong);
    var fzRear = Math.max(totalNormal * 0.18, totalNormal * (1 - car.frontWeightBias) + dWeightLong);

    // Slip Angles (alpha_f, alpha_r) in radians
    var lf = car.wheelbase * (1 - car.frontWeightBias);
    var lr = car.wheelbase * car.frontWeightBias;
    var absFwd = Math.max(1.2, Math.abs(vFwd));

    var fxTotal = 0;
    var fyTotal = 0;
    var tauYaw = 0;

    if (!this.airborne) {
      var vRightFront = vRgt - this.yawRate * lf;
      var vRightRear = vRgt + this.yawRate * lr;

      var slipFront = Math.atan2(vRightFront, absFwd) + (vFwd >= 0 ? this.steerAngle : -this.steerAngle);
      var slipRear = Math.atan2(vRightRear, absFwd);

      this.slipAngleDeg = Math.atan2(vRgt, Math.max(2.0, Math.abs(vFwd))) * (180 / Math.PI);
      if (speed > 8 && Math.abs(this.slipAngleDeg) > this.maxDriftDeg) {
        this.maxDriftDeg = Math.min(85, Math.abs(this.slipAngleDeg));
      }

      // Pacejka-inspired smooth lateral grip curve with peak at tyre.slipPeak
      function lateralCoeff(slip, peak) {
        var norm = slip / peak;
        // Rises smoothly to 1.0 at |slip| = peak, then gently eases to ~0.82 during deep drift
        return (1.65 * norm) / (1.0 + 0.65 * norm * norm);
      }

      // Load-sensitive grip curve (heavy loads slightly reduce peak mu efficiency)
      var frontGripMax = mu * fzFront * 1.18;
      var rearGripMax = mu * fzRear * 1.18;

      var latForceF = -Math.max(-1.05, Math.min(1.05, lateralCoeff(slipFront, tyre.slipPeak))) * frontGripMax;
      var latForceR = -Math.max(-1.05, Math.min(1.05, lateralCoeff(slipRear, tyre.slipPeak))) * rearGripMax;

      // Handbrake locks rear wheels -> wipes out rear lateral grip & adds braking!
      if (this.handbrake) {
        latForceR *= 0.22;
        brakeForce += car.massKg * 5.2;
      }

      // Combined traction circle: aggressive wheelspin or ABS-off lockup steals lateral grip!
      var frontDrive = driveForce * car.torqueSplit[0];
      var rearDrive = driveForce * car.torqueSplit[1];

      // Traction limit per axle
      var maxDriveF = frontGripMax * 1.05;
      var maxDriveR = rearGripMax * 1.05;
      if (Math.abs(frontDrive) > maxDriveF) {
        frontDrive = Math.sign(frontDrive) * maxDriveF;
        if (!isArcade) latForceF *= (assistMode === 'medium' ? 0.88 : 0.72);
      }
      if (Math.abs(rearDrive) > maxDriveR) {
        rearDrive = Math.sign(rearDrive) * maxDriveR;
        if (!isArcade) latForceR *= (assistMode === 'medium' ? 0.85 : 0.68); // Power oversteer on RWD / rear-biased AWD!
      }

      // Braking force split (62% front / 38% rear)
      var brkDir = vFwd >= 0 ? -1 : 1;
      var netLongF = frontDrive + brkDir * brakeForce * 0.62;
      var netLongR = rearDrive + brkDir * brakeForce * 0.38;

      // Prevent brake oscillation near zero speed
      if (Math.abs(vFwd) < 0.6 && this.throttle < 0.05 && (this.brake > 0.1 || this.handbrake)) {
        netLongF = 0; netLongR = 0;
        vFwd *= 0.6;
        vRgt *= 0.6;
      }

      // Rolling resistance + aerodynamic drag + off-road mud/snow drag
      var offDrag = q.offRoad > 0.05 ? q.offRoad * (isArcade ? 0.04 : 0.14) : 0;
      var rollDrag = (surf.rollingDrag + offDrag) * totalNormal * Math.sign(vFwd);
      var aeroDrag = 0.55 * vFwd * Math.abs(vFwd);

      // Gravity slope component along road tangent & lateral bank pull!
      var slopeGrav = -car.massKg * GRAVITY * q.slope * 0.85;
      var bankPull = car.massKg * GRAVITY * Math.sin(q.bankAngle) * 0.55;

      fxTotal = netLongF + netLongR - rollDrag - aeroDrag + slopeGrav;
      fyTotal = latForceF + latForceR + bankPull;

      // Yaw torque around vertical axis (scaled by car mass & rotational inertia Iz!)
      var Iz = 0.23 * car.massKg * car.wheelbase * car.wheelbase;
      tauYaw = (-latForceF * lf + latForceR * lr);

      // Low-speed yaw damping & optional stability assist
      var yawDamp = isArcade ? 0.22 : (assistMode === 'medium' ? 0.20 : (assistMode === 'low' ? 0.12 : 0.04));
      tauYaw -= this.yawRate * Iz * yawDamp * 8.0;

      // Apply accelerations in car frame, then transform to world
      var axLocal = fxTotal / car.massKg;
      var ayLocal = fyTotal / car.massKg;
      this.longG = this.longG * 0.8 + (axLocal / GRAVITY) * 0.2;
      this.latG = this.latG * 0.8 + (ayLocal / GRAVITY) * 0.2;

      var newVFwd = vFwd + axLocal * dt;
      var newVRgt = vRgt + ayLocal * dt;

      if (isArcade) {
        // Arcade planted grip: strongly damps unwanted sideways slide unless handbraking
        newVRgt *= Math.max(0, 1 - dt * (this.handbrake ? 2.2 : 10.5));
        // Subtle road-centering helper if drifting far off-road
        if (q.offRoad > 0.35 && speed > 4) {
          var signLat = q.lateral > 0 ? 1 : -1;
          this.vel.x -= q.right.x * signLat * 6.0 * dt;
          this.vel.z -= q.right.z * signLat * 6.0 * dt;
        }
      } else if (assistMode === 'medium') {
        newVRgt *= Math.max(0, 1 - dt * (this.handbrake ? 1.0 : 3.2));
      }

      // Gentle low-speed lateral settling so stopped car doesn't creep sideways
      if (speed < 1.2 && Math.abs(this.throttle) < 0.05) {
        newVRgt *= Math.max(0, 1 - dt * 10);
      }

      this.vel.x = newVFwd * fwdX + newVRgt * rgtX;
      this.vel.z = newVFwd * fwdZ + newVRgt * rgtZ;

      this.yawRate += (tauYaw / Iz) * dt;
      if (isArcade && speed > 2) {
        // Direct arcade cornering blend: car turns crisply with steering input
        var arcadeYawTarget = -input.steer * sens * Math.min(2.3, 0.9 + speed * 0.045) * (vFwd >= 0 ? 1 : -1);
        if (this.handbrake) arcadeYawTarget *= 1.35;
        this.yawRate += (arcadeYawTarget - this.yawRate) * Math.min(1, dt * 8.5);
      }
      var maxYaw = isArcade ? 2.6 : 3.2;
      this.yawRate = Math.max(-maxYaw, Math.min(maxYaw, this.yawRate));

      this.slipIntensity = Math.min(1.5, (Math.abs(slipFront) + Math.abs(slipRear)) * 1.4 + (this.handbrake && speed > 4 ? 0.6 : 0));
    } else {
      // Airborne aero drag only
      this.vel.x *= (1 - 0.08 * dt);
      this.vel.z *= (1 - 0.08 * dt);
      this.slipIntensity = 0;
    }

    // 6. Integrate Position & Yaw
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.yaw += this.yawRate * dt;

    // 7. Suspension Pitch & Roll angles for immersive 1st-person cockpit feel
    var targetPitch = Math.max(-0.08, Math.min(0.08, -this.longG * 0.032 + q.slope * 0.55));
    var targetRoll = Math.max(-0.10, Math.min(0.10, this.latG * 0.042 + q.bankAngle));
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * 10);
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 10);

    // 8. Roadside Tree/Boulder Collisions & Soft Outer Verge Containment
    var carRadius = 1.15;
    var obstacles = track.obstacles;
    for (var o = 0; o < obstacles.length; o++) {
      var ob = obstacles[o];
      var dx = this.pos.x - ob.x;
      var dz = this.pos.z - ob.z;
      var minD = carRadius + ob.radius;
      var d2 = dx * dx + dz * dz;
      if (d2 < minD * minD && d2 > 0.0001) {
        var d = Math.sqrt(d2);
        var nx = dx / d;
        var nz = dz / d;
        this.pos.x = ob.x + nx * minD;
        this.pos.z = ob.z + nz * minD;
        var vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) {
          this.vel.x -= 1.35 * vn * nx;
          this.vel.z -= 1.35 * vn * nz;
          this.vel.x *= 0.68;
          this.vel.z *= 0.68;
          var impactStr = Math.min(1.0, Math.abs(vn) / 14);
          if (impactStr > 0.15) {
            G.Audio.playImpact(impactStr);
            this.impactEvent = Math.max(this.impactEvent, impactStr);
          }
        }
      }
    }

    // Soft snowbank / earth bank guardrail beyond outer edge (1.85x halfWidth)
    var maxLat = q.halfWidth * 1.78;
    if (Math.abs(q.lateral) > maxLat) {
      var sign = q.lateral > 0 ? 1 : -1;
      var push = Math.abs(q.lateral) - maxLat;
      this.pos.x -= q.right.x * sign * push;
      this.pos.z -= q.right.z * sign * push;
      var vOut = (this.vel.x * q.right.x + this.vel.z * q.right.z) * sign;
      if (vOut > 0) {
        this.vel.x -= q.right.x * sign * vOut * 1.15;
        this.vel.z -= q.right.z * sign * vOut * 1.15;
        this.vel.x *= 0.85;
        this.vel.z *= 0.85;
      }
    }

    // Emit wheel roost/dust/mud/snow spray particles behind rear wheels
    if (!this.airborne && speed > 6 && (this.slipIntensity > 0.25 || q.surfaceId === 'puddle' || q.surfaceId === 'mud' || q.surfaceId === 'snow')) {
      if (Math.random() < 0.65) {
        var rearX = this.pos.x - fwdX * 1.3 + rgtX * ((Math.random() > 0.5 ? 1 : -1) * 0.72);
        var rearZ = this.pos.z - fwdZ * 1.3 + rgtZ * ((Math.random() > 0.5 ? 1 : -1) * 0.72);
        track.emitSpray(
          rearX, this.pos.y + 0.2, rearZ,
          -fwdX * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2,
          1.4 + Math.random() * 2.2,
          -fwdZ * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2,
          surf.particleColor
        );
      }
    }
  };

  G.RallyPhysics = RallyPhysics;
})(window.GroupBRally);
