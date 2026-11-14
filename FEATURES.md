# FEATURES & IMPLEMENTATION LOG

Comprehensive log of all systems, gameplay mechanics, visual assets, audio engines, and architectural features implemented in **APEX Group B Rally**.

---

## 1. Vehicles & Drivetrains

Four iconic Group B rally machines engineered with authentic specifications, distinct 3D visual models, custom liveries, and individualized physics profiles:

### 1. Bergmeister Q85 S1 (Audi Sport Quattro S1 E2 Inspired)
- **Drivetrain**: Longitudinal Front-Engine AWD (`42% Front / 58% Rear` torque split).
- **Specs**: 540 HP, 590 Nm torque, 1,090 kg, 2.24m wheelbase, 1.62m track width, 8,200 RPM redline.
- **Induction**: 5-cylinder turbo with aggressive spool (2.1 bar peak boost) and distinct 5-cylinder audio synthesis.
- **3D Model**:
  - Compact 2.24m wheelbase with long overhanging front snout.
  - Aggressive Evo 2 box flares and wide side skirts.
  - Snowplow front chin spoiler with bumper dive canards and recessed front grille.
  - Asymmetric sculpted bonnet bulge housing turbo plumbing.
  - Two-door notched fastback coupe greenhouse with angled C-pillar buttresses.
  - Towering dual-element Pikes Peak rear wing with large vertical endplates.
  - Side-exit high-flow turbo exhaust pipe.

### 2. Lionceau T16 E2 (Peugeot 205 Turbo 16 Evo 2 Inspired)
- **Drivetrain**: Transverse Mid-Engine AWD (`34% Front / 66% Rear` torque split).
- **Specs**: 480 HP, 495 Nm torque, 910 kg, 2.54m wheelbase, 1.58m track width, 8,500 RPM redline.
- **Induction**: 4-cylinder high-revving turbo (1.9 bar peak boost) with fast throttle response.
- **3D Model**:
  - Compact 3.82m hatchback body with wheels pushed out to corners (2.54m wheelbase).
  - Twin vertical aerodynamic front fender fences/strakes visible from cockpit.
  - Giant rear-quarter turbo intercooler side air pods behind the doors.
  - Central roof periscope air intake.
  - Upright Group B hatchback greenhouse with louvered rear window.
  - Massive high-mount Evo 2 roof bi-plane rear wing.

### 3. Veltro 037 Corsa (Lancia 037 Corsa Inspired)
- **Drivetrain**: Longitudinal Mid-Engine RWD (`100% Rear` power delivery).
- **Specs**: 350 HP, 365 Nm torque, 960 kg, 2.44m wheelbase, 1.54m track width, 8,400 RPM redline.
- **Induction**: Supercharged Volumex with zero turbo lag (instant off-idle power delivery).
- **3D Model**:
  - Ultra-low Pininfarina Berlinetta wedge silhouette with 0.34m wheels and narrow track.
  - Signature twin longitudinal front hood humps.
  - Low roofline with rear flying fastback buttresses bridging a louvered engine lid.
  - Arched rear decklid spoiler.
  - Open bumperless rear exposing the tubular chassis frame, transaxle, and twin shotgun exhausts.
  - Gold rally wheels matching Italian tarmac heritage.

### 4. Fulmine S4 Twin (Lancia Delta S4 Inspired)
- **Drivetrain**: Mid-Engine Twincharged AWD (`30% Front / 70% Rear` torque split).
- **Specs**: 560 HP, 545 Nm torque, 890 kg, 2.44m wheelbase, 1.60m track width, 8,800 RPM redline.
- **Induction**: Twincharged (Roots supercharger for immediate low-end boost + large turbocharger for high-end thrust, 2.3 bar peak boost).
- **3D Model**:
  - Lightweight Kevlar/composite angular spaceframe silhouette with dark rocker sills.
  - Dual-ducted clamshell front bonnet.
  - Tall roof cold-air ram scoop.
  - Giant boxy rear-quarter side pods feeding both the supercharger and turbo intercoolers.
  - Exposed rear crash frame with twin titanium megaphone exhausts.
  - White aerodynamic brake-cooling turbofan wheel covers on front axle.

