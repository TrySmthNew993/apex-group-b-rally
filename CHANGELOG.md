# CHANGELOG

All notable changes to the APEX Group B Rally project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.6.1] - 2026-11-14

### Added
- **Mobile Cockpit Camera FOV Slider (`mobile.html`, `src/mobile.js`)**:
  - Added `#m-fov` (`56°`–`96°`, default `74°`) to Mobile Settings, matching Desktop's `#set-fov` (`56°`–`86°`, default `68°`), with live camera projection updates and localStorage persistence.

---

## [1.6.0] - 2026-11-14

### Added
- **Dynamic Weather System & Surface-Dependent Grip Modifiers (`src/data.js`, `src/physics.js`, `src/tracks.js`, `src/carVisuals.js`, `src/core.js`)**:
  - Added selectable weather conditions (`AUTO` stage default, `CLEAR SKY`, `OVERCAST`, `RAIN`, `SNOWFALL`, `HEAVY STORM`) in both Desktop (`#set-weather`) and Mobile (`#m-weather`) settings.
  - Primary tire traction remains governed by the active road surface (`tarmac`, `wet_tarmac`, `gravel`, `mud`, `snow`, `ice`), reduced by a small weather-specific percentage (`0%` Clear, `-2%` Overcast, `-6%` Rain, `-8%` Snowfall, `-10%` Heavy Storm) plus ambient tyre-temperature shifts.
  - Modulated 3D stage fog density, directional sun intensity, precipitation particle count/fall-speed/wind-drift, and continuous windshield raindrop accumulation cleared by the cockpit wipers.

---

## [1.5.0] - 2026-11-14

### Added
- **Unified Engine Core (`src/core.js`)**:
  - `G.StageEngine`: Unified race lifecycle, 120 Hz fixed-timestep physics loop, countdown, camera motion, and pacenote dispatcher.
  - `G.GarageShowcase`: Shared 3D Service Park scene with lighting, turntable, and automatic asset disposal.
  - `G.createRallyRenderer`: Shared Three.js WebGL renderer and ReShade post-processing pipeline setup.
  - Shared math and UI utilities: `G.formatTime`, `G.loadJSON`, `G.saveJSON`, `G.bindTouchPad`, `G.buildTurnSvg`, and mobile detection.
- **Automated WebGL GPU Memory Disposal**:
  - `G.disposeHierarchy`: Recursively disposes geometries, materials, and attached textures with `Set` deduplication across car switching, stage restarts, and menu returns.

### Changed
- Refactored `src/main.js` and `src/mobile.js` into lightweight UI/input adapter layers, eliminating over 1,100 lines of duplicated logic while preserving distinct PC and mobile interfaces.

---

## [1.4.0] - 2026-11-14

### Added
- **Spec-Accurate 3D Exterior Car Models** (`src/carVisuals.js`):
  - **Bergmeister Q85 S1**: 2.24m wheelbase, long front overhang, wide Evo 2 box flares, fastback coupe greenhouse, snowplow front dam, asymmetric hood turbo bulge, and towering rear wing.
  - **Lionceau T16 E2**: 2.54m corner-tucked wheelbase, wedge hatchback profile, vertical front fender strakes, large mid-engine side air pods, roof periscope, and bi-plane rear wing.
  - **Veltro 037 Corsa**: 2.44m wheelbase, low-slung Berlinetta wedge, twin front fender humps, flying rear buttresses, louvered engine deck, gold rally rims, and open bumperless RWD tail with exposed frame and dual exhausts.
  - **Fulmine S4 Twin**: 2.44m wheelbase, composite twin-box spaceframe with Kevlar sills, massive twincharger side air pods, roof ram scoop, white front turbofan wheels, and dual megaphone pipes.
- **Spec-Matched 1st-Person Cockpits & Dashboard Gauges**:
  - Hood length, slope, cowl height, and aerodynamic details tailored per vehicle.
  - Tachometer scaled dynamically to each engine's redline (up to 10,000 RPM on the S4 Twin).
  - Drivetrain badge (`AWD` / `RWD`) and induction type (`TURBO` / `SC` / `TWIN`) displayed on the dashboard.

---

## [1.3.0] - 2026-11-14

### Added
- **ReShade Ultra Post-Processing Pipeline** (`src/reshade.js`):
  - Active on the `HIGH` graphics preset.
  - HDR rendering via MSAA `WebGLRenderTarget` (using `HalfFloatType` or fallback).
  - Fullscreen post-processing shader with 5-tap LumaSharpen, 9-tap Bloom & Halation, ACES Filmic tone mapping, warm/cool split-tone color grading, vibrance, and subtle vignette.
- **Remade Stage & Garage Lighting**:
  - Real-time car-tracking directional sun shadows across the entire stage (texel-snapped with tight 75m frustum and high-resolution shadow map).
  - Volumetric atmospheric sky dome with solar disc, Mie scattering corona, and cloud wisps.
  - Multi-source garage spotlighting, ambient rim lights, and reflective floor surfaces.
- **High-Resolution Procedural Textures** (`src/textures.js`, `src/tracks.js`):
  - 1024x1024 road textures with fine asphalt aggregate, rain puddle specular details, snow frost, and gravel pebbles.
  - 512x512 biome ground terrain textures.
  - Surface bump maps for dirt, tarmac, wet tarmac, snow, and ice.
  - Wet puddle roughness map for realistic water sheen on wet asphalt.
  - 16x anisotropic texture filtering on High quality.

---

## [1.2.0] - 2026-11-14

### Added
- **New Road Surface Physics & Materials**:
  - `tarmac`: High-grip dry asphalt with distinct slate texture and white road edge markings.
  - `wet_tarmac`: Low-roughness slick tarmac with standing water reflections and reduced lateral grip.
  - `snow` & `ice`: Winter surfaces with low friction, slush drag, and snowbanks.
- **Two New Rally Stages**:
  - `alpine_tarmac` ("Col de Turini Pass"): Winding mountain tarmac switchbacks.
  - `wet_tarmac_pass` ("Storm Hairpins"): Rain-soaked mountain pass with sudden puddle hazards.
- **Surface Audio Synthesis**:
  - Surface-specific tire rumble and water spray audio synthesis in `src/audio.js`.
- **Project Documentation**:
  - `README.md` introducing APEX Group B Rally and noting 100% Google Gemini generation.

### Changed
- Fixed mobile landscape layout in `mobile.css` and `mobile.html` without affecting desktop PC styling.

---

## [1.1.0] - 2026-11-14

### Fixed
- **Steering Orientation**: Fixed inverted steering controls so `A`/Left Arrow turns left and `D`/Right Arrow turns right, properly synced with steering wheel animation.
- **Arcade Handling Balance**: Re-tuned lateral slip curves, peak grip, and weight transfer for responsive, forgiving drifting.
- **Cockpit Visibility**: Removed obstructing geometry blocking in-dash digital screens and scaled down the co-pilot seat and model to 0.74 scale for a clear view of the road and instruments.

---

## [1.0.0] - 2026-11-14

### Initial Release
- Core 3D rally game featuring Group B homologation specials.
- Three.js WebGL rendering with procedural track generation (Catmull-Rom splines).
- 1st-person cockpit POV with animated steering wheel, working analog gauges, dynamic track map screen, and co-pilot with pacenotes binder.
- Procedural Web Audio synthesizer (engine revs, turbo spool, blow-off flutter, tire slip).
- Time attack stage timer, split times, and local storage record persistence.
