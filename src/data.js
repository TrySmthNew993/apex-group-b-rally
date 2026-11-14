/**
 * Group B WRC Rally — Core Game Data
 * Cars, Tyre Compounds, Surface Friction Matrix, and Rally Stages.
 */
window.GroupBRally = window.GroupBRally || {};

(function (G) {
  'use strict';

  /**
   * Surface physical properties:
   * - label: shown on dashboard & radio road-status alerts
   * - baseGrip: global surface traction baseline
   * - rollingDrag: extra deceleration from soft ground (mud, snow, puddle)
   * - bumpAmp: vertical micro-roughness amplitude (meters)
   * - bumpFreq: spatial frequency of surface chatter
   * - splash / dust / snow: particle hints
   */
  G.SURFACES = {
    gravel: {
      id: 'gravel',
      label: 'PACKED GRAVEL',
      shortLabel: 'GRAVEL',
      color: '#c9a66b',
      badgeClass: 'status-warn',
      baseGrip: 0.94,
      rollingDrag: 0.018,
      bumpAmp: 0.025,
      bumpFreq: 1.9,
      particleType: 'dust',
      particleColor: 0xc2ab84
    },
    dirt: {
      id: 'dirt',
      label: 'LOOSE DIRT',
      shortLabel: 'LOOSE',
      color: '#d4874b',
      badgeClass: 'status-warn',
      baseGrip: 0.80,
      rollingDrag: 0.028,
      bumpAmp: 0.036,
      bumpFreq: 2.3,
      particleType: 'dust',
      particleColor: 0xa66b3f
    },
    mud: {
      id: 'mud',
      label: 'DEEP WET MUD',
      shortLabel: 'MUD!',
      color: '#8c5332',
      badgeClass: 'status-danger',
      baseGrip: 0.60,
      rollingDrag: 0.062,
      bumpAmp: 0.042,
      bumpFreq: 1.4,
      particleType: 'mud',
      particleColor: 0x4d311d
    },
    puddle: {
      id: 'puddle',
      label: 'WATER SPLASH',
      shortLabel: 'WATER!',
      color: '#38bdf8',
      badgeClass: 'status-ice',
      baseGrip: 0.48,
      rollingDrag: 0.095,
      bumpAmp: 0.02,
      bumpFreq: 1.0,
      particleType: 'water',
      particleColor: 0xd9f2ff
    },
    wood: {
      id: 'wood',
      label: 'TIMBER BRIDGE',
      shortLabel: 'BRIDGE',
      color: '#a17a4d',
      badgeClass: 'status-warn',
      baseGrip: 0.86,
      rollingDrag: 0.012,
      bumpAmp: 0.028,
      bumpFreq: 6.5,
      particleType: 'none',
      particleColor: 0x998060
    },
    snow: {
      id: 'snow',
      label: 'PACKED SNOW',
      shortLabel: 'SNOW',
      color: '#e2e8f0',
      badgeClass: 'status-ok',
      baseGrip: 0.80,
      rollingDrag: 0.028,
      bumpAmp: 0.018,
      bumpFreq: 1.5,
      particleType: 'snow',
      particleColor: 0xf4f8ff
    },
    slush: {
      id: 'slush',
      label: 'MELTED SLUSH',
      shortLabel: 'SLUSH!',
      color: '#94a3b8',
      badgeClass: 'status-warn',
      baseGrip: 0.62,
      rollingDrag: 0.056,
      bumpAmp: 0.026,
      bumpFreq: 1.8,
      particleType: 'water',
      particleColor: 0xcbd5e1
    },
    ice: {
      id: 'ice',
      label: 'BLACK ICE!',
      shortLabel: 'ICE!!',
      color: '#67e8f9',
      badgeClass: 'status-ice',
      baseGrip: 0.42,
      rollingDrag: 0.008,
      bumpAmp: 0.006,
      bumpFreq: 1.2,
      particleType: 'snow',
      particleColor: 0xdff6ff
    },
    tarmac: {
      id: 'tarmac',
      label: 'DRY TARMAC',
      shortLabel: 'TARMAC',
      color: '#94a3b8',
      badgeClass: 'status-ok',
      baseGrip: 1.16,
      rollingDrag: 0.008,
      bumpAmp: 0.006,
      bumpFreq: 2.0,
      particleType: 'none',
      particleColor: 0xd1d5db
    },
    wet_tarmac: {
      id: 'wet_tarmac',
      label: 'WET TARMAC',
      shortLabel: 'WET TARMAC',
      color: '#38bdf8',
      badgeClass: 'status-warn',
      baseGrip: 0.78,
      rollingDrag: 0.016,
      bumpAmp: 0.008,
      bumpFreq: 1.7,
      particleType: 'water',
      particleColor: 0xcce8ff
    }
  };

  /**
   * Selectable Tyre Compounds that physically alter grip, slip angle curve,
   * steering snap, rolling resistance, temperature buildup, and wear.
   */
  G.TYRES = [
    {
      id: 'gravel_soft',
      name: 'GRAVEL ALL-TERRAIN',
      tag: 'M+S RALLY',
      description: 'Versatile reinforced tread for forest gravel, loose dirt & crests. Progressive drift angle.',
      sidewallColor: '#e5a93c',
      slipPeak: 0.27, // radians (~15.5 deg) - broad forgiving gravel slide window
      turnInSharpness: 0.92,
      wearRate: 0.0018,
      optimalTemp: 82,
      surfaceGrip: {
        gravel: 1.08,
        dirt: 1.04,
        mud: 0.80,
        puddle: 0.70,
        wood: 0.95,
        snow: 0.72,
        slush: 0.76,
        ice: 0.45,
        tarmac: 0.94,
        wet_tarmac: 0.90
      }
    },
    {
      id: 'mud_wet',
      name: 'MONSOON DEEP-MUD',
      tag: 'WET / CLAY',
      description: 'Tall self-cleaning blocks cut through thick mud, wet tarmac & standing water; softer sidewall flex.',
      sidewallColor: '#38bdf8',
      slipPeak: 0.31, // ~17.8 deg
      turnInSharpness: 0.84,
      wearRate: 0.0024,
      optimalTemp: 72,
      surfaceGrip: {
        gravel: 0.94,
        dirt: 1.05,
        mud: 1.24,
        puddle: 1.18,
        wood: 0.90,
        snow: 0.82,
        slush: 1.10,
        ice: 0.50,
        tarmac: 0.84,
        wet_tarmac: 1.16
      }
    },
    {
      id: 'studded_snow',
      name: 'NORDIC 4MM STUDDED',
      tag: 'SNOW / ICE',
      description: 'Tungsten studs bite deeply into packed snow & black ice. Skittish & wears fast on gravel or tarmac.',
      sidewallColor: '#7dd3fc',
      slipPeak: 0.25,
      turnInSharpness: 0.90,
      wearRate: 0.0020,
      optimalTemp: 62,
      surfaceGrip: {
        gravel: 0.78,
        dirt: 0.74,
        mud: 0.68,
        puddle: 0.66,
        wood: 0.75,
        snow: 1.24,
        slush: 1.06,
        ice: 1.55,
        tarmac: 0.72,
        wet_tarmac: 0.68
      }
    },
    {
      id: 'tarmac_hard',
      name: 'RALLY SEMI-SLICK',
      tag: 'HARD COMPOUND',
      description: 'Razor-sharp steering on dry tarmac, minimal slip margin. Slick on wet tarmac; deadly on mud, snow, or ice.',
      sidewallColor: '#ef4444',
      slipPeak: 0.16, // ~9 deg - snappy, unforgiving breakaway
      turnInSharpness: 1.16,
      wearRate: 0.0016,
      optimalTemp: 92,
      surfaceGrip: {
        gravel: 0.82,
        dirt: 0.72,
        mud: 0.45,
        puddle: 0.42,
        wood: 1.06,
        snow: 0.42,
        slush: 0.48,
        ice: 0.30,
        tarmac: 1.24,
        wet_tarmac: 0.74
      }
    }
  ];

  /**
   * 4 Iconic 1980s Group B Rally Machines
   */
  G.CARS = [
    {
      id: 'bergmeister_q85',
      name: 'BERGMEISTER Q85 S1',
      era: '1985 • GROUP B EVO 2',
      drivetrain: 'AWD',
      torqueSplit: [0.42, 0.58], // front / rear power split
      massKg: 1090,
      frontWeightBias: 0.56, // heavy nose -> slight entry push, brutal exit grip
      wheelbase: 2.24,
      trackWidth: 1.62,
      powerHp: 540,
      peakTorqueNm: 590,
      induction: 'TURBO',
      maxBoostBar: 2.1,
      turboSpool: 2.5,
      redlineRpm: 8200,
      idleRpm: 1250,
      gearRatios: [3.28, 2.24, 1.64, 1.24, 0.96],
      finalDrive: 4.45,
      maxSteerAngle: 0.60,
      steerSpeed: 5.2,
      suspStiffness: 43000,
      suspDamping: 4300,
      suspTravel: 0.26,
      recommendedTyre: 'gravel_soft',
      bodyColor: '#f1efe7',
      accentPrimary: '#d42027',
      accentSecondary: '#f3b718',
      accentTertiary: '#262626',
      cageColor: '#2c2f33',
      dashColor: '#1b1d20',
      hoodStyle: 'quattro',
      copilotSuit: '#eceae4',
      copilotHelmet: '#f8fafc',
      audio: { cylinders: 5, baseFreq: 45, supercharger: 0.0, turboWhine: 1.0, flutter: 1.0 },
      summary: 'Heavy front-biased 5-cylinder turbo monster. Tremendous straight-line traction with classic turbo lag & Scandinavian-flick entry.',
      stats: { power: 92, weight: 46, handling: 76, grip: 88 }
    },
    {
      id: 'lionceau_t16',
      name: 'LIONCEAU T16 E2',
      era: '1985 • MID-ENGINE AWD',
      drivetrain: 'AWD',
      torqueSplit: [0.34, 0.66],
      massKg: 910,
      frontWeightBias: 0.43, // nimble mid-engine balance
      wheelbase: 2.54,
      trackWidth: 1.58,
      powerHp: 480,
      peakTorqueNm: 495,
      induction: 'TURBO',
      maxBoostBar: 1.9,
      turboSpool: 3.2,
      redlineRpm: 8500,
      idleRpm: 1300,
      gearRatios: [3.35, 2.30, 1.68, 1.26, 0.95],
      finalDrive: 4.55,
      maxSteerAngle: 0.66,
      steerSpeed: 6.7,
      suspStiffness: 38000,
      suspDamping: 3900,
      suspTravel: 0.28,
      recommendedTyre: 'gravel_soft',
      bodyColor: '#f3f5f8',
      accentPrimary: '#1d4ed8',
      accentSecondary: '#ef4444',
      accentTertiary: '#eab308',
      cageColor: '#28364a',
      dashColor: '#191c22',
      hoodStyle: 't16',
      copilotSuit: '#1e3a8a',
      copilotHelmet: '#f1f5f9',
      audio: { cylinders: 4, baseFreq: 52, supercharger: 0.0, turboWhine: 0.85, flutter: 0.9 },
      summary: 'Featherweight mid-engine AWD French icon. Darts into tight hairpins instantly and rotates cleanly on lift-off.',
      stats: { power: 82, weight: 88, handling: 94, grip: 86 }
    },
    {
      id: 'veltro_037',
      name: 'VELTRO 037 CORSA',
      era: '1983 • SUPERCHARGED RWD',
      drivetrain: 'RWD',
      torqueSplit: [0.0, 1.0],
      massKg: 960,
      frontWeightBias: 0.42,
      wheelbase: 2.44,
      trackWidth: 1.54,
      powerHp: 350,
      peakTorqueNm: 365,
      induction: 'SUPERCHARGER',
      maxBoostBar: 1.1,
      turboSpool: 16.0,
      redlineRpm: 8400,
      idleRpm: 1200,
      gearRatios: [3.20, 2.22, 1.62, 1.24, 0.97],
      finalDrive: 4.35,
      maxSteerAngle: 0.68,
      steerSpeed: 6.4,
      suspStiffness: 36000,
      suspDamping: 3600,
      suspTravel: 0.25,
      recommendedTyre: 'tarmac_hard',
      bodyColor: '#c92228',
      accentPrimary: '#f7f5f0',
      accentSecondary: '#0f2c67',
      accentTertiary: '#eab308',
      cageColor: '#8f1d22',
      dashColor: '#1e1b1b',
      hoodStyle: 'r037',
      copilotSuit: '#b91c1c',
      copilotHelmet: '#fef3c7',
      audio: { cylinders: 4, baseFreq: 56, supercharger: 1.0, turboWhine: 0.0, flutter: 0.0 },
      summary: 'Pure rear-wheel-drive supercharged purist machine. Zero turbo lag—requires delicate throttle & bold countersteer on loose gravel.',
      stats: { power: 68, weight: 78, handling: 88, grip: 64 }
    },
    {
      id: 'fulmine_s4',
      name: 'FULMINE S4 TWIN',
      era: '1986 • TWINCHARGED AWD',
      drivetrain: 'AWD',
      torqueSplit: [0.30, 0.70],
      massKg: 890,
      frontWeightBias: 0.45,
      wheelbase: 2.44,
      trackWidth: 1.60,
      powerHp: 560,
      peakTorqueNm: 545,
      induction: 'TWINCHARGED',
      maxBoostBar: 2.3,
      turboSpool: 5.8,
      redlineRpm: 8800,
      idleRpm: 1350,
      gearRatios: [3.40, 2.34, 1.72, 1.29, 0.96],
      finalDrive: 4.60,
      maxSteerAngle: 0.67,
      steerSpeed: 7.1,
      suspStiffness: 41000,
      suspDamping: 4100,
      suspTravel: 0.27,
      recommendedTyre: 'gravel_soft',
      bodyColor: '#f5f5f2',
      accentPrimary: '#004b93',
      accentSecondary: '#d62328',
      accentTertiary: '#38a7e0',
      cageColor: '#1f2937',
      dashColor: '#14171d',
      hoodStyle: 's4',
      copilotSuit: '#f1f5f9',
      copilotHelmet: '#0284c7',
      audio: { cylinders: 4, baseFreq: 54, supercharger: 0.55, turboWhine: 0.95, flutter: 1.0 },
      summary: '890 kg tubular spaceframe with both supercharger & turbo. Instant low-end snap into ferocious top-end speed. Highest skill ceiling.',
      stats: { power: 98, weight: 95, handling: 92, grip: 84 }
    }
  ];

  /**
   * 3 Distinct Rally Stages across Forest, Jungle, and Snow biomes.
   * Each stage uses smooth 3D Catmull-Rom control points (1 unit = 1m).
   * Surface zones assign authentic changing road conditions along normalized spline t in [0, 1].
   */
  G.TRACKS = [
    {
      id: 'forest',
      name: 'OUNINPOHJA PINE RUN',
      country: 'FINLAND / BLACK FOREST',
      biome: 'forest',
      biomeLabel: 'PINE FOREST',
      description: 'Fast flowing Nordic pine forest roads with banked gravel sweepers, hidden damp mud hollows, big crests, and a narrow timber creek bridge.',
      recommendedTyre: 'gravel_soft',
      defaultWidth: 8.6,
      targetTimes: { gold: 92, silver: 105, bronze: 122 },
      skyTop: 0x3b6ea5,
      skyHorizon: 0xd9c7a3,
      fogColor: 0xc2b69c,
      fogDensity: 0.0026,
      sunColor: 0xffe6b3,
      sunIntensity: 1.25,
      ambientColor: 0x6c7a6b,
      groundColor: '#3e4f2f',
      roadColor: '#a68b60',
      vergeColor: '#4c5c33',
      weatherType: 'dust_motes',
      points: [
        [0, 0, 0],
        [0, 1.0, -85],
        [8, 4.5, -170],
        [35, 1.5, -255],
        [95, 2.0, -325],
        [175, 4.0, -370],
        [255, 9.0, -415],
        [325, 4.0, -475],
        [355, 1.0, -560],
        [335, 0.5, -630],
        [280, 0.0, -645],
        [265, -0.5, -580],
        [215, -1.0, -525],
        [155, -2.0, -555],
        [130, -1.5, -635],
        [160, 0.0, -720],
        [235, 0.2, -775],
        [315, 0.2, -825],
        [395, 3.5, -875],
        [445, 8.5, -955],
        [455, 4.0, -1045],
        [435, 3.0, -1135],
        [475, 2.5, -1215],
        [545, 4.0, -1260],
        [575, 3.5, -1335],
        [520, 2.0, -1395],
        [465, 1.5, -1380],
        [440, 2.5, -1450],
        [485, 5.0, -1535],
        [555, 4.0, -1615],
        [615, 3.0, -1705],
        [645, 2.5, -1800]
      ],
      widthOverrides: [
        { tStart: 0.45, tEnd: 0.52, width: 6.2 }
      ],
      surfaces: [
        { tStart: 0.00, tEnd: 0.21, type: 'gravel' },
        { tStart: 0.21, tEnd: 0.35, type: 'tarmac' },
        { tStart: 0.35, tEnd: 0.45, type: 'mud' },
        { tStart: 0.45, tEnd: 0.52, type: 'wood' },
        { tStart: 0.52, tEnd: 0.72, type: 'gravel' },
        { tStart: 0.72, tEnd: 0.86, type: 'wet_tarmac' },
        { tStart: 0.86, tEnd: 1.00, type: 'gravel' }
      ],
      specialCalls: [
        { t: 0.20, note: 'ONTO TARMAC', status: 'HIGH GRIP' },
        { t: 0.43, note: 'NARROW BRIDGE', status: 'DON\'T CUT!' },
        { t: 0.71, note: 'DAMP ASPHALT', status: 'WET TARMAC!' }
      ]
    },
    {
      id: 'jungle',
      name: 'BANDAMA MONSOON',
      country: 'IVORY COAST / BORNEO',
      biome: 'jungle',
      biomeLabel: 'TROPICAL JUNGLE',
      description: 'Humid red-clay jungle tracks choked by towering palms, deep monsoon mud ruts, flooded creek splashes, and tight twisting hairpins.',
      recommendedTyre: 'mud_wet',
      defaultWidth: 8.0,
      targetTimes: { gold: 88, silver: 102, bronze: 118 },
      skyTop: 0x265955,
      skyHorizon: 0x9fc2a9,
      fogColor: 0x7ea18c,
      fogDensity: 0.0036,
      sunColor: 0xfff3d1,
      sunIntensity: 1.15,
      ambientColor: 0x486b52,
      groundColor: '#274523',
      roadColor: '#9c4e2b',
      vergeColor: '#2e5225',
      weatherType: 'mist_rain',
      points: [
        [0, 0, 0],
        [0, -0.5, -75],
        [-20, -1.5, -155],
        [-75, -3.5, -225],
        [-145, -5.0, -270],
        [-215, -4.5, -315],
        [-245, -3.5, -385],
        [-195, -3.0, -420],
        [-140, -3.5, -395],
        [-110, -4.5, -455],
        [-160, -6.5, -525],
        [-235, -6.5, -570],
        [-305, -4.0, -605],
        [-345, 1.0, -675],
        [-345, 4.5, -755],
        [-295, 5.5, -825],
        [-275, 4.0, -900],
        [-335, 2.5, -955],
        [-365, 1.0, -905],
        [-425, -1.0, -920],
        [-475, -2.0, -990],
        [-475, 0.5, -1075],
        [-420, 4.0, -1140],
        [-370, 6.0, -1115],
        [-365, 7.5, -1195],
        [-415, 7.0, -1285],
        [-480, 5.0, -1360],
        [-535, 3.5, -1440],
        [-555, 2.5, -1530]
      ],
      widthOverrides: [
        { tStart: 0.34, tEnd: 0.42, width: 7.4 },
        { tStart: 0.62, tEnd: 0.70, width: 7.0 }
      ],
      surfaces: [
        { tStart: 0.00, tEnd: 0.18, type: 'wet_tarmac' },
        { tStart: 0.18, tEnd: 0.33, type: 'mud' },
        { tStart: 0.33, tEnd: 0.42, type: 'puddle' },
        { tStart: 0.42, tEnd: 0.61, type: 'dirt' },
        { tStart: 0.61, tEnd: 0.69, type: 'puddle' },
        { tStart: 0.69, tEnd: 0.85, type: 'wet_tarmac' },
        { tStart: 0.85, tEnd: 1.00, type: 'mud' }
      ],
      specialCalls: [
        { t: 0.17, note: 'OFF TARMAC TO MUD', status: 'SLIPPERY!' },
        { t: 0.31, note: 'WATERSPLASH', status: 'DEEP PUDDLE!' },
        { t: 0.68, note: 'WET ASPHALT CLIMB', status: 'SLICK TARMAC!' }
      ]
    },
    {
      id: 'snow',
      name: 'COL DE TURINI WHITEOUT',
      country: 'MONTE CARLO / SWEDEN',
      biome: 'snow',
      biomeLabel: 'ALPINE SNOW & ICE',
      description: 'Treacherous high-altitude winter mountain pass mixing packed snow, wet alpine tarmac switchbacks, slushy valleys, and lethal black ice.',
      recommendedTyre: 'studded_snow',
      defaultWidth: 8.4,
      targetTimes: { gold: 90, silver: 104, bronze: 120 },
      skyTop: 0x6284a8,
      skyHorizon: 0xdce7f2,
      fogColor: 0xcbd8e6,
      fogDensity: 0.0029,
      sunColor: 0xeef6ff,
      sunIntensity: 1.15,
      ambientColor: 0x8ea4bd,
      groundColor: '#dde6ef',
      roadColor: '#cbd5e1',
      vergeColor: '#eef4fa',
      weatherType: 'snowfall',
      points: [
        [0, 0, 0],
        [0, 2.0, -85],
        [25, 5.5, -170],
        [85, 9.0, -245],
        [160, 12.0, -310],
        [225, 14.5, -385],
        [240, 16.0, -460],
        [175, 17.5, -475],
        [115, 19.0, -445],
        [80, 20.5, -505],
        [135, 22.5, -550],
        [225, 25.0, -565],
        [325, 27.5, -590],
        [405, 23.0, -645],
        [445, 16.5, -730],
        [440, 11.5, -820],
        [390, 8.5, -895],
        [340, 7.0, -965],
        [365, 5.5, -1045],
        [440, 4.5, -1095],
        [495, 3.5, -1165],
        [480, 2.5, -1245],
        [415, 1.5, -1240],
        [385, 1.5, -1310],
        [420, 2.0, -1400],
        [475, 2.5, -1490],
        [525, 2.5, -1585]
      ],
      widthOverrides: [
        { tStart: 0.25, tEnd: 0.36, width: 7.4 }
      ],
      surfaces: [
        { tStart: 0.00, tEnd: 0.18, type: 'wet_tarmac' },
        { tStart: 0.18, tEnd: 0.34, type: 'ice' },
        { tStart: 0.34, tEnd: 0.54, type: 'snow' },
        { tStart: 0.54, tEnd: 0.67, type: 'slush' },
        { tStart: 0.67, tEnd: 0.82, type: 'ice' },
        { tStart: 0.82, tEnd: 1.00, type: 'snow' }
      ],
      specialCalls: [
        { t: 0.17, note: 'HAIRPINS ON ICE', status: 'BLACK ICE!' },
        { t: 0.35, note: 'PACKED SNOW', status: 'SNOW COVER' },
        { t: 0.66, note: 'ICY CHICANE', status: 'BLACK ICE!' }
      ]
    },
    {
      id: 'forest_sprint',
      name: 'PINEVALLEY SPRINT',
      country: 'FINLAND • SIMPLE',
      biome: 'forest',
      biomeLabel: 'FOREST (SIMPLE)',
      description: 'Wide, fast-flowing clubman stage mixing grippy dry tarmac with packed forest gravel across 3 clean grade 1–3 turns.',
      recommendedTyre: 'gravel_soft',
      defaultWidth: 10.0,
      targetTimes: { gold: 52, silver: 62, bronze: 74 },
      skyTop: 0x3b6ea5,
      skyHorizon: 0xd9c7a3,
      fogColor: 0xc2b69c,
      fogDensity: 0.0022,
      sunColor: 0xffe6b3,
      sunIntensity: 1.25,
      ambientColor: 0x6c7a6b,
      groundColor: '#3e4f2f',
      roadColor: '#a68b60',
      vergeColor: '#4c5c33',
      weatherType: 'dust_motes',
      points: [
        [0, 0, 0],
        [0, 0.5, -100],
        [0, 1.5, -210],
        [20, 2.5, -315],
        [80, 3.0, -400],
        [175, 2.5, -455],
        [280, 2.0, -490],
        [380, 3.0, -525],
        [455, 3.5, -595],
        [490, 2.5, -695],
        [475, 1.5, -800],
        [445, 1.5, -905],
        [460, 2.0, -1010],
        [515, 2.5, -1110],
        [580, 2.5, -1205]
      ],
      widthOverrides: [],
      surfaces: [
        { tStart: 0.00, tEnd: 0.38, type: 'gravel' },
        { tStart: 0.38, tEnd: 0.72, type: 'tarmac' },
        { tStart: 0.72, tEnd: 1.00, type: 'gravel' }
      ],
      specialCalls: [
        { t: 0.37, note: 'TARMAC SECTION', status: 'HIGH GRIP' }
      ]
    },
    {
      id: 'jungle_dash',
      name: 'CANOPY VALLEY DASH',
      country: 'BORNEO • SIMPLE',
      biome: 'jungle',
      biomeLabel: 'JUNGLE (SIMPLE)',
      description: 'Wide tropical sprint combining rain-slicked wet tarmac, red-clay dirt, and one shallow creek splash across 3 smooth bends.',
      recommendedTyre: 'mud_wet',
      defaultWidth: 9.6,
      targetTimes: { gold: 54, silver: 64, bronze: 76 },
      skyTop: 0x265955,
      skyHorizon: 0x9fc2a9,
      fogColor: 0x7ea18c,
      fogDensity: 0.0030,
      sunColor: 0xfff3d1,
      sunIntensity: 1.15,
      ambientColor: 0x486b52,
      groundColor: '#274523',
      roadColor: '#9c4e2b',
      vergeColor: '#2e5225',
      weatherType: 'mist_rain',
      points: [
        [0, 0, 0],
        [0, -0.5, -95],
        [-15, -1.5, -195],
        [-70, -2.5, -285],
        [-160, -3.0, -345],
        [-260, -2.5, -385],
        [-350, -1.5, -430],
        [-415, 0.0, -510],
        [-435, 1.0, -610],
        [-405, 1.5, -710],
        [-345, 2.0, -795],
        [-280, 2.0, -880],
        [-245, 2.0, -980],
        [-235, 2.0, -1080]
      ],
      widthOverrides: [],
      surfaces: [
        { tStart: 0.00, tEnd: 0.38, type: 'wet_tarmac' },
        { tStart: 0.38, tEnd: 0.48, type: 'puddle' },
        { tStart: 0.48, tEnd: 0.78, type: 'dirt' },
        { tStart: 0.78, tEnd: 1.00, type: 'wet_tarmac' }
      ],
      specialCalls: [
        { t: 0.37, note: 'WATERSPLASH', status: 'WET TARMAC!' }
      ]
    },
    {
      id: 'snow_ridge',
      name: 'NORDIC RIDGE SPRINT',
      country: 'SWEDEN • SIMPLE',
      biome: 'snow',
      biomeLabel: 'SNOW (SIMPLE)',
      description: 'Wide snow-packed alpine sprint with crisp snowbanks, slushy valley dips, and a cold black-ice sweep—ideal for learning winter drifts.',
      recommendedTyre: 'studded_snow',
      defaultWidth: 9.8,
      targetTimes: { gold: 56, silver: 66, bronze: 78 },
      skyTop: 0x6284a8,
      skyHorizon: 0xdce7f2,
      fogColor: 0xcbd8e6,
      fogDensity: 0.0025,
      sunColor: 0xeef6ff,
      sunIntensity: 1.15,
      ambientColor: 0x8ea4bd,
      groundColor: '#dde6ef',
      roadColor: '#cbd5e1',
      vergeColor: '#eef4fa',
      weatherType: 'snowfall',
      points: [
        [0, 0, 0],
        [0, 1.5, -100],
        [15, 3.5, -205],
        [70, 5.5, -295],
        [155, 7.0, -365],
        [255, 8.0, -415],
        [355, 7.5, -460],
        [435, 6.0, -530],
        [475, 4.0, -625],
        [460, 2.5, -725],
        [410, 1.5, -815],
        [385, 1.5, -915],
        [400, 1.5, -1020],
        [445, 1.5, -1120]
      ],
      widthOverrides: [],
      surfaces: [
        { tStart: 0.00, tEnd: 0.42, type: 'snow' },
        { tStart: 0.42, tEnd: 0.62, type: 'slush' },
        { tStart: 0.62, tEnd: 0.78, type: 'ice' },
        { tStart: 0.78, tEnd: 1.00, type: 'snow' }
      ],
      specialCalls: [
        { t: 0.41, note: 'SLUSH VALLEY', status: 'KEEP SMOOTH' },
        { t: 0.61, note: 'ICY SWEEP', status: 'BLACK ICE!' }
      ]
    },
    {
      id: 'alpine_tarmac',
      name: 'TOUR DE CORSE ASPHALT',
      country: 'FRANCE • TARMAC',
      biome: 'tarmac',
      biomeLabel: 'DRY TARMAC',
      description: 'Pure high-grip mountain asphalt ribbons with crisp road markings, fast elevation sweepers, and flat-out Group B tarmac hairpins.',
      recommendedTyre: 'tarmac_hard',
      defaultWidth: 8.8,
      targetTimes: { gold: 78, silver: 90, bronze: 105 },
      skyTop: 0x2563eb,
      skyHorizon: 0xdbeafe,
      fogColor: 0xcbd5e1,
      fogDensity: 0.0018,
      sunColor: 0xfff5db,
      sunIntensity: 1.35,
      ambientColor: 0x738294,
      groundColor: '#4b5b3c',
      roadColor: '#64748b',
      vergeColor: '#566349',
      weatherType: 'clear',
      points: [
        [0, 0, 0],
        [0, 1.0, -90],
        [15, 3.0, -185],
        [65, 6.0, -270],
        [145, 8.5, -335],
        [240, 9.0, -370],
        [335, 7.0, -405],
        [395, 4.5, -475],
        [380, 3.0, -560],
        [315, 2.5, -605],
        [255, 2.0, -575],
        [215, 2.5, -640],
        [245, 4.0, -730],
        [325, 6.5, -805],
        [420, 8.5, -860],
        [510, 7.0, -920],
        [560, 4.0, -1005],
        [530, 2.0, -1095],
        [465, 1.5, -1165],
        [435, 2.0, -1255],
        [465, 3.0, -1350],
        [535, 3.5, -1435]
      ],
      widthOverrides: [],
      surfaces: [
        { tStart: 0.00, tEnd: 1.00, type: 'tarmac' }
      ],
      specialCalls: [
        { t: 0.30, note: 'FAST ASPHALT SWEEPERS', status: 'DRY TARMAC' },
        { t: 0.65, note: 'DOWNHILL CHICANE', status: 'BRAKE LATE!' }
      ]
    },
    {
      id: 'wet_tarmac_pass',
      name: 'SANREMO STORM PASS',
      country: 'ITALY • WET TARMAC',
      biome: 'wet_tarmac',
      biomeLabel: 'WET TARMAC',
      description: 'Rain-lashed mountain tarmac gleaming under storm clouds, with slick wet asphalt, brief dry tunnel relief, and standing drainage splashes.',
      recommendedTyre: 'mud_wet',
      defaultWidth: 8.6,
      targetTimes: { gold: 82, silver: 95, bronze: 112 },
      skyTop: 0x334155,
      skyHorizon: 0x94a3b8,
      fogColor: 0x7c8ea3,
      fogDensity: 0.0032,
      sunColor: 0xdbeafe,
      sunIntensity: 1.05,
      ambientColor: 0x64748b,
      groundColor: '#364438',
      roadColor: '#475569',
      vergeColor: '#3f4f42',
      weatherType: 'mist_rain',
      points: [
        [0, 0, 0],
        [0, 0.5, -85],
        [-20, 2.0, -175],
        [-75, 4.5, -255],
        [-155, 6.5, -315],
        [-245, 6.0, -355],
        [-315, 3.5, -415],
        [-335, 1.5, -500],
        [-295, 1.0, -580],
        [-230, 1.5, -610],
        [-180, 2.0, -570],
        [-155, 2.5, -645],
        [-195, 4.0, -735],
        [-275, 5.5, -805],
        [-365, 5.0, -860],
        [-430, 3.0, -935],
        [-425, 1.5, -1030],
        [-375, 1.0, -1115],
        [-345, 1.5, -1205],
        [-370, 2.0, -1300],
        [-425, 2.5, -1390]
      ],
      widthOverrides: [],
      surfaces: [
        { tStart: 0.00, tEnd: 0.36, type: 'wet_tarmac' },
        { tStart: 0.36, tEnd: 0.44, type: 'puddle' },
        { tStart: 0.44, tEnd: 0.58, type: 'tarmac' },
        { tStart: 0.58, tEnd: 0.80, type: 'wet_tarmac' },
        { tStart: 0.80, tEnd: 0.86, type: 'puddle' },
        { tStart: 0.86, tEnd: 1.00, type: 'wet_tarmac' }
      ],
      specialCalls: [
        { t: 0.35, note: 'STANDING WATER', status: 'WET TARMAC!' },
        { t: 0.44, note: 'GRIPPY DRY PATCH', status: 'TARMAC' },
        { t: 0.79, note: 'STORM DRAINAGE', status: 'WATERSPLASH!' }
      ]
    }
  ];

  G.WEATHER = [
    {
      id: 'clear',
      name: 'CLEAR SKY',
      gripPenalty: 0.0,
      fogMult: 0.85,
      sunMult: 1.08,
      ambientTempOffset: 3,
      particleType: 'clear',
      particleCount: 120,
      fallSpeed: 0.7,
      drift: 0.3,
      rainDropletsRate: 0
    },
    {
      id: 'overcast',
      name: 'OVERCAST',
      gripPenalty: 0.02,
      fogMult: 1.15,
      sunMult: 0.82,
      ambientTempOffset: -2,
      particleType: 'overcast',
      particleCount: 180,
      fallSpeed: 0.9,
      drift: 0.45,
      rainDropletsRate: 0
    },
    {
      id: 'rain',
      name: 'RAIN',
      gripPenalty: 0.06,
      fogMult: 1.38,
      sunMult: 0.68,
      ambientTempOffset: -5,
      particleType: 'rain',
      particleCount: 560,
      fallSpeed: 12.5,
      drift: 0.6,
      rainDropletsRate: 6.5
    },
    {
      id: 'storm',
      name: 'HEAVY STORM',
      gripPenalty: 0.10,
      fogMult: 1.68,
      sunMult: 0.50,
      ambientTempOffset: -7,
      particleType: 'storm',
      particleCount: 820,
      fallSpeed: 16.5,
      drift: 2.2,
      rainDropletsRate: 13.0
    },
    {
      id: 'snow',
      name: 'SNOWFALL',
      gripPenalty: 0.08,
      fogMult: 1.45,
      sunMult: 0.76,
      ambientTempOffset: -10,
      particleType: 'snow',
      particleCount: 700,
      fallSpeed: 4.8,
      drift: 1.8,
      rainDropletsRate: 1.2
    }
  ];

  G.getWeather = function (id, trackDef) {
    var resolvedId = id;
    if (!resolvedId || resolvedId === 'auto') {
      var wt = trackDef && trackDef.weatherType;
      if (wt === 'snowfall') resolvedId = 'snow';
      else if (wt === 'mist_rain') resolvedId = 'rain';
      else if (wt === 'clear') resolvedId = 'clear';
      else resolvedId = 'overcast';
    }
    return G.WEATHER.find(function (w) { return w.id === resolvedId; }) || G.WEATHER[0];
  };

  G.getCar = function (id) {
    return G.CARS.find(function (c) { return c.id === id; }) || G.CARS[0];
  };

  G.getTyre = function (id) {
    return G.TYRES.find(function (t) { return t.id === id; }) || G.TYRES[0];
  };

  G.getTrack = function (id) {
    return G.TRACKS.find(function (tr) { return tr.id === id; }) || G.TRACKS[0];
  };
})(window.GroupBRally);
