/**
 * 3D Rally Stage Builder, Track Spline Physics Query, Biome Scenery & Pacenote Generator.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  var UP = new THREE.Vector3(0, 1, 0);

  function TrackInstance(trackDef, quality) {
    this.def = trackDef;
    this.quality = quality || 'high';
    this.group = new THREE.Group();
    this.samples = [];
    this.totalLength = 0;
    this.pacenotes = [];
    this.obstacles = [];
    this.weatherSystem = null;
    this.wheelSpraySystem = null;
    this.wheelSprayData = [];
  }

  function getSurfaceAtT(def, t) {
    for (var i = 0; i < def.surfaces.length; i++) {
      var s = def.surfaces[i];
      if (t >= s.tStart && t <= s.tEnd) return s.type;
    }
    return def.surfaces[def.surfaces.length - 1].type;
  }

  function getWidthAtT(def, t) {
    if (def.widthOverrides) {
      for (var i = 0; i < def.widthOverrides.length; i++) {
        var w = def.widthOverrides[i];
        if (t >= w.tStart && t <= w.tEnd) {
          // Smoothly blend at boundaries (2% margin)
          var edge = 0.015;
          if (t < w.tStart + edge) {
            var a = (t - w.tStart) / edge;
            return def.defaultWidth * (1 - a) + w.width * a;
          }
          if (t > w.tEnd - edge) {
            var b = (w.tEnd - t) / edge;
            return def.defaultWidth * (1 - b) + w.width * b;
          }
          return w.width;
        }
      }
    }
    return def.defaultWidth;
  }

  function seededRandom(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  TrackInstance.prototype.build = function () {
    var def = this.def;
    var ctrlPts = def.points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); });
    var curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'catmullrom', 0.45);
    var numSamples = 900;

    var rawPts = [];
    for (var i = 0; i <= numSamples; i++) {
      var t = i / numSamples;
      rawPts.push(curve.getPointAt(t));
    }

    var cumDist = 0;
    for (var i = 0; i <= numSamples; i++) {
      var t = i / numSamples;
      var pos = rawPts[i];
      if (i > 0) {
        cumDist += pos.distanceTo(rawPts[i - 1]);
      }

      var prev = rawPts[Math.max(0, i - 1)];
      var next = rawPts[Math.min(numSamples, i + 1)];
      var tangent = new THREE.Vector3().subVectors(next, prev).normalize();

      var horizTan = new THREE.Vector3(tangent.x, 0, tangent.z);
      if (horizTan.lengthSq() < 1e-6) horizTan.set(0, 0, -1);
      horizTan.normalize();

      // Forward x Up = Right (+X when forward is -Z)
      var right = new THREE.Vector3().crossVectors(horizTan, UP).normalize();
      var roadUp = new THREE.Vector3().crossVectors(right, tangent).normalize();

      this.samples.push({
        idx: i,
        t: t,
        dist: cumDist,
        pos: pos,
        tangent: tangent,
        horizTan: horizTan,
        right: right,
        up: roadUp,
        width: getWidthAtT(def, t),
        surfaceId: getSurfaceAtT(def, t),
        curvature: 0,
        bankAngle: 0,
        slope: tangent.y
      });
    }

    this.totalLength = cumDist;

    // Compute signed curvature (positive = RIGHT turn, negative = LEFT turn) and corner banking
    var stepWin = 8;
    for (var i = 0; i < this.samples.length; i++) {
      var sPrev = this.samples[Math.max(0, i - stepWin)];
      var sNext = this.samples[Math.min(this.samples.length - 1, i + stepWin)];
      var ds = Math.max(1, sNext.dist - sPrev.dist);
      var t1 = sPrev.horizTan;
      var t2 = sNext.horizTan;
      // det2D > 0 means turning RIGHT; < 0 means turning LEFT
      var det = t1.x * t2.z - t1.z * t2.x;
      var dot = Math.max(-1, Math.min(1, t1.x * t2.x + t1.z * t2.z));
      var dAngle = Math.acos(dot) * (det >= 0 ? 1 : -1);
      var curv = dAngle / ds; // rad per meter
      this.samples[i].curvature = curv;
      // Subtle realistic banking into curves (max ~4.5 deg)
      this.samples[i].bankAngle = Math.max(-0.08, Math.min(0.08, curv * 3.5));
    }

    this.buildRoadMesh();
    this.buildTerrainSkirt();
    this.buildGantriesAndBridges();
    this.generatePacenotes();
    this.buildCornerSigns();
    this.buildBiomeProps();
    this.buildWeatherAndSpray();

    return this;
  };

  /**
   * Builds the high-detail road ribbon with shoulders, banks/snowbanks, and surface vertex coloring.
   */
  TrackInstance.prototype.buildRoadMesh = function () {
    var def = this.def;
    var samples = this.samples;
    // Cross-section offsets normalized by halfWidth:
    // outerLeftBank(-1.85), leftDitch(-1.30), leftEdge(-1.0), center(0), rightEdge(+1.0), rightDitch(+1.30), outerRightBank(+1.85)
    var profileX = [-1.85, -1.32, -1.0, 0.0, 1.0, 1.32, 1.85];
    var profileY = [0.42, -0.14, 0.0, 0.08, 0.0, -0.14, 0.42];
    if (def.biome === 'snow') {
      // Higher cushioned snowbanks on outer borders
      profileY = [0.78, 0.08, 0.0, 0.06, 0.0, 0.08, 0.78];
    } else if (def.biome === 'jungle') {
      profileY = [0.55, -0.18, 0.0, 0.06, 0.0, -0.18, 0.55];
    }
    var cols = profileX.length;

    var positions = [];
    var colors = [];
    var uvs = [];
    var indices = [];

    var cRoadBase = new THREE.Color(def.roadColor);
    var cVerge = new THREE.Color(def.vergeColor);
    var cSnowBank = new THREE.Color('#eef5fc');
    var cMud = new THREE.Color('#4f311b');
    var cPuddle = new THREE.Color('#27556b');
    var cIce = new THREE.Color('#8ad8f0');
    var cWood = new THREE.Color('#8f653a');
    var cSlush = new THREE.Color('#6f7e8c');
    var cDirt = new THREE.Color('#a3663c');

    var tmpColor = new THREE.Color();

    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var halfW = s.width * 0.5;
      var bankSin = Math.sin(s.bankAngle);
      var surfId = s.surfaceId;

      // Determine surface center color
      var surfColor = cRoadBase;
      if (surfId === 'mud') surfColor = cMud;
      else if (surfId === 'puddle') surfColor = cPuddle;
      else if (surfId === 'ice') surfColor = cIce;
      else if (surfId === 'wood') surfColor = cWood;
      else if (surfId === 'slush') surfColor = cSlush;
      else if (surfId === 'dirt') surfColor = cDirt;

      for (var c = 0; c < cols; c++) {
        var lat = profileX[c] * halfW;
        var bankY = -lat * bankSin; // positive curvature (right turn) lowers right edge slightly
        var localY = profileY[c] + bankY;
        if (surfId === 'wood' && (c === 0 || c === 1 || c === 5 || c === 6)) {
          localY -= 0.45; // drop banks under bridge
        }

        var px = s.pos.x + s.right.x * lat;
        var py = s.pos.y + localY;
        var pz = s.pos.z + s.right.z * lat;

        positions.push(px, py, pz);
        uvs.push(c / (cols - 1), s.dist * 0.14);

        if (c === 0 || c === cols - 1) {
          tmpColor.copy(def.biome === 'snow' ? cSnowBank : cVerge);
        } else if (c === 1 || c === cols - 2) {
          tmpColor.copy(surfColor).lerp(cVerge, 0.55);
        } else {
          tmpColor.copy(surfColor);
        }
        colors.push(tmpColor.r, tmpColor.g, tmpColor.b);
      }

      if (i < samples.length - 1) {
        var row0 = i * cols;
        var row1 = (i + 1) * cols;
        for (var c = 0; c < cols - 1; c++) {
          indices.push(row0 + c, row0 + c + 1, row1 + c);
          indices.push(row0 + c + 1, row1 + c + 1, row1 + c);
        }
      }
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    var roadTex = G.createRoadTexture(def.biome);
    var mat = new THREE.MeshStandardMaterial({
      map: roadTex,
      vertexColors: true,
      roughness: def.biome === 'snow' ? 0.62 : 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(geom, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  };

  /**
   * Generates a wide seamless surrounding terrain ribbon along the entire track
   * so there are zero floating track voids and realistic hills/valleys flank the stage.
   */
  TrackInstance.prototype.buildTerrainSkirt = function () {
    var def = this.def;
    var samples = this.samples;
    var step = 5;
    // Compact lateral skirt so tight hairpins never swing terrain across adjacent road legs
    var latOffsets = [-42, -26, -15, -8.5, -5.5, 5.5, 8.5, 15, 26, 42];
    var cols = latOffsets.length;

    var positions = [];
    var uvs = [];
    var indices = [];

    var minTrackY = Infinity;
    for (var m = 0; m < samples.length; m += 10) {
      if (samples[m].pos.y < minTrackY) minTrackY = samples[m].pos.y;
    }

    var rowCount = 0;
    for (var i = 0; i < samples.length; i += step) {
      var s = samples[i];
      for (var c = 0; c < cols; c++) {
        var lat = latOffsets[c];
        var px = s.pos.x + s.right.x * lat;
        var pz = s.pos.z + s.right.z * lat;

        var absLat = Math.abs(lat);
        var py = s.pos.y - 0.35;
        if (absLat > 10) {
          var tOut = Math.min(1, (absLat - 10) / 32);
          var wave = Math.sin(px * 0.03 + pz * 0.02) * 3.5 + Math.cos(px * 0.06 - pz * 0.05) * 1.8;
          var ridge = def.biome === 'snow' ? 7.5 * tOut : 4.2 * tOut;
          py = s.pos.y - 0.3 + tOut * (ridge + wave);
        }

        // Guarantee no terrain vertex ever rises above any nearby road segment (e.g. inside hairpins)
        for (var k = 0; k < samples.length; k += 8) {
          var other = samples[k];
          var dx = px - other.pos.x;
          var dz = pz - other.pos.z;
          if (dx * dx + dz * dz < 196) { // within 14m of any road centerline
            py = Math.min(py, other.pos.y - 0.45);
          }
        }

        positions.push(px, py, pz);
        uvs.push(px * 0.04, pz * 0.04);
      }
      if (rowCount > 0) {
        var r0 = (rowCount - 1) * cols;
        var r1 = rowCount * cols;
        for (var c = 0; c < cols - 1; c++) {
          indices.push(r0 + c, r0 + c + 1, r1 + c);
          indices.push(r0 + c + 1, r1 + c + 1, r1 + c);
        }
      }
      rowCount++;
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    var groundTex = G.createGroundTexture(def.biome);
    var mat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.96,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    var terrainMesh = new THREE.Mesh(geom, mat);
    terrainMesh.receiveShadow = true;
    this.group.add(terrainMesh);

    // Distant horizon base ground plane cleanly below all track elevations
    var basePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3600, 3600),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(def.groundColor), roughness: 0.98 })
    );
    basePlane.rotation.x = -Math.PI / 2;
    basePlane.position.set(200, minTrackY - 8, -900);
    this.group.add(basePlane);
  };

  /**
   * Builds Start/Finish Rally Gantries, Sector Split Gates, and Timber Bridge Rails.
   */
  TrackInstance.prototype.buildGantriesAndBridges = function () {
    var def = this.def;
    var samples = this.samples;
    var self = this;

    function createGate(sample, title, subtitle, bg, accent) {
      var g = new THREE.Group();
      var half = sample.width * 0.5 + 1.1;
      var postMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.5, roughness: 0.4 });
      var postGeom = new THREE.CylinderGeometry(0.16, 0.18, 5.2, 8);

      var leftPost = new THREE.Mesh(postGeom, postMat);
      leftPost.position.set(-half, 2.6, 0);
      var rightPost = new THREE.Mesh(postGeom, postMat);
      rightPost.position.set(half, 2.6, 0);

      var tex = G.createBannerTexture(title, subtitle, bg, accent);
      var bannerMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
      var banner = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.5, 1.35, 0.25), bannerMat);
      banner.position.set(0, 4.45, 0);

      // Start light cluster on start gate
      if (title.indexOf('START') !== -1) {
        var lightHousing = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.55, 0.35),
          new THREE.MeshStandardMaterial({ color: 0x111827 })
        );
        lightHousing.position.set(0, 3.55, 0.1);
        g.add(lightHousing);
        self.startLightBulbs = [];
        for (var b = 0; b < 3; b++) {
          var bulbMat = new THREE.MeshBasicMaterial({ color: 0x331111 });
          var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bulbMat);
          bulb.position.set((b - 1) * 0.65, 3.55, 0.28);
          g.add(bulb);
          self.startLightBulbs.push(bulbMat);
        }
      }

      g.add(leftPost, rightPost, banner);
      g.position.copy(sample.pos);
      var angle = Math.atan2(-sample.horizTan.x, -sample.horizTan.z);
      g.rotation.y = angle;
      self.group.add(g);
    }

    // Start Gantry
    createGate(samples[4], 'GROUP B START', def.name, '#111827', '#ef4444');
    // Sector Split Gates at 33% and 66%
    createGate(samples[Math.floor(samples.length * 0.33)], 'SECTOR 1 SPLIT', 'WRC TIMING CHECK', '#1e293b', '#facc15');
    createGate(samples[Math.floor(samples.length * 0.66)], 'SECTOR 2 SPLIT', 'WRC TIMING CHECK', '#1e293b', '#38bdf8');
    // Finish Gantry at 96%
    this.finishSampleIdx = Math.floor(samples.length * 0.96);
    this.finishDist = samples[this.finishSampleIdx].dist;
    createGate(samples[this.finishSampleIdx], 'STAGE FINISH', 'FLYING FINISH LINE', '#7f1d1d', '#facc15');

    // Timber Bridge guardrails in Forest stage
    if (def.id === 'forest') {
      var railMat = new THREE.MeshStandardMaterial({ color: 0x6e4a29, roughness: 0.9 });
      var railGeom = new THREE.BoxGeometry(0.22, 0.85, 3.4);
      for (var i = 0; i < samples.length; i += 4) {
        var s = samples[i];
        if (s.surfaceId === 'wood') {
          var angle = Math.atan2(-s.horizTan.x, -s.horizTan.z);
          var hw = s.width * 0.5 + 0.15;
          [-1, 1].forEach(function (side) {
            var rail = new THREE.Mesh(railGeom, railMat);
            rail.position.set(
              s.pos.x + s.right.x * hw * side,
              s.pos.y + 0.45,
              s.pos.z + s.right.z * hw * side
            );
            rail.rotation.y = angle;
            self.group.add(rail);
          });
        }
      }
    }
  };

  /**
   * Automatically scans spline curvature + surface changes + special calls
   * to generate authentic rally co-pilot pacenotes with turn grades (1-6/HAIRPIN) and road status.
   */
  TrackInstance.prototype.generatePacenotes = function () {
    var samples = this.samples;
    var def = this.def;
    var notes = [];

    var i = 15;
    while (i < samples.length - 25) {
      var curv = Math.abs(samples[i].curvature);
      if (curv > 0.0046) {
        // Group contiguous curve segment of same direction
        var dir = samples[i].curvature >= 0 ? 'RIGHT' : 'LEFT';
        var startIdx = i;
        var peakCurv = curv;
        var sumAngle = 0;
        var j = i;

        while (j < samples.length - 10) {
          var c = samples[j].curvature;
          var sameDir = (dir === 'RIGHT' && c > 0.0028) || (dir === 'LEFT' && c < -0.0028);
          if (!sameDir) break;
          if (Math.abs(c) > peakCurv) peakCurv = Math.abs(c);
          if (j > startIdx) {
            sumAngle += Math.abs(c) * (samples[j].dist - samples[j - 1].dist);
          }
          j++;
        }

        var endIdx = j;
        var turnDeg = sumAngle * (180 / Math.PI);
        var minRadius = 1 / Math.max(0.0001, peakCurv);

        if (turnDeg > 14) {
          var grade = 5;
          var urgency = 'info';
          var title = '';
          if (turnDeg > 105 || minRadius < 26) {
            grade = 'HP';
            urgency = 'danger';
            title = 'HAIRPIN ' + dir;
          } else if (minRadius < 42) {
            grade = 1;
            urgency = 'danger';
            title = '1 ' + dir;
          } else if (minRadius < 60) {
            grade = 2;
            urgency = 'warn';
            title = '2 ' + dir;
          } else if (minRadius < 88) {
            grade = 3;
            urgency = 'warn';
            title = '3 ' + dir;
          } else if (minRadius < 135) {
            grade = 4;
            urgency = 'info';
            title = '4 ' + dir;
          } else {
            grade = 5;
            urgency = 'info';
            title = '5 ' + dir;
          }

          var midIdx = Math.floor((startIdx + endIdx) * 0.5);
          var surf = G.SURFACES[samples[midIdx].surfaceId];
          var extra = '';
          if (turnDeg > 68 && grade !== 'HP') extra = 'LONG';
          else if (samples[midIdx].slope > 0.045) extra = 'OVER CREST';
          else if (samples[startIdx].width < 7.1) extra = 'NARROW';

          var triggerDist = Math.max(12, samples[startIdx].dist - 78);
          notes.push({
            id: 'turn_' + startIdx,
            triggerDist: triggerDist,
            cornerDist: samples[startIdx].dist,
            endDist: samples[endIdx].dist,
            cornerPos: samples[startIdx].pos.clone(),
            dir: dir,
            grade: grade,
            title: title,
            extra: extra,
            statusLabel: surf.label,
            statusClass: surf.badgeClass,
            urgency: urgency,
            spoken: (title + (extra ? ', ' + extra : '') + ', ' + surf.shortLabel).toLowerCase()
          });
        }
        i = endIdx + 10;
      } else {
        i++;
      }
    }

    // Merge special surface / crest / bridge radio calls
    if (def.specialCalls) {
      for (var k = 0; k < def.specialCalls.length; k++) {
        var sc = def.specialCalls[k];
        var idx = Math.min(samples.length - 1, Math.floor(sc.t * (samples.length - 1)));
        var s = samples[idx];
        notes.push({
          id: 'spec_' + k,
          triggerDist: Math.max(15, s.dist - 68),
          cornerDist: s.dist,
          endDist: s.dist + 40,
          cornerPos: s.pos.clone(),
          dir: 'CAUTION',
          grade: '!',
          title: sc.note,
          extra: 'CAUTION',
          statusLabel: sc.status,
          statusClass: 'status-danger',
          urgency: 'danger',
          spoken: (sc.note + ', ' + sc.status).toLowerCase()
        });
      }
    }

    // Add opening stage note
    var firstSurf = G.SURFACES[samples[5].surfaceId];
    notes.push({
      id: 'start_note',
      triggerDist: 0,
      cornerDist: 45,
      endDist: 90,
      cornerPos: samples[15].pos.clone(),
      dir: 'STRAIGHT',
      grade: 'GO',
      title: 'FLAT STRAIGHT',
      extra: 'GOOD LUCK',
      statusLabel: firstSurf.label,
      statusClass: firstSurf.badgeClass,
      urgency: 'info',
      spoken: 'go! flat straight, ' + firstSurf.shortLabel.toLowerCase()
    });

    notes.sort(function (a, b) { return a.triggerDist - b.triggerDist; });

    // Ensure trigger distances aren't stacked right on top of each other (< 28m apart)
    for (var n = 1; n < notes.length; n++) {
      if (notes[n].triggerDist < notes[n - 1].triggerDist + 24) {
        notes[n].triggerDist = notes[n - 1].triggerDist + 24;
      }
    }

    this.pacenotes = notes;
  };

  /**
   * Places high-visibility Rally Chevron Warning Signs on outer corner Apexes
   */
  TrackInstance.prototype.buildCornerSigns = function () {
    var rightTex = G.createChevronTexture('right');
    var leftTex = G.createChevronTexture('left');
    var rightMat = new THREE.MeshStandardMaterial({ map: rightTex, roughness: 0.45 });
    var leftMat = new THREE.MeshStandardMaterial({ map: leftTex, roughness: 0.45 });
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.7 });

    var boardGeom = new THREE.BoxGeometry(2.4, 1.15, 0.12);
    var poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6);

    for (var i = 0; i < this.pacenotes.length; i++) {
      var note = this.pacenotes[i];
      if (note.grade === 'HP' || note.grade === 1 || note.grade === 2 || note.grade === 3) {
        // Place 2 signs around entry & apex on the OUTSIDE of the bend
        var sampleIdx = Math.min(this.samples.length - 1, Math.floor((note.cornerDist / this.totalLength) * (this.samples.length - 1)));
        var offsets = [2, 10];
        for (var o = 0; o < offsets.length; o++) {
          var s = this.samples[Math.min(this.samples.length - 1, sampleIdx + offsets[o])];
          // Outside of RIGHT turn is LEFT (-right), outside of LEFT turn is RIGHT (+right)
          var side = note.dir === 'RIGHT' ? -1 : 1;
          var lat = side * (s.width * 0.5 + 1.35);

          var signGroup = new THREE.Group();
          var board = new THREE.Mesh(boardGeom, note.dir === 'RIGHT' ? rightMat : leftMat);
          board.position.y = 1.65;
          var pole = new THREE.Mesh(poleGeom, poleMat);
          pole.position.y = 1.1;
          signGroup.add(board, pole);

          signGroup.position.set(s.pos.x + s.right.x * lat, s.pos.y, s.pos.z + s.right.z * lat);
          signGroup.rotation.y = Math.atan2(-s.horizTan.x, -s.horizTan.z);
          this.group.add(signGroup);
        }
      }
    }
  };

  /**
   * Populates 3D biome trees, palms, snow poles, boulders, and rally fences using InstancedMesh
   * for crisp 60 FPS rendering. Also registers outer trees/rocks into `this.obstacles`.
   */
  TrackInstance.prototype.buildBiomeProps = function () {
    var def = this.def;
    var samples = this.samples;
    var rand = seededRandom(def.id === 'forest' ? 101 : (def.id === 'jungle' ? 202 : 303));
    var densityMult = this.quality === 'low' ? 0.5 : (this.quality === 'medium' ? 0.78 : 1.0);

    var dummy = new THREE.Object3D();

    // 1. High-visibility Roadside Rally Edge Stakes along both sides of the route (all biomes)
    var poleCount = Math.floor(samples.length / 4) * 2;
    var poleMat = def.biome === 'snow'
      ? new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 })
      : new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    var poleHeight = def.biome === 'snow' ? 1.85 : 1.05;
    var poleMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.055, 0.065, poleHeight, 6),
      poleMat,
      poleCount
    );
    var capMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.18, 6),
      new THREE.MeshBasicMaterial({ color: def.biome === 'snow' ? 0xfef08a : 0xef4444 }),
      poleCount
    );
    var idx = 0;
    for (var i = 8; i < samples.length - 8; i += 4) {
      var s = samples[i];
      var hw = s.width * 0.5 + 0.65;
      [-1, 1].forEach(function (side) {
        if (idx < poleCount) {
          var px = s.pos.x + s.right.x * hw * side;
          var pz = s.pos.z + s.right.z * hw * side;
          dummy.position.set(px, s.pos.y + poleHeight * 0.5, pz);
          dummy.rotation.set(0, 0, side * 0.04);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          poleMesh.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(px, s.pos.y + poleHeight - 0.08, pz);
          dummy.updateMatrix();
          capMesh.setMatrixAt(idx, dummy.matrix);
          idx++;
        }
      });
    }
    poleMesh.count = idx;
    capMesh.count = idx;
    poleMesh.instanceMatrix.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
    this.group.add(poleMesh, capMesh);

    // 2. Trees / Palms / Flocked Pines (Instanced trunks + crowns)
    var treeTarget = Math.floor(950 * densityMult);
    var trunkGeom, crownGeom, trunkMat, crownMat, crown2Mat, crown2Geom;

    if (def.biome === 'forest') {
      trunkGeom = new THREE.CylinderGeometry(0.22, 0.36, 4.5, 6);
      trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3724, roughness: 0.95 });
      crownGeom = new THREE.ConeGeometry(2.7, 9.5, 7);
      crownMat = new THREE.MeshStandardMaterial({ color: 0x264427, roughness: 0.9 });
      crown2Geom = new THREE.ConeGeometry(2.0, 6.2, 7);
      crown2Mat = new THREE.MeshStandardMaterial({ color: 0x2f542e, roughness: 0.9 });
    } else if (def.biome === 'jungle') {
      trunkGeom = new THREE.CylinderGeometry(0.18, 0.32, 9.0, 6);
      trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 0.92 });
      crownGeom = new THREE.DodecahedronGeometry(3.3, 0);
      crownMat = new THREE.MeshStandardMaterial({ color: 0x2a6627, roughness: 0.85 });
      crown2Geom = new THREE.ConeGeometry(3.2, 2.2, 7);
      crown2Mat = new THREE.MeshStandardMaterial({ color: 0x3b8030, roughness: 0.82 });
    } else {
      // Snow alpine frosted pines
      trunkGeom = new THREE.CylinderGeometry(0.20, 0.34, 4.2, 6);
      trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d332a, roughness: 0.95 });
      crownGeom = new THREE.ConeGeometry(2.6, 8.8, 7);
      crownMat = new THREE.MeshStandardMaterial({ color: 0x283e3b, roughness: 0.88 });
      crown2Geom = new THREE.ConeGeometry(2.1, 4.4, 7);
      crown2Mat = new THREE.MeshStandardMaterial({ color: 0xe6eff8, roughness: 0.72 }); // Snow cap!
    }

    var trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, treeTarget);
    var crowns = new THREE.InstancedMesh(crownGeom, crownMat, treeTarget);
    var crowns2 = new THREE.InstancedMesh(crown2Geom, crown2Mat, treeTarget);
    trunks.castShadow = this.quality === 'high';
    crowns.castShadow = this.quality === 'high';

    var placed = 0;
    for (var attempt = 0; attempt < treeTarget * 2 && placed < treeTarget; attempt++) {
      var sIdx = Math.floor(rand() * (samples.length - 10)) + 5;
      var s = samples[sIdx];
      var side = rand() > 0.5 ? 1 : -1;
      var distFromEdge = 4.2 + Math.pow(rand(), 1.25) * 44;
      var lat = side * (s.width * 0.5 + distFromEdge);

      var tx = s.pos.x + s.right.x * lat;
      var tz = s.pos.z + s.right.z * lat;

      // Ensure we never place a tree onto another nearby track segment
      var tooCloseToRoad = false;
      for (var k = 0; k < samples.length; k += 12) {
        var other = samples[k];
        var dx = tx - other.pos.x;
        var dz = tz - other.pos.z;
        if (dx * dx + dz * dz < (other.width * 0.5 + 3.4) * (other.width * 0.5 + 3.4)) {
          tooCloseToRoad = true;
          break;
        }
      }
      if (tooCloseToRoad) continue;

      var scale = 0.75 + rand() * 0.85;
      var ty = s.pos.y + (distFromEdge > 12 ? (distFromEdge - 12) * 0.08 : 0);
      var rotY = rand() * Math.PI * 2;
      var lean = def.biome === 'jungle' ? (rand() - 0.5) * 0.24 : (rand() - 0.5) * 0.06;

      // Trunk
      dummy.position.set(tx, ty + (def.biome === 'jungle' ? 4.2 : 2.0) * scale, tz);
      dummy.rotation.set(lean, rotY, lean * 0.7);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);

      // Primary Canopy
      var crownY = def.biome === 'jungle' ? 8.8 : 6.4;
      dummy.position.set(tx, ty + crownY * scale, tz);
      dummy.rotation.set(lean * 0.5, rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      crowns.setMatrixAt(placed, dummy.matrix);

      // Upper Canopy / Snow Cap
      var crown2Y = def.biome === 'jungle' ? 9.6 : (def.biome === 'snow' ? 8.8 : 9.4);
      dummy.position.set(tx, ty + crown2Y * scale, tz);
      dummy.updateMatrix();
      crowns2.setMatrixAt(placed, dummy.matrix);

      // Register close roadside trees as physical obstacles
      if (distFromEdge < 13.5) {
        this.obstacles.push({ x: tx, z: tz, radius: 0.75 * scale });
      }
      placed++;
    }
    trunks.count = placed;
    crowns.count = placed;
    crowns2.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    crowns2.instanceMatrix.needsUpdate = true;
    this.group.add(trunks, crowns, crowns2);

    // 3. Roadside Boulders / Ferns / Snow Mounds
    var rockTarget = Math.floor(240 * densityMult);
    var rockGeom = new THREE.DodecahedronGeometry(1.1, 0);
    var rockMat = new THREE.MeshStandardMaterial({
      color: def.biome === 'snow' ? 0x64748b : (def.biome === 'jungle' ? 0x3b4d2b : 0x57534e),
      roughness: 0.92
    });
    var rocks = new THREE.InstancedMesh(rockGeom, rockMat, rockTarget);
    var rockPlaced = 0;
    for (var r = 0; r < rockTarget * 2 && rockPlaced < rockTarget; r++) {
      var sIdx = Math.floor(rand() * (samples.length - 12)) + 6;
      var s = samples[sIdx];
      var side = rand() > 0.5 ? 1 : -1;
      var dEdge = 2.6 + rand() * 14;
      var lat = side * (s.width * 0.5 + dEdge);
      var rx = s.pos.x + s.right.x * lat;
      var rz = s.pos.z + s.right.z * lat;

      var rockTooClose = false;
      for (var rk = 0; rk < samples.length; rk += 12) {
        var ro = samples[rk];
        var rdx = rx - ro.pos.x;
        var rdz = rz - ro.pos.z;
        if (rdx * rdx + rdz * rdz < (ro.width * 0.5 + 2.4) * (ro.width * 0.5 + 2.4)) {
          rockTooClose = true;
          break;
        }
      }
      if (rockTooClose) continue;

      var rScale = 0.5 + rand() * 1.1;
      dummy.position.set(rx, s.pos.y + 0.35 * rScale, rz);
      dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      dummy.scale.set(rScale * 1.3, rScale * 0.75, rScale);
      dummy.updateMatrix();
      rocks.setMatrixAt(rockPlaced, dummy.matrix);
      if (dEdge < 9.5 && rScale > 0.7) {
        this.obstacles.push({ x: rx, z: rz, radius: 0.85 * rScale });
      }
      rockPlaced++;
    }
    rocks.count = rockPlaced;
    rocks.instanceMatrix.needsUpdate = true;
    this.group.add(rocks);
  };

  /**
   * Weather particles (falling snow / jungle mist rain / dust motes) + dynamic tyre spray
   */
  TrackInstance.prototype.buildWeatherAndSpray = function () {
    var def = this.def;
    var count = def.weatherType === 'snowfall' ? 700 : 320;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 44;
      positions[i * 3 + 1] = Math.random() * 18;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({
      color: def.weatherType === 'snowfall' ? 0xffffff : (def.weatherType === 'mist_rain' ? 0xcce8df : 0xf5e8c8),
      size: def.weatherType === 'snowfall' ? 0.16 : 0.09,
      transparent: true,
      opacity: def.weatherType === 'snowfall' ? 0.82 : 0.38
    });
    this.weatherSystem = new THREE.Points(geom, mat);
    this.group.add(this.weatherSystem);

    // Wheel dust/mud/water spray particle pool
    var sprayCount = 180;
    var sPos = new Float32Array(sprayCount * 3);
    var sCol = new Float32Array(sprayCount * 3);
    for (var j = 0; j < sprayCount; j++) {
      sPos[j * 3 + 1] = -9999;
      this.wheelSprayData.push({
        x: 0, y: -9999, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0.5
      });
    }
    var sGeom = new THREE.BufferGeometry();
    sGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeom.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    var sMat = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    });
    this.wheelSpraySystem = new THREE.Points(sGeom, sMat);
    this.wheelSprayCursor = 0;
    this.group.add(this.wheelSpraySystem);
  };

  TrackInstance.prototype.emitSpray = function (x, y, z, vx, vy, vz, hexColor) {
    if (!this.wheelSpraySystem) return;
    var idx = this.wheelSprayCursor;
    this.wheelSprayCursor = (idx + 1) % this.wheelSprayData.length;
    var p = this.wheelSprayData[idx];
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = 0.45 + Math.random() * 0.25;
    p.maxLife = p.life;

    var colAttr = this.wheelSpraySystem.geometry.attributes.color;
    var c = new THREE.Color(hexColor);
    colAttr.setXYZ(idx, c.r, c.g, c.b);
    colAttr.needsUpdate = true;
  };

  TrackInstance.prototype.updateEffects = function (carPos, dt) {
    if (this.weatherSystem) {
      this.weatherSystem.position.set(carPos.x, carPos.y, carPos.z);
      var posAttr = this.weatherSystem.geometry.attributes.position;
      var arr = posAttr.array;
      var fallSpeed = this.def.weatherType === 'snowfall' ? 4.8 : (this.def.weatherType === 'mist_rain' ? 11.0 : 0.7);
      var drift = this.def.weatherType === 'snowfall' ? 1.8 : 0.3;
      for (var i = 0; i < arr.length; i += 3) {
        arr[i] += Math.sin(arr[i + 1] + i) * drift * dt;
        arr[i + 1] -= fallSpeed * dt;
        if (arr[i + 1] < -1.5) {
          arr[i + 1] = 16.5;
          arr[i] = (Math.random() - 0.5) * 44;
          arr[i + 2] = (Math.random() - 0.5) * 44;
        }
      }
      posAttr.needsUpdate = true;
    }

    if (this.wheelSpraySystem) {
      var sAttr = this.wheelSpraySystem.geometry.attributes.position;
      var sArr = sAttr.array;
      for (var j = 0; j < this.wheelSprayData.length; j++) {
        var p = this.wheelSprayData[j];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 9.0 * dt;
          sArr[j * 3] = p.x;
          sArr[j * 3 + 1] = p.y;
          sArr[j * 3 + 2] = p.z;
        } else {
          sArr[j * 3 + 1] = -9999;
        }
      }
      sAttr.needsUpdate = true;
    }
  };

  /**
   * Fast O(1) localized closest-point query against the track spline samples.
   * Returns road height, surface type, banking, lateral offset, off-road ratio, etc.
   */
  TrackInstance.prototype.queryAt = function (x, z, hintIdx) {
    var samples = this.samples;
    var n = samples.length;
    var start = hintIdx !== undefined ? Math.max(0, hintIdx - 40) : 0;
    var end = hintIdx !== undefined ? Math.min(n - 1, hintIdx + 45) : n - 1;

    var bestIdx = start;
    var bestD2 = Infinity;

    for (var i = start; i <= end; i++) {
      var s = samples[i];
      var dx = x - s.pos.x;
      var dz = z - s.pos.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }

    // Fallback full scan if car wandered far from hint
    if (bestD2 > 900 && hintIdx !== undefined) {
      for (var i = 0; i < n; i++) {
        var s = samples[i];
        var dx = x - s.pos.x;
        var dz = z - s.pos.z;
        var d2 = dx * dx + dz * dz;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestIdx = i;
        }
      }
    }

    // Interpolate smoothly between bestIdx and neighbor
    var s0 = samples[bestIdx];
    var s1 = samples[Math.min(n - 1, bestIdx + 1)];
    if (bestIdx > 0) {
      var sPrev = samples[bestIdx - 1];
      var vx = x - s0.pos.x;
      var vz = z - s0.pos.z;
      if (vx * s0.horizTan.x + vz * s0.horizTan.z < 0) {
        s1 = s0;
        s0 = sPrev;
      }
    }

    var segDx = s1.pos.x - s0.pos.x;
    var segDz = s1.pos.z - s0.pos.z;
    var segLen2 = Math.max(0.0001, segDx * segDx + segDz * segDz);
    var proj = ((x - s0.pos.x) * segDx + (z - s0.pos.z) * segDz) / segLen2;
    proj = Math.max(0, Math.min(1, proj));

    var cx = s0.pos.x + segDx * proj;
    var cy = s0.pos.y + (s1.pos.y - s0.pos.y) * proj;
    var cz = s0.pos.z + segDz * proj;

    var rx = s0.right.x * (1 - proj) + s1.right.x * proj;
    var rz = s0.right.z * (1 - proj) + s1.right.z * proj;
    var lateral = (x - cx) * rx + (z - cz) * rz;

    var width = s0.width * (1 - proj) + s1.width * proj;
    var bankAngle = s0.bankAngle * (1 - proj) + s1.bankAngle * proj;
    var slope = s0.slope * (1 - proj) + s1.slope * proj;
    var dist = s0.dist + (s1.dist - s0.dist) * proj;

    // Account for cross-section crown, banking & ditch/snowbank elevation!
    var halfW = width * 0.5;
    var normLat = Math.abs(lateral) / halfW;
    var profileH = 0.07 * (1 - Math.min(1, normLat));
    if (normLat > 1.0 && normLat <= 1.32) {
      var dt = (normLat - 1.0) / 0.32;
      profileH = this.def.biome === 'snow' ? 0.08 * dt : -0.14 * dt;
    } else if (normLat > 1.32) {
      var bt = Math.min(1.5, (normLat - 1.32) / 0.53);
      profileH = this.def.biome === 'snow' ? 0.08 + 0.70 * bt : -0.14 + 0.56 * bt;
    }
    var groundY = cy + profileH - lateral * Math.sin(bankAngle);

    return {
      sampleIdx: bestIdx,
      dist: dist,
      t: dist / Math.max(1, this.totalLength),
      centerPos: { x: cx, y: cy, z: cz },
      groundY: groundY,
      lateral: lateral,
      halfWidth: halfW,
      offRoad: Math.max(0, normLat - 1.0),
      surfaceId: s0.surfaceId,
      slope: slope,
      bankAngle: bankAngle,
      tangent: s0.horizTan,
      right: s0.right
    };
  };

  G.TrackInstance = TrackInstance;
})(window.GroupBRally);