---

## 2. Cockpit Simulation (1st-Person POV)

Full 3D interior driver cockpit rig with animated elements and zero HUD dependency:
- **Visual Realism**:
  - Distinct hood geometry, pitch, cowl height, and aerodynamic strakes tailored per car.
  - Flocked rally dashboard, full steel roll cage, sun-strip visor banner, and side mirrors.
  - Dynamic interior cabin bounce lighting on High graphics preset.
- **Animated Driver & Co-Pilot**:
  - Rotating three-spoke rally steering wheel with top-dead-center yellow alignment tape.
  - Driver gloved hands mapped to steering input.
  - Fully modeled 3D co-pilot in the right bucket seat with team racing suit and helmet.
  - Co-pilot reacts to G-forces (leans into turns, bounces on jumps and hard landings).
  - Co-pilot holds a physical pacenotes binder and glances down to read or points forward when calling hazards.
- **In-Dash Analog Gauges**:
  - Analog tachometer with dynamic redline arc (adapted up to 10k RPM on the S4) and shift indicator LED.
  - Digital center readout showing current gear, speed (KM/H or MPH), and drivetrain/induction badges.
  - Boost pressure bar (calibrated for Turbo, Supercharger, or Twincharged setups).
  - Real-time tire temperature and tire wear telemetry.
- **Physical 3D Center Console Screen**:
  - Not an overlay: a physical CRT/LCD display mounted inside the car cabin.
  - Real-time GPS route map rendered on an internal CanvasTexture.
  - Colored route line showing actual surface transitions (gravel, tarmac, snow, mud, water).
  - Live vehicle indicator pin, split markers (S1, S2), finish pin, and upcoming corner target ring.
- **Dynamic Windshield System**:
  - Dual windshield wiper arms with continuous or manual toggle.
  - Water droplets and splash effects that accumulate during rain or water crossing and get swept clean by the wipers.

---

## 3. Physics & Handling Model

- **120 Hz Fixed Substepping**:
  - Fixed-interval physics simulation decoupled from display refresh rates for stable collision, suspension, and tire calculations.
- **Tire Traction & Slip Dynamics**:
  - Non-linear lateral slip curve tuned for progressive, controllable four-wheel drifts.
  - Dynamic weight transfer: longitudinal pitch under braking/acceleration and lateral roll under cornering.
  - Handbrake modeling: instantly breaks rear tire adhesion while applying braking torque for tight hairpin Scandinavian flicks.
- **Surface Friction Matrix**:
  - **Gravel (`0.94` grip)**: Balanced rally baseline with forgiving slide angles and dust trails.
  - **Loose Dirt (`0.80` grip)**: Lower adhesion, requiring early turn-in and throttle modulation.
  - **Mud (`0.60` grip)**: Significant rolling resistance and low traction.
  - **Water Splash / Puddles (`0.48` grip)**: High drag deceleration and aquaplaning hazard.
  - **Timber Bridges (`0.86` grip)**: Narrow planks with distinct vibration chatter.
  - **Packed Snow (`0.80` grip)**: Smooth winter drifting with reduced braking efficiency.
  - **Slush (`0.62` grip)**: Heavy drag and slick slush banks.
  - **Black Ice (`0.42` grip)**: Severe low-friction hazard requiring delicate inputs.
  - **Dry Tarmac (`1.16` grip)**: High grip, sharp turn-in, and fast cornering speeds.
  - **Wet Tarmac (`0.78` grip)**: Slick asphalt with lower lateral grip and water sheen.
- **Tire Compound Selection**:
  - Gravel Soft (M+S), Tarmac Hard, and Snow Studded compounds affecting grip coefficients, peak slip angle, and temperature buildup.

---

## 4. Graphics & Visual Pipeline

- **ReShade Ultra Post-Processing (`HIGH` Preset)**:
  - Custom zero-dependency WebGL post-processing pass (`src/reshade.js`).
  - MSAA `WebGLRenderTarget` using `HalfFloatType` (or fallback).
  - 5-tap LumaSharpen for crisp micro-textures.
  - 9-tap Bloom & Halation for light bleed and specular glare.
  - ACES Filmic tone mapping for cinematic exposure range.
  - Warm-highlight / cool-shadow split-tone color grading.
  - Subtle vibrance and optical vignette.
