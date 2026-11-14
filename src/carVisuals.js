/**
 * 3D Group B Rally Car Models:
 * 1. Exterior Turntable Model (Main Menu 3D Garage Showcase)
 * 2. Detailed 1st-Person Interior Cockpit with Working Gauges, Steering Wheel,
 *    Animated Co-Pilot w/ Pacenotes Binder, Wipers, and Physical 3D Dashboard Track Map Screen.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  /**
   * Builds the 3D exterior Group B car for the Main Menu garage showcase.
   */
  G.createExteriorCar = function (carDef, tyreDef) {
    var root = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(carDef.bodyColor),
      roughness: 0.28,
      metalness: 0.2
    });
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65, metalness: 0.2 });
    var accent1Mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.accentPrimary), roughness: 0.35 });
    var accent2Mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.accentSecondary), roughness: 0.35 });
    var glassMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.85, transparent: true, opacity: 0.78 });

    // Lower chassis tub
    var lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.52, 4.05), bodyMat);
    lowerBody.position.set(0, 0.54, 0);
    lowerBody.castShadow = true;
    root.add(lowerBody);

    // Widebody Group B box flares (4 corners)
    var flareGeom = new THREE.BoxGeometry(0.18, 0.42, 0.92);
    [[-0.92, -1.25], [0.92, -1.25], [-0.94, 1.25], [0.94, 1.25]].forEach(function (pos) {
      var flare = new THREE.Mesh(flareGeom, bodyMat);
      flare.position.set(pos[0], 0.52, pos[1]);
      flare.castShadow = true;
      root.add(flare);
    });

    // Front aero chin splitter + mudflaps
    var splitter = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.10, 0.32), trimMat);
    splitter.position.set(0, 0.27, -2.06);
    root.add(splitter);

    var mudflapGeom = new THREE.BoxGeometry(0.28, 0.26, 0.04);
    var flapMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.accentPrimary), roughness: 0.7 });
    [-0.78, 0.78].forEach(function (x) {
      var flap = new THREE.Mesh(mudflapGeom, flapMat);
      flap.position.set(x, 0.24, 1.85);
      root.add(flap);
    });

    // Hood / Bonnet with livery texture
    var hoodTex = G.createHoodLiveryTexture(carDef);
    var hoodMat = new THREE.MeshStandardMaterial({ map: hoodTex, roughness: 0.3 });
    var hood = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 1.35), hoodMat);
    hood.position.set(0, 0.81, -1.22);
    hood.rotation.x = 0.05;
    root.add(hood);

    // Cabin greenhouse
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.54, 1.75), bodyMat);
    cabin.position.set(0, 1.05, 0.22);
    cabin.castShadow = true;
    root.add(cabin);

    // Windshield & rear/side glass
    var windshield = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.44, 0.06), glassMat);
    windshield.position.set(0, 1.04, -0.65);
    windshield.rotation.x = -0.52;
    root.add(windshield);

    var sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.51, 0.38, 1.25), glassMat);
    sideGlass.position.set(0, 1.06, 0.22);
    root.add(sideGlass);

    // Roof air scoop (iconic for T16 / S4)
    if (carDef.hoodStyle === 's4' || carDef.hoodStyle === 't16') {
      var scoop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.58), accent1Mat);
      scoop.position.set(0, 1.36, 0.12);
      root.add(scoop);
    }

    // Livery side stripes
    var sideStripe1 = new THREE.Mesh(new THREE.BoxGeometry(1.81, 0.11, 3.65), accent1Mat);
    sideStripe1.position.set(0, 0.58, 0);
    root.add(sideStripe1);
    var sideStripe2 = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.06, 3.65), accent2Mat);
    sideStripe2.position.set(0, 0.48, 0);
    root.add(sideStripe2);

    // Massive Group B Rear Wing
    var wingPlane = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.07, 0.46), accent1Mat);
    wingPlane.position.set(0, 1.32, 1.88);
    wingPlane.rotation.x = 0.12;
    wingPlane.castShadow = true;
    root.add(wingPlane);

    var endplateGeom = new THREE.BoxGeometry(0.06, 0.48, 0.52);
    [-0.86, 0.86].forEach(function (x) {
      var ep = new THREE.Mesh(endplateGeom, bodyMat);
      ep.position.set(x, 1.12, 1.88);
      root.add(ep);
    });

    // Quad Rally Light Pod on the nose!
    var podBar = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, 0.18), trimMat);
    podBar.position.set(0, 0.72, -2.02);
    root.add(podBar);
    var lampMat = new THREE.MeshBasicMaterial({ color: 0xfff8d6 });
    [-0.38, -0.13, 0.13, 0.38].forEach(function (lx) {
      var lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), lampMat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(lx, 0.74, -2.10);
      root.add(lamp);
    });

    // Taillights & dual rally exhausts
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    [-0.62, 0.62].forEach(function (tx) {
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), tailMat);
      tl.position.set(tx, 0.62, 2.02);
      root.add(tl);
    });
    var exMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.85, roughness: 0.3 });
    var ex = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.25, 10), exMat);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(0.48, 0.30, 2.04);
    root.add(ex);

    // 4 Rally Wheels reflecting selected tyre compound
    var tyreMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.88 });
    var rimColor = carDef.id === 'veltro_037' ? 0xeab308 : 0xf1f5f9;
    var rimMat = new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.35, metalness: 0.45 });
    var sidewallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(tyreDef ? tyreDef.sidewallColor : '#e5a93c'),
      roughness: 0.6
    });

    var wheels = [];
    [[-0.86, 0.35, -1.25], [0.86, 0.35, -1.25], [-0.88, 0.35, 1.25], [0.88, 0.35, 1.25]].forEach(function (p) {
      var wg = new THREE.Group();
      var tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.26, 20), tyreMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 14), rimMat);
      rim.rotation.z = Math.PI / 2;
      var stripeRing = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.265, 16), sidewallMat);
      stripeRing.rotation.z = Math.PI / 2;
      wg.add(tire, stripeRing, rim);
      wg.position.set(p[0], p[1], p[2]);
      root.add(wg);
      wheels.push(wg);
    });

    root.userData.wheels = wheels;
    return root;
  };

  /**
   * Builds the full 1st-Person Cockpit POV Rig:
   * - Sculpted car hood ahead with livery & fog pod bumps
   * - Flocked rally dash, roll cage, windshield sun-strip, animated wipers, side mirrors
   * - Rotating steering wheel + gloved driver hands
   * - Live Analog Gauge Cluster (CanvasTexture)
   * - Physical 3D Center-Console Track Map Screen (CanvasTexture — NOT HUD!)
   * - Animated 3D Co-Pilot in right bucket seat holding Pacenotes Binder
   */
  G.createCockpitRig = function (carDef, tyreDef, trackInstance) {
    var rig = new THREE.Group();

    var dashMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.dashColor), roughness: 0.92 });
    var cageMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.cageColor), roughness: 0.45, metalness: 0.4 });
    var padMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
    var metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.75 });
    var bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.bodyColor), roughness: 0.3 });

    // =========================================================================
    // 1. EXTERIOR HOOD / BONNET VISIBLE THROUGH WINDSHIELD
    // =========================================================================
    var hoodTex = G.createHoodLiveryTexture(carDef);
    var hoodMat = new THREE.MeshStandardMaterial({ map: hoodTex, roughness: 0.32, metalness: 0.15 });
    var hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.08, 1.28), hoodMat);
    hoodMesh.position.set(0, 0.79, -1.52);
    hoodMesh.rotation.x = 0.045;
    rig.add(hoodMesh);

    // Sculpted hood details per car model
    if (carDef.hoodStyle === 'quattro') {
      var bulge = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.055, 0.88), hoodMat);
      bulge.position.set(0, 0.835, -1.48);
      bulge.rotation.x = 0.045;
      rig.add(bulge);
    } else if (carDef.hoodStyle === 'r037') {
      [-0.36, 0.36].forEach(function (bx) {
        var b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.92), bodyMat);
        b.position.set(bx, 0.835, -1.48);
        b.rotation.x = 0.045;
        rig.add(b);
      });
    } else if (carDef.hoodStyle === 't16' || carDef.hoodStyle === 's4') {
      var vent = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.38), padMat);
      vent.position.set(0, 0.835, -1.35);
      vent.rotation.x = 0.045;
      rig.add(vent);
    }

    // Hood pins & Quad rally light pod visible at front nose edge!
    [-0.65, 0.65].forEach(function (px) {
      var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 8), metalMat);
      pin.position.set(px, 0.80, -2.02);
      rig.add(pin);
    });
    [-0.36, -0.12, 0.12, 0.36].forEach(function (lx) {
      var podBump = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.12, 10), padMat);
      podBump.rotation.x = Math.PI / 2;
      podBump.position.set(lx, 0.81, -2.14);
      rig.add(podBump);
    });

    // Side fender edges visible near A-pillars
    [-0.84, 0.84].forEach(function (fx) {
      var fender = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 1.32), bodyMat);
      fender.position.set(fx, 0.78, -1.48);
      rig.add(fender);
    });

    // =========================================================================
    // 2. CABIN SHELL, ROLL CAGE, SUN-STRIP, MIRRORS & WINDSHIELD WIPERS
    // =========================================================================
    // Main flocked dashboard slab
    var mainDash = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.24, 0.56), dashMat);
    mainDash.position.set(0, 0.76, -0.78);
    rig.add(mainDash);

    // Lower center console tunnel between driver & co-pilot
    var consoleTunnel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 1.05), dashMat);
    consoleTunnel.position.set(0.04, 0.45, -0.45);
    rig.add(consoleTunnel);

    // Door sills / panels on left and right
    [-0.84, 0.84].forEach(function (dx) {
      var door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 1.55), dashMat);
      door.position.set(dx, 0.58, -0.22);
      rig.add(door);
    });

    // A-pillars & roll cage front hoops
    function makeTube(p1, p2, radius, mat) {
      var v1 = new THREE.Vector3(p1[0], p1[1], p1[2]);
      var v2 = new THREE.Vector3(p2[0], p2[1], p2[2]);
      var dir = new THREE.Vector3().subVectors(v2, v1);
      var len = dir.length();
      var mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), mat);
      mesh.position.copy(v1).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return mesh;
    }

    // Left & Right A-pillars + interior roll cage bars
    rig.add(makeTube([-0.80, 0.82, -0.92], [-0.73, 1.38, -0.48], 0.045, bodyMat));
    rig.add(makeTube([0.80, 0.82, -0.92], [0.73, 1.38, -0.48], 0.045, bodyMat));
    // Roll cage inner front bars (with dark protective foam pad!)
    rig.add(makeTube([-0.74, 0.82, -0.84], [-0.67, 1.34, -0.45], 0.025, cageMat));
    rig.add(makeTube([0.74, 0.82, -0.84], [0.67, 1.34, -0.45], 0.025, cageMat));
    // Roof header bar + diagonal roll cage cross brace
    rig.add(makeTube([-0.72, 1.36, -0.46], [0.72, 1.36, -0.46], 0.028, padMat));
    rig.add(makeTube([-0.72, 1.38, -0.46], [-0.72, 1.38, 0.55], 0.026, cageMat));
    rig.add(makeTube([0.72, 1.38, -0.46], [0.72, 1.38, 0.55], 0.026, cageMat));

    // Roof liner & Windshield sun-strip banner ("GROUP B WRC")
    var sunStripTex = G.createBannerTexture('GROUP B WRC', carDef.name, carDef.accentPrimary, carDef.accentSecondary);
    var sunStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(1.44, 0.14),
      new THREE.MeshBasicMaterial({ map: sunStripTex, side: THREE.DoubleSide })
    );
    sunStrip.position.set(0, 1.34, -0.52);
    sunStrip.rotation.x = 0.42;
    rig.add(sunStrip);

    // Interior Rear-View Mirror
    var mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.04), padMat);
    mirrorHousing.position.set(0.02, 1.26, -0.55);
    mirrorHousing.rotation.y = -0.12;
    rig.add(mirrorHousing);
    var mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.21, 0.048),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.08, metalness: 0.9 })
    );
    mirrorGlass.position.set(0.02, 1.26, -0.528);
    mirrorGlass.rotation.y = -0.12;
    rig.add(mirrorGlass);

    // Left & Right Side Wing Mirrors outside A-pillars
    [-0.92, 0.92].forEach(function (mx) {
      var sideMir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.08), bodyMat);
      sideMir.position.set(mx, 0.92, -0.78);
      rig.add(sideMir);
    });

    // Windshield Droplet Overlay Canvas (water/mud splashes cleared by wipers!)
    var dropCanvas = document.createElement('canvas');
    dropCanvas.width = 512;
    dropCanvas.height = 256;
    var dropCtx = dropCanvas.getContext('2d');
    var dropTex = new THREE.CanvasTexture(dropCanvas);
    var windshieldMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.50, 0.62),
      new THREE.MeshBasicMaterial({ map: dropTex, transparent: true, opacity: 0.85, depthWrite: false })
    );
    windshieldMesh.position.set(0, 1.10, -0.72);
    windshieldMesh.rotation.x = -0.56;
    rig.add(windshieldMesh);

    // 3D Windshield Wipers (2 arms pivoting near cowl base)
    var wipers = [];
    [-0.44, 0.14].forEach(function (wx) {
      var wPivot = new THREE.Group();
      wPivot.position.set(wx, 0.86, -0.92);
      wPivot.rotation.x = -0.56;
      var arm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.44, 0.015), padMat);
      arm.position.set(0, 0.22, 0);
      var blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.34, 0.02), padMat);
      blade.position.set(0.03, 0.32, 0);
      blade.rotation.z = -0.18;
      wPivot.add(arm, blade);
      rig.add(wPivot);
      wipers.push(wPivot);
    });

    // =========================================================================
    // 3. ANALOG RALLY GAUGE CLUSTER (Dynamic CanvasTexture on 3D Dash Pod)
    // =========================================================================
    var gaugeCanvas = document.createElement('canvas');
    gaugeCanvas.width = 512;
    gaugeCanvas.height = 220;
    var gaugeCtx = gaugeCanvas.getContext('2d');
    var gaugeTex = new THREE.CanvasTexture(gaugeCanvas);
    gaugeTex.encoding = THREE.sRGBEncoding;

    var binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.16), padMat);
    binnacle.position.set(-0.26, 0.90, -0.74);
    rig.add(binnacle);

    var gaugePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.39, 0.145),
      new THREE.MeshBasicMaterial({ map: gaugeTex })
    );
    gaugePlane.position.set(-0.26, 0.90, -0.658);
    gaugePlane.rotation.x = -0.12;
    rig.add(gaugePlane);

    // =========================================================================
    // 4. STEERING WHEEL + DRIVER GLOVED HANDS (Rotates with steerAngle!)
    // =========================================================================
    var wheelPivot = new THREE.Group();
    wheelPivot.position.set(-0.26, 0.84, -0.48);
    wheelPivot.rotation.x = -0.32;

    var rimMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 });
    var spokeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    var stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
    var gloveMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(carDef.accentPrimary),
      roughness: 0.75
    });

    var wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.017, 10, 28), rimMat);
    wheelPivot.add(wheelRing);

    // Top-dead-center yellow rally alignment tape
    var tdcMarker = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.038, 0.038), stripeMat);
    tdcMarker.position.set(0, 0.148, 0);
    wheelPivot.add(tdcMarker);

    // 3 Spokes + Center horn hub
    var spokeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.012), spokeMat);
    spokeL.position.set(-0.07, 0, -0.01);
    var spokeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.012), spokeMat);
    spokeR.position.set(0.07, 0, -0.01);
    var spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.14, 0.012), spokeMat);
    spokeB.position.set(0, -0.07, -0.01);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.04, 14), padMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = -0.015;
    wheelPivot.add(spokeL, spokeR, spokeB, hub);

    // Driver's Gloved Hands gripping 9-and-3 positions
    [-0.145, 0.145].forEach(function (hx) {
      var hand = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.068, 0.052), gloveMat);
      hand.position.set(hx, 0.01, 0.015);
      var wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.12, 8), gloveMat);
      wrist.rotation.x = Math.PI / 2.2;
      wrist.position.set(hx * 1.05, -0.035, 0.07);
      wheelPivot.add(hand, wrist);
    });

    // Steering column shaft
    var colShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 10), padMat);
    colShaft.rotation.x = Math.PI / 2 - 0.32;
    colShaft.position.set(-0.26, 0.81, -0.58);
    rig.add(colShaft);
    rig.add(wheelPivot);

    // =========================================================================
    // 5. PHYSICAL 3D IN-CAR TRACK MAP SCREEN (Part of the car, NOT HUD!)
    // =========================================================================
    var mapPod = new THREE.Group();
    mapPod.position.set(0.07, 0.87, -0.68);
    mapPod.rotation.y = -0.34; // Angled naturally toward the driver!
    mapPod.rotation.x = -0.10;

    // Rugged aluminum housing + bezel + mounting bracket + hardware buttons
    var podChassis = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.225, 0.055), metalMat);
    mapPod.add(podChassis);
    var podBezel = new THREE.Mesh(new THREE.BoxGeometry(0.285, 0.21, 0.012), padMat);
    podBezel.position.z = 0.026;
    mapPod.add(podBezel);

    // Bracket arm bolting screen pod onto the dashboard top
    var podMount = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.07), padMat);
    podMount.position.set(0, -0.12, -0.02);
    mapPod.add(podMount);

    // 4 physical tactile toggle/mode buttons on bottom bezel
    for (var b = 0; b < 4; b++) {
      var btn = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.012, 0.012),
        new THREE.MeshBasicMaterial({ color: b === 0 ? 0xef4444 : (b === 1 ? 0x22c55e : 0xfacc15) })
      );
      btn.position.set(-0.08 + b * 0.052, -0.095, 0.032);
      mapPod.add(btn);
    }

    var mapCanvas = document.createElement('canvas');
    mapCanvas.width = 512;
    mapCanvas.height = 384;
    var mapCtx = mapCanvas.getContext('2d');
    var mapTex = new THREE.CanvasTexture(mapCanvas);
    mapTex.encoding = THREE.sRGBEncoding;

    var mapScreenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.258, 0.172),
      new THREE.MeshBasicMaterial({ map: mapTex })
    );
    mapScreenMesh.position.set(0, 0.008, 0.033);
    mapPod.add(mapScreenMesh);
    rig.add(mapPod);

    // Precompute normalized 2D track map bounds so updating the 3D screen each frame is blazing fast
    var mapBounds = computeMapBounds(trackInstance);

    // =========================================================================
    // 6. 3D ANIMATED CO-PILOT NEXT TO YOU (Right Bucket Seat)
    // =========================================================================
    var coSeatGroup = new THREE.Group();
    coSeatGroup.position.set(0.34, 0.44, -0.36);

    // Sparco/Recaro Style Bucket Seat with Side Bolsters
    var seatMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.9 });
    var seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.70, 0.10), seatMat);
    seatBack.position.set(0, 0.42, 0.14);
    seatBack.rotation.x = -0.14;
    var seatHeadrest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.11), seatMat);
    seatHeadrest.position.set(0, 0.80, 0.10);
    var bolsterL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.18), seatMat);
    bolsterL.position.set(-0.19, 0.36, 0.07);
    var bolsterR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.54, 0.18), seatMat);
    bolsterR.position.set(0.19, 0.36, 0.07);
    coSeatGroup.add(seatBack, seatHeadrest, bolsterL, bolsterR);

    // Co-Pilot Articulated Body (moves with G-forces & bumps!)
    var coBody = new THREE.Group();
    coBody.position.set(0, 0.24, 0.02);

    var suitMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.copilotSuit), roughness: 0.82 });
    var harnessMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.accentPrimary), roughness: 0.65 });
    var helmetMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(carDef.copilotHelmet), roughness: 0.25, metalness: 0.15 });
    var visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.7 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xdba98a, roughness: 0.7 });

    // Torso & Shoulders
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.20), suitMat);
    torso.position.set(0, 0.22, 0.02);
    coBody.add(torso);

    // 4-Point Racing Harness Shoulder Straps
    [-0.085, 0.085].forEach(function (sx) {
      var strap = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.42, 0.215), harnessMat);
      strap.position.set(sx, 0.24, 0.015);
      coBody.add(strap);
    });

    // Co-Pilot Articulated Head with Open-Face Peltor Rally Helmet + Peak + Intercom Mic!
    var coHead = new THREE.Group();
    coHead.position.set(0, 0.52, -0.02);

    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 14), helmetMat);
    helmet.scale.set(0.95, 1.05, 1.08);
    coHead.add(helmet);

    var helmetPeak = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.022, 0.10), padMat);
    helmetPeak.position.set(0, 0.08, -0.125);
    helmetPeak.rotation.x = 0.18;
    coHead.add(helmetPeak);

    // Visor tint + face opening + Peltor ear cups + boom mic
    var face = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.10, 0.05), skinMat);
    face.position.set(0, -0.015, -0.115);
    coHead.add(face);

    var goggles = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.048, 0.055), visorMat);
    goggles.position.set(0, 0.025, -0.12);
    coHead.add(goggles);

    [-0.125, 0.125].forEach(function (ex) {
      var earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.035, 10), padMat);
      earCup.rotation.z = Math.PI / 2;
      earCup.position.set(ex, -0.01, -0.01);
      coHead.add(earCup);
    });

    // Boom microphone curving from left ear cup to mouth
    var boom = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.13, 6), metalMat);
    boom.rotation.x = Math.PI / 2;
    boom.rotation.z = -0.45;
    boom.position.set(-0.075, -0.05, -0.10);
    var micFoam = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), padMat);
    micFoam.position.set(-0.02, -0.055, -0.155);
    coHead.add(boom, micFoam);

    coBody.add(coHead);

    // Co-Pilot Arms & Open Pacenotes Notebook!
    var coArms = new THREE.Group();
    coArms.position.set(0, 0.25, -0.04);

    var armL = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.28, 8), suitMat);
    armL.rotation.x = 1.1;
    armL.rotation.z = -0.25;
    armL.position.set(-0.14, -0.03, -0.12);

    var armR = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.28, 8), suitMat);
    armR.rotation.x = 1.1;
    armR.rotation.z = 0.25;
    armR.position.set(0.14, -0.03, -0.12);

    // Pacenotes Binder held in front of co-pilot
    var notesCanvas = document.createElement('canvas');
    notesCanvas.width = 256;
    notesCanvas.height = 192;
    var nCtx = notesCanvas.getContext('2d');
    nCtx.fillStyle = '#f8f5e6';
    nCtx.fillRect(0, 0, 256, 192);
    nCtx.fillStyle = '#cbd5e1';
    nCtx.fillRect(124, 0, 8, 192);
    nCtx.strokeStyle = '#94a3b8';
    nCtx.lineWidth = 1;
    for (var row = 28; row < 180; row += 28) {
      nCtx.beginPath(); nCtx.moveTo(10, row); nCtx.lineTo(116, row); nCtx.stroke();
      nCtx.beginPath(); nCtx.moveTo(138, row); nCtx.lineTo(246, row); nCtx.stroke();
    }
    nCtx.fillStyle = '#1e293b';
    nCtx.font = 'bold 22px monospace';
    nCtx.fillText('3L > CREST', 14, 48);
    nCtx.fillStyle = '#dc2626';
    nCtx.fillText('HP R!!', 14, 80);
    nCtx.fillStyle = '#0f172a';
    nCtx.fillText('DON\'T CUT', 14, 112);
    nCtx.fillText('120 -> 4L', 142, 48);
    nCtx.fillStyle = '#0284c7';
    nCtx.fillText('SLIPPERY!', 142, 80);
    var notesTex = new THREE.CanvasTexture(notesCanvas);
    notesTex.encoding = THREE.sRGBEncoding;

    var binder = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.014, 0.17),
      new THREE.MeshBasicMaterial({ map: notesTex })
    );
    binder.position.set(-0.02, -0.06, -0.24);
    binder.rotation.x = 0.58;
    binder.rotation.y = -0.22; // tilted slightly so driver can glimpse the notes!

    // Co-pilot gloved hands gripping binder + pointing arm for urgent calls
    var coHandL = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.036, 0.05), gloveMat);
    coHandL.position.set(-0.11, -0.06, -0.22);
    var coHandR = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.036, 0.05), gloveMat);
    coHandR.position.set(0.09, -0.05, -0.22);

    coArms.add(armL, armR, binder, coHandL, coHandR);
    coBody.add(coArms);
    coSeatGroup.add(coBody);
    rig.add(coSeatGroup);

    // =========================================================================
    // 7. HEADLIGHT / RALLY SPOTLIGHT POD BEAM (Toggleable with L)
    // =========================================================================
    var headlight = new THREE.SpotLight(0xfff5d6, 0.0, 120, Math.PI / 5.2, 0.45, 1.2);
    headlight.position.set(0, 0.85, -2.0);
    var headTarget = new THREE.Object3D();
    headTarget.position.set(0, -1.2, -32);
    rig.add(headlight, headTarget);
    headlight.target = headTarget;

    // Runtime state for gauges, map screen, droplets, wipers & co-pilot animation
    var state = {
      rig: rig,
      wheelPivot: wheelPivot,
      wipers: wipers,
      wiperAngle: 0,
      wiperActiveTimer: 0,
      wiperContinuous: false,
      droplets: [],
      dropCanvas: dropCanvas,
      dropCtx: dropCtx,
      dropTex: dropTex,
      gaugeCanvas: gaugeCanvas,
      gaugeCtx: gaugeCtx,
      gaugeTex: gaugeTex,
      mapCanvas: mapCanvas,
      mapCtx: mapCtx,
      mapTex: mapTex,
      mapBounds: mapBounds,
      trackInstance: trackInstance,
      carDef: carDef,
      tyreDef: tyreDef,
      coBody: coBody,
      coHead: coHead,
      coArms: coArms,
      coHandL: coHandL,
      headlight: headlight,
      lightsOn: trackInstance.def.biome !== 'snow',
      callGestureTimer: 0,
      callGestureDir: 0,
      lastGaugeDraw: 0,
      lastMapDraw: 0
    };

    headlight.intensity = state.lightsOn ? 1.8 : 0;

    return state;
  };

  function computeMapBounds(track) {
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var i = 0; i < track.samples.length; i++) {
      var p = track.samples[i].pos;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    var pad = 40;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    var spanX = Math.max(100, maxX - minX);
    var spanZ = Math.max(100, maxZ - minZ);
    var scale = Math.min(340 / spanX, 285 / spanZ);
    return {
      minX: minX,
      minZ: minZ,
      spanX: spanX,
      spanZ: spanZ,
      scale: scale,
      offsetX: 256 - (spanX * scale) * 0.5,
      offsetY: 204 - (spanZ * scale) * 0.5
    };
  }

  /**
   * Renders the Physical 3D In-Car Track Map Screen CanvasTexture
   */
  function drawDashboardMap(cs, physState, activePacenote) {
    var ctx = cs.mapCtx;
    var W = 512, H = 384;
    var track = cs.trackInstance;
    var b = cs.mapBounds;

    // Dark phosphor CRT/LCD rally navigation background
    ctx.fillStyle = '#071319';
    ctx.fillRect(0, 0, W, H);

    // Subtle telemetry grid lines
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.11)';
    ctx.lineWidth = 1;
    for (var gx = 32; gx < W; gx += 48) {
      ctx.beginPath(); ctx.moveTo(gx, 44); ctx.lineTo(gx, H - 36); ctx.stroke();
    }
    for (var gy = 44; gy < H - 36; gy += 48) {
      ctx.beginPath(); ctx.moveTo(16, gy); ctx.lineTo(W - 16, gy); ctx.stroke();
    }

    // Header bar on in-car screen
    ctx.fillStyle = '#0f2733';
    ctx.fillRect(0, 0, W, 42);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 19px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('STAGE NAV // ' + track.def.biomeLabel, 14, 27);

    var pct = Math.min(100, Math.round((physState.trackDist / Math.max(1, track.finishDist)) * 100));
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'right';
    ctx.fillText(pct + '%', W - 14, 27);

    function toMapX(wx) { return b.offsetX + (wx - b.minX) * b.scale; }
    function toMapY(wz) { return b.offsetY + (wz - b.minZ) * b.scale; }

    // Draw road spline colored by actual surface zones!
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer dark glow under track
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 11;
    ctx.beginPath();
    for (var i = 0; i < track.samples.length; i += 4) {
      var s = track.samples[i];
      var mx = toMapX(s.pos.x);
      var my = toMapY(s.pos.z);
      if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
    }
    ctx.stroke();

    // Surface-colored route segments
    for (var i = 4; i < track.samples.length; i += 4) {
      var prev = track.samples[i - 4];
      var cur = track.samples[i];
      var surf = G.SURFACES[cur.surfaceId];
      ctx.strokeStyle = cur.dist <= physState.trackDist ? '#22c55e' : surf.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(toMapX(prev.pos.x), toMapY(prev.pos.z));
      ctx.lineTo(toMapX(cur.pos.x), toMapY(cur.pos.z));
      ctx.stroke();
    }

    // Sector Split dots (S1, S2) & Finish flag pin
    var s1 = track.samples[Math.floor(track.samples.length * 0.33)];
    var s2 = track.samples[Math.floor(track.samples.length * 0.66)];
    var fin = track.samples[track.finishSampleIdx];
    [
      { s: s1, lbl: 'S1', col: '#facc15' },
      { s: s2, lbl: 'S2', col: '#38bdf8' },
      { s: fin, lbl: 'FIN', col: '#ef4444' }
    ].forEach(function (pin) {
      var px = toMapX(pin.s.pos.x);
      var py = toMapY(pin.s.pos.z);
      ctx.fillStyle = pin.col;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(pin.lbl, px + 9, py + 5);
    });

    // Upcoming Pacenote Corner Target Ring on map
    if (activePacenote && activePacenote.cornerPos) {
      var cx = toMapX(activePacenote.cornerPos.x);
      var cy = toMapY(activePacenote.cornerPos.z);
      ctx.strokeStyle = activePacenote.urgency === 'danger' ? '#ef4444' : '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player Car Arrow Marker & Heading
    var carX = toMapX(physState.pos.x);
    var carY = toMapY(physState.pos.z);
    ctx.save();
    ctx.translate(carX, carY);
    // In Three.js yaw=0 faces -Z (up on map, angle 0); yaw>0 rotates CCW toward -X (left)
    ctx.rotate(-physState.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 9);
    ctx.lineTo(0, 4);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Footer Status Bar on physical car screen
    var curSurf = G.SURFACES[physState.surfaceId] || G.SURFACES.gravel;
    ctx.fillStyle = '#0c1f29';
    ctx.fillRect(0, H - 36, W, 36);
    ctx.fillStyle = curSurf.color;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ROAD: ' + curSurf.label, 14, H - 11);

    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'right';
    ctx.fillText((physState.trackDist / 1000).toFixed(2) + ' / ' + (track.finishDist / 1000).toFixed(2) + ' KM', W - 14, H - 11);

    // Subtle CRT scanline sheen
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (var y = 0; y < H; y += 6) {
      ctx.fillRect(0, y, W, 2);
    }

    cs.mapTex.needsUpdate = true;
  }

  /**
   * Renders the Analog Tachometer, Boost Bar, Speed, Gear & Tyre Grip Gauges on 3D Dash
   */
  function drawDashboardGauges(cs, physState, useMph) {
    var ctx = cs.gaugeCtx;
    var W = 512, H = 220;
    var car = cs.carDef;

    ctx.fillStyle = '#0d0f12';
    ctx.fillRect(0, 0, W, H);

    // Left Dial: Analog Tachometer
    var cx = 112, cy = 112, r = 88;
    ctx.fillStyle = '#14171c';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Redline zone arc
    var startA = Math.PI * 0.75;
    var endA = Math.PI * 2.25;
    var redStart = startA + (endA - startA) * 0.82;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, redStart, endA);
    ctx.stroke();

    // Tick marks 0..9
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var k = 0; k <= 9; k++) {
      var a = startA + (endA - startA) * (k / 9);
      var tx = cx + Math.cos(a) * (r - 24);
      var ty = cy + Math.sin(a) * (r - 24);
      ctx.fillStyle = k >= 8 ? '#f87171' : '#e2e8f0';
      ctx.fillText(String(k), tx, ty);
    }

    // RPM Needle
    var rpmFrac = Math.max(0, Math.min(1.03, physState.rpm / (car.redlineRpm * 1.05)));
    var needleA = startA + (endA - startA) * rpmFrac;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleA) * (r - 16), cy + Math.sin(needleA) * (r - 16));
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();

    // Shift light LED on top of tach
    var shiftFlash = physState.rpm > car.redlineRpm * 0.90;
    ctx.fillStyle = shiftFlash ? '#ef4444' : '#331111';
    ctx.beginPath(); ctx.arc(cx, 18, 9, 0, Math.PI * 2); ctx.fill();

    // Center Digital Gear & Speed
    ctx.fillStyle = '#181c24';
    ctx.fillRect(216, 18, 120, 184);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(216, 18, 120, 184);

    ctx.fillStyle = '#facc15';
    ctx.font = '900 72px monospace';
    ctx.textAlign = 'center';
    var gearText = physState.gear === -1 ? 'R' : (physState.gear === 0 ? 'N' : String(physState.gear));
    ctx.fillText(gearText, 276, 78);

    var spd = useMph ? Math.round(physState.speedKmh * 0.621371) : Math.round(physState.speedKmh);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px monospace';
    ctx.fillText(String(spd), 276, 146);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(useMph ? 'MPH' : 'KM/H', 276, 178);

    // Right Pod: Boost Pressure Bar + Tyre Grip & Temp Telemetry
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BOOST ' + physState.boost.toFixed(1) + ' BAR', 352, 34);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(352, 44, 142, 22);
    var boostPct = Math.max(0, Math.min(1, physState.boost / Math.max(1, car.maxBoostBar)));
    ctx.fillStyle = boostPct > 0.78 ? '#ef4444' : '#38bdf8';
    ctx.fillRect(354, 46, 138 * boostPct, 18);

    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('TYRE GRIP', 352, 98);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(352, 108, 142, 22);
    var gripPct = Math.max(0, Math.min(1, physState.effectiveGrip / 1.15));
    ctx.fillStyle = gripPct < 0.45 ? '#ef4444' : (gripPct < 0.75 ? '#facc15' : '#22c55e');
    ctx.fillRect(354, 110, 138 * gripPct, 18);

    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('TYRE TEMP ' + Math.round(physState.tyreTemp) + '°C', 352, 162);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('WEAR ' + Math.round((1 - physState.tyreHealth) * 100) + '%', 352, 190);

    cs.gaugeTex.needsUpdate = true;
  }

  /**
   * Updates all animated cockpit elements every frame:
   * - Steering wheel rotation
   * - Co-pilot lateral G-lean, vertical bounce, head look & pacenote gesture
   * - Windshield droplets & sweeping wipers
   * - Live 3D Dashboard Gauge Cluster & Physical Track Map Screen
   */
  G.updateCockpitRig = function (cs, physState, activePacenote, settings, dt, nowSec) {
    // 1. Rotate steering wheel smoothly matching steering + countersteer (+Z rotates top left)
    cs.wheelPivot.rotation.z = physState.steerWheelVis * 1.45;

    // 2. Co-pilot physics reaction (leans opposite lateral G, bounces on suspension/landings)
    var targetRoll = Math.max(-0.22, Math.min(0.22, -physState.latG * 0.018));
    var targetY = 0.24 + Math.max(-0.07, Math.min(0.08, -physState.vertVel * 0.014));
    cs.coBody.rotation.z += (targetRoll - cs.coBody.rotation.z) * Math.min(1, dt * 10);
    cs.coBody.position.y += (targetY - cs.coBody.position.y) * Math.min(1, dt * 12);

    // Co-pilot head glances at pacenotes or looks up & points when calling a corner
    if (cs.callGestureTimer > 0) {
      cs.callGestureTimer = Math.max(0, cs.callGestureTimer - dt);
      cs.coHead.rotation.x += (-0.05 - cs.coHead.rotation.x) * Math.min(1, dt * 10);
      cs.coHead.rotation.y += ((cs.callGestureDir * 0.25 + 0.18) - cs.coHead.rotation.y) * Math.min(1, dt * 10);
      cs.coArms.position.y += (0.31 - cs.coArms.position.y) * Math.min(1, dt * 10);
    } else {
      cs.coHead.rotation.x += (0.22 - cs.coHead.rotation.x) * Math.min(1, dt * 5); // Reading binder!
      cs.coHead.rotation.y += (0.04 - cs.coHead.rotation.y) * Math.min(1, dt * 5);
      cs.coArms.position.y += (0.25 - cs.coArms.position.y) * Math.min(1, dt * 6);
    }

    // 3. Windshield droplets & wipers
    if (physState.justSplashed) {
      cs.wiperActiveTimer = 2.6;
      for (var d = 0; d < 28; d++) {
        cs.droplets.push({
          x: Math.random() * 512,
          y: Math.random() * 256,
          r: 4 + Math.random() * 10,
          col: physState.surfaceId === 'mud' ? 'rgba(92,58,32,0.75)' : 'rgba(205,236,255,0.7)'
        });
      }
    }

    if (cs.wiperActiveTimer > 0 || cs.wiperContinuous) {
      cs.wiperActiveTimer = Math.max(0, cs.wiperActiveTimer - dt);
      cs.wiperAngle += dt * 7.2;
      var sweep = (Math.sin(cs.wiperAngle) * 0.5 + 0.5) * 1.15 - 0.15;
      cs.wipers[0].rotation.z = -sweep;
      cs.wipers[1].rotation.z = -sweep;
      if (Math.sin(cs.wiperAngle) > 0.85 && cs.droplets.length > 0) {
        cs.droplets.length = Math.max(0, cs.droplets.length - 8);
      }
    } else {
      cs.wipers[0].rotation.z += (0.15 - cs.wipers[0].rotation.z) * Math.min(1, dt * 8);
      cs.wipers[1].rotation.z += (0.15 - cs.wipers[1].rotation.z) * Math.min(1, dt * 8);
    }

    // Redraw droplets canvas only when needed
    var dCtx = cs.dropCtx;
    dCtx.clearRect(0, 0, 512, 256);
    if (cs.droplets.length > 0) {
      for (var i = 0; i < cs.droplets.length; i++) {
        var dr = cs.droplets[i];
        dCtx.fillStyle = dr.col;
        dCtx.beginPath();
        dCtx.arc(dr.x, dr.y, dr.r, 0, Math.PI * 2);
        dCtx.fill();
      }
    }
    cs.dropTex.needsUpdate = true;

    // 4. Throttle gauge & map canvas updates cleanly (~30 Hz for gauges, ~20 Hz for map)
    if (nowSec - cs.lastGaugeDraw > 0.032) {
      drawDashboardGauges(cs, physState, settings.units === 'mph');
      cs.lastGaugeDraw = nowSec;
    }
    if (nowSec - cs.lastMapDraw > 0.05) {
      drawDashboardMap(cs, physState, activePacenote);
      cs.lastMapDraw = nowSec;
    }
  };
})(window.GroupBRally);
