/**
 * Procedural Canvas Textures for Roads, Biomes, Signage, and Group B Liveries.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function makeTexture(canvas, repeatX, repeatY, srgb) {
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    if (repeatX !== undefined && repeatY !== undefined) {
      tex.repeat.set(repeatX, repeatY);
    }
    if (srgb) {
      tex.encoding = THREE.sRGBEncoding;
    }
    tex.anisotropy = 4;
    return tex;
  }

  /**
   * Generates a tileable rally road texture.
   * Supports surface modes: 'tarmac', 'wet_tarmac', 'snow', 'ice', 'forest', 'jungle'.
   */
  G.createRoadTexture = function (mode) {
    var w = 512, h = 512;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');

    var isTarmac = mode === 'tarmac';
    var isWetTarmac = mode === 'wet_tarmac';
    var isIce = mode === 'ice';
    var isSnow = mode === 'snow' || isIce;

    var seed = mode === 'forest' ? 1337
      : (mode === 'jungle' ? 4242
      : (isTarmac ? 6101
      : (isWetTarmac ? 7202
      : (isIce ? 8303 : 9001))));
    function rand() {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return ((seed >>> 0) / 4294967296);
    }

    if (isTarmac || isWetTarmac) {
      // Base neutral-slate so vertex tint renders realistic dry/wet asphalt while keeping lines crisp
      ctx.fillStyle = isWetTarmac ? '#8a95a3' : '#b2b9c2';
      ctx.fillRect(0, 0, w, h);

      // Subtle shoulder darkening outside the painted asphalt edges
      var leftGrad = ctx.createLinearGradient(0, 0, w * 0.32, 0);
      leftGrad.addColorStop(0, 'rgba(20,25,30,0.55)');
      leftGrad.addColorStop(1, 'rgba(20,25,30,0.08)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, w * 0.32, h);

      var rightGrad = ctx.createLinearGradient(w * 0.68, 0, w, 0);
      rightGrad.addColorStop(0, 'rgba(20,25,30,0.08)');
      rightGrad.addColorStop(1, 'rgba(20,25,30,0.55)');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(w * 0.68, 0, w * 0.32, h);

      // Subtle dark rubber / water-sheen racing lines
      var trackPositions = [w * 0.42, w * 0.58];
      for (var tp = 0; tp < trackPositions.length; tp++) {
        var tx = trackPositions[tp];
        var tg = ctx.createLinearGradient(tx - 32, 0, tx + 32, 0);
        tg.addColorStop(0, 'rgba(0,0,0,0)');
        tg.addColorStop(0.5, isWetTarmac ? 'rgba(15,28,44,0.46)' : 'rgba(28,32,38,0.28)');
        tg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = tg;
        ctx.fillRect(tx - 32, 0, 64, h);
      }

      // Fine asphalt mineral aggregate speckles
      for (var i = 0; i < 6500; i++) {
        var x = rand() * w;
        var y = rand() * h;
        var sz = 1 + rand() * 2.1;
        var bright = rand() > 0.48;
        ctx.fillStyle = bright
          ? 'rgba(255,255,255,' + (isWetTarmac ? (0.06 + rand() * 0.14) : (0.07 + rand() * 0.12)).toFixed(2) + ')'
          : 'rgba(15,18,22,' + (0.10 + rand() * 0.18).toFixed(2) + ')';
        ctx.fillRect(x, y, sz, sz);
      }

      if (isWetTarmac) {
        // Longitudinal water film & specular rain streaks
        for (var ws = 0; ws < 90; ws++) {
          var wx = w * 0.33 + rand() * w * 0.34;
          var wy = rand() * h;
          var wh = 30 + rand() * 90;
          ctx.fillStyle = rand() > 0.45
            ? 'rgba(186,230,253,' + (0.10 + rand() * 0.16).toFixed(2) + ')'
            : 'rgba(15,23,42,' + (0.14 + rand() * 0.16).toFixed(2) + ')';
          ctx.fillRect(wx, wy, 2 + rand() * 6, wh);
        }
      }

      // Crisp solid white road edge lines right at u=0.333 and u=0.667
      ctx.fillStyle = isWetTarmac ? 'rgba(226,232,240,0.82)' : 'rgba(248,250,252,0.92)';
      ctx.fillRect(w * 0.333 - 4, 0, 8, h);
      ctx.fillRect(w * 0.667 - 4, 0, 8, h);

      // Dashed yellow/white rally centerline (4 dashes per tile so it loops seamlessly)
      ctx.fillStyle = isWetTarmac ? 'rgba(250,204,21,0.72)' : 'rgba(250,204,21,0.88)';
      for (var d = 0; d < 4; d++) {
        ctx.fillRect(w * 0.5 - 3, d * 128 + 16, 6, 72);
      }

      return makeTexture(c, 1, 1, true);
    }

    // Snow / Ice / Dirt / Gravel base
    ctx.fillStyle = isIce ? '#cfe7fb' : (isSnow ? '#edf3fa' : '#d2c9bc');
    ctx.fillRect(0, 0, w, h);

    // Subtle verge shading on far left and right edges
    var leftGrad = ctx.createLinearGradient(0, 0, 80, 0);
    leftGrad.addColorStop(0, isSnow ? 'rgba(110,138,170,0.36)' : 'rgba(30,28,24,0.45)');
    leftGrad.addColorStop(1, 'rgba(30,28,24,0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 80, h);

    var rightGrad = ctx.createLinearGradient(w - 80, 0, w, 0);
    rightGrad.addColorStop(0, 'rgba(30,28,24,0)');
    rightGrad.addColorStop(1, isSnow ? 'rgba(110,138,170,0.36)' : 'rgba(30,28,24,0.45)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(w - 80, 0, 80, h);

    // Twin worn rally tyre tracks inside the road surface (u = 0.33..0.67 is drivable road)
    var rutColor = isIce
      ? 'rgba(56,130,185,0.44)'
      : (isSnow ? 'rgba(85,115,150,0.46)' : 'rgba(48,34,22,0.42)');
    var rutPositions = [w * 0.43, w * 0.57];
    for (var r = 0; r < rutPositions.length; r++) {
      var rx = rutPositions[r];
      var rg = ctx.createLinearGradient(rx - 28, 0, rx + 28, 0);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(0.5, rutColor);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(rx - 28, 0, 56, h);
    }

    // Clear road-edge boundary contrast lines right at u=0.333 and u=0.667
    ctx.fillStyle = isSnow ? 'rgba(255,255,255,0.78)' : 'rgba(245,236,216,0.48)';
    ctx.fillRect(w * 0.33 - 4, 0, 8, h);
    ctx.fillRect(w * 0.67 - 4, 0, 8, h);

    // Center loose crest line
    ctx.fillStyle = isSnow ? 'rgba(255,255,255,0.32)' : 'rgba(255,245,225,0.16)';
    ctx.fillRect(w * 0.45, 0, w * 0.10, h);

    for (var i = 0; i < 4500; i++) {
      var x = rand() * w;
      var y = rand() * h;
      var sz = 1 + rand() * 3.5;
      var light = rand() > 0.5;
      ctx.fillStyle = light
        ? 'rgba(255,255,255,' + (0.08 + rand() * 0.14).toFixed(2) + ')'
        : 'rgba(25,20,16,' + (0.08 + rand() * 0.18).toFixed(2) + ')';
      ctx.fillRect(x, y, sz, sz * (1 + rand() * 1.8));
    }

    if (isIce) {
      // Crystalline ice glaze streaks
      for (var ic = 0; ic < 70; ic++) {
        var ix = w * 0.32 + rand() * w * 0.36;
        var iy = rand() * h;
        ctx.fillStyle = 'rgba(224,242,254,' + (0.16 + rand() * 0.22).toFixed(2) + ')';
        ctx.fillRect(ix, iy, 2 + rand() * 7, 25 + rand() * 75);
      }
    }

    // Subtle longitudinal tread striations inside ruts
    ctx.strokeStyle = isSnow ? 'rgba(95,122,155,0.20)' : 'rgba(40,30,20,0.16)';
    ctx.lineWidth = 2;
    for (var s = 0; s < 40; s++) {
      var sx = (s % 2 === 0 ? w * 0.31 : w * 0.69) + (rand() - 0.5) * 44;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + (rand() - 0.5) * 4, h);
      ctx.stroke();
    }

    return makeTexture(c, 1, 1, true);
  };

  /**
   * Generates biome ground terrain texture
   */
  G.createGroundTexture = function (biome) {
    var w = 256, h = 256;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');

    if (biome === 'forest') {
      ctx.fillStyle = '#364728';
    } else if (biome === 'jungle') {
      ctx.fillStyle = '#223e1f';
    } else if (biome === 'tarmac') {
      ctx.fillStyle = '#475739';
    } else if (biome === 'wet_tarmac') {
      ctx.fillStyle = '#323f35';
    } else {
      ctx.fillStyle = '#dce6f2';
    }
    ctx.fillRect(0, 0, w, h);

    var seed = 777;
    function rand() {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return ((seed >>> 0) / 4294967296);
    }

    for (var i = 0; i < 2400; i++) {
      var x = rand() * w;
      var y = rand() * h;
      var r = 1 + rand() * 4;
      if (biome === 'snow') {
        ctx.fillStyle = rand() > 0.45 ? 'rgba(255,255,255,0.28)' : 'rgba(165,188,212,0.24)';
      } else if (biome === 'jungle') {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(55,105,40,0.32)' : 'rgba(20,38,18,0.35)';
      } else if (biome === 'tarmac' || biome === 'wet_tarmac') {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(92,110,82,0.28)' : 'rgba(38,44,36,0.30)';
      } else {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(84,96,52,0.3)' : 'rgba(42,35,24,0.28)';
      }
      ctx.fillRect(x, y, r, r);
    }

    return makeTexture(c, 120, 120, true);
  };

  /**
   * High-contrast rally corner chevron sign texture ('left' or 'right')
   */
  G.createChevronTexture = function (dir) {
    var w = 256, h = 128;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.fillStyle = '#111827';
    for (var i = 0; i < 3; i++) {
      var cx = 42 + i * 72;
      ctx.beginPath();
      if (dir === 'right') {
        ctx.moveTo(cx - 18, 20);
        ctx.lineTo(cx + 16, 64);
        ctx.lineTo(cx - 18, 108);
        ctx.lineTo(cx + 8, 108);
        ctx.lineTo(cx + 42, 64);
        ctx.lineTo(cx + 8, 20);
      } else {
        ctx.moveTo(cx + 42, 20);
        ctx.lineTo(cx + 8, 64);
        ctx.lineTo(cx + 42, 108);
        ctx.lineTo(cx + 16, 108);
        ctx.lineTo(cx - 18, 64);
        ctx.lineTo(cx + 16, 20);
      }
      ctx.closePath();
      ctx.fill();
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  };

  /**
   * Start / Finish / Sector rally gantry banner texture
   */
  G.createBannerTexture = function (title, subtitle, bgHex, accentHex) {
    var w = 512, h = 128;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');

    ctx.fillStyle = bgHex || '#111827';
    ctx.fillRect(0, 0, w, h);

    // Checkered / rally end caps
    var sq = 16;
    for (var y = 0; y < h; y += sq) {
      for (var x = 0; x < 64; x += sq) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ffffff' : '#111111';
        ctx.fillRect(x, y, sq, sq);
        ctx.fillRect(w - 64 + x, y, sq, sq);
      }
    }

    ctx.fillStyle = accentHex || '#ef4444';
    ctx.fillRect(64, 0, w - 128, 12);
    ctx.fillRect(64, h - 12, w - 128, 12);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, w / 2, h / 2 - 12);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(subtitle, w / 2, h / 2 + 28);

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  };

  /**
   * Car hood livery stripe texture tailored to each Group B car
   */
  G.createHoodLiveryTexture = function (car) {
    var w = 512, h = 512;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');

    ctx.fillStyle = car.bodyColor;
    ctx.fillRect(0, 0, w, h);

    if (car.id === 'bergmeister_q85') {
      // Diagonal Audi-Sport inspired tri-stripes
      ctx.fillStyle = car.accentTertiary;
      ctx.fillRect(72, 0, 42, h);
      ctx.fillStyle = car.accentPrimary;
      ctx.fillRect(114, 0, 42, h);
      ctx.fillStyle = car.accentSecondary;
      ctx.fillRect(156, 0, 24, h);
      // Center rally number plate
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(205, 190, 140, 120);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 6;
      ctx.strokeRect(205, 190, 140, 120);
      ctx.fillStyle = '#111111';
      ctx.font = '900 58px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('02', 275, 272);
    } else if (car.id === 'lionceau_t16') {
      // Peugeot Talbot diagonal multi-stripes
      var stripes = [car.accentPrimary, '#38bdf8', car.accentSecondary, car.accentTertiary];
      for (var i = 0; i < stripes.length; i++) {
        ctx.fillStyle = stripes[i];
        ctx.fillRect(0, 80 + i * 32, w, 28);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(190, 240, 132, 110);
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 6;
      ctx.strokeRect(190, 240, 132, 110);
      ctx.fillStyle = '#111827';
      ctx.font = '900 56px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('05', 256, 316);
    } else if (car.id === 'veltro_037') {
      // Corsa Red + bold Italian twin center stripes
      ctx.fillStyle = car.accentPrimary;
      ctx.fillRect(216, 0, 80, h);
      ctx.fillStyle = car.accentSecondary;
      ctx.fillRect(204, 0, 12, h);
      ctx.fillRect(296, 0, 12, h);
      ctx.fillStyle = car.accentTertiary;
      ctx.fillRect(0, 60, w, 18);
    } else {
      // Martini-inspired Fulmine S4 center & side bands
      ctx.fillStyle = car.accentPrimary;
      ctx.fillRect(190, 0, 132, h);
      ctx.fillStyle = car.accentTertiary;
      ctx.fillRect(210, 0, 92, h);
      ctx.fillStyle = car.accentSecondary;
      ctx.fillRect(232, 0, 48, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(190, 220, 132, 95);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 5;
      ctx.strokeRect(190, 220, 132, 95);
      ctx.fillStyle = '#111827';
      ctx.font = '900 52px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('04', 256, 287);
    }

    // Hood louvre vents painted near windshield base
    ctx.fillStyle = 'rgba(15,15,15,0.75)';
    for (var v = 0; v < 4; v++) {
      ctx.fillRect(95 + v * 22, 390, 14, 48);
      ctx.fillRect(w - 110 - v * 22, 390, 14, 48);
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  };
})(window.GroupBRally);