- **Remade Dynamic Lighting & Atmosphere**:
  - Real-time car-tracking directional sun shadows (frustum locked to vehicle position, texel-snapped to prevent shadow swimming).
  - High-resolution shadow maps (up to 4096px).
  - Volumetric atmospheric sky dome with solar disc, Mie corona scattering, and wispy clouds.
  - Secondary horizon bounce directional fill light.
  - Multi-source service park garage lighting with key spotlights and floor reflections.
- **Procedural High-Resolution Textures (`1024x1024` on High)**:
  - Multi-layer procedural road textures with asphalt aggregate, weathering cracks, rain puddles, and snow grain.
  - 16x anisotropic filtering.
  - Linear bump maps for surface depth on gravel, tarmac, wet tarmac, snow, and ice.
  - Wet tarmac specular roughness maps for mirror-like water puddles.

---

## 5. Stages & Biomes

- **Ouninpohja Pine Run (Finland)**: Fast flowing pine forest roads, high-speed jumps, loose gravel, and timber creek bridge.
- **Rainforest Crests (Pacific / Tropics)**: Jungle dirt track with heavy mud ruts, mist rain, and tight hairpins.
- **Kallio Snow Ridge (Sweden / Arctic)**: High-altitude snowbanks, slush zones, and glazed black ice.
- **Col de Turini Pass (Monte Carlo)**: Technical mountain tarmac switchbacks.
- **Storm Hairpins (Alpine Pass)**: Heavy rain, wet tarmac, standing water puddles, and low-friction hairpins.

---

## 6. Procedural Web Audio Engine

- Fully synthesized via Web Audio API without external audio files:
  - **EngineRev**: Harmonic oscillators shaped by cylinder count (4-cyl vs 5-cyl) and RPM.
  - **TurboWhine**: Bandpass noise tracking boost pressure.
  - **SuperchargerWhine**: High-pitch scream tracking engine RPM on supercharged vehicles.
  - **BlowOff**: Exponentially decaying flutter noise on sudden throttle lift.
  - **TireSlip**: Frequency-filtered noise mapped to surface type and lateral slip velocity.
  - **SurfaceRumble**: Sub-bass rumble modulated by road bump frequency and vehicle speed.
  - **WaterSpray & Splash**: Noise burst when hitting puddles or driving in mist rain.
  - **Co-Pilot Radio Calls**: Tone-based rally radio beeps and synthesized vocal callouts.

---

## 7. Architecture & Code Structure

- **`src/core.js`**: Central engine orchestrator:
  - `G.StageEngine`: Unified race lifecycle, fixed-substep physics, camera math, and telemetry.
  - `G.GarageShowcase`: Shared 3D garage scene, plinth rotation, and lighting.
  - `G.disposeHierarchy`: Automated WebGL buffer/texture disposal preventing memory leaks.
  - Shared math, JSON storage, touch binding, and SVG icon generators.
- **`src/main.js`**: Desktop PC UI and keyboard/mouse input adapter.
- **`src/mobile.js`**: Mobile/touch UI, on-screen pedals/steering pads, and iOS gyroscope tilt controller.
- **`src/reshade.js`**: Fullscreen post-processing pipeline and volumetric sky dome mesh.
- **`src/textures.js`**: Procedural canvas texture generators (roads, bump maps, roughness maps, ground, liveries, banners).
- **`src/tracks.js`**: Procedural 3D track mesh generation, terrain skirts, roadside props (trees, rocks, stakes), and particle systems.
- **`src/carVisuals.js`**: Detailed 3D exterior car models and interactive 1st-person cockpit rigs.
- **`src/physics.js`**: Vehicle dynamics, suspension, tire traction, and drivetrain simulations.
- **`src/audio.js`**: Real-time Web Audio synthesis.
- **`src/data.js`**: Vehicle definitions, tire compounds, surface friction matrix, and stage waypoints.
