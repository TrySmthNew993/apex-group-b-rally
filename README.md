# APEX GROUP B // 1986 WRC Rally Simulator

A fully 3D, browser-based 1980s Group B World Rally Championship simulator built with WebGL and Three.js.

> **Note**: This entire project — 3D procedural tracks, cockpit rig, physics engine, audio synthesis, textures, UI/UX, responsive mobile controls, and GitHub deployment — was **100% made by Google Gemini**.

---

## 🎮 Play Live
- **Play Online (PC & Mobile Auto-Detect)**: [https://trysmthnew993.github.io/apex-group-b-rally/](https://trysmthnew993.github.io/apex-group-b-rally/)
- **Mobile Optimized Edition**: [https://trysmthnew993.github.io/apex-group-b-rally/mobile.html](https://trysmthnew993.github.io/apex-group-b-rally/mobile.html)

---

## 🏁 Key Features

### 1. 1st-Person Cockpit POV & Animated Co-Pilot
- Immersive first-person driver viewpoint inside iconic Group B rally cockpits.
- Live animated co-pilot in the right bucket seat with G-force lean, bump reactions, pacenote notebook, and corner gestures.
- Working dashboard analog gauges and in-car physical 3D track-map screen.
- Active windshield wipers and dynamic mud/water droplet splatters.

### 2. Multi-Surface Physics & Real Rally Handling
- Realistic surface transitions with 10 physical terrain types: **Dry Tarmac, Wet Tarmac, Packed Snow, Black Ice, Melted Slush, Deep Mud, Packed Gravel, Loose Dirt, Timber Bridges, and Water Splashes**.
- Selectable driving models:
  - **Arcade (Default)**: High-speed, planted, forgiving handling with easy power slides.
  - **Medium / Low / Pure Sim**: Authentic weight transfer, turbo spool dynamics, lockups, and slip curves.
- Dynamic tyre temperature, wear rates, and compound matching (All-Terrain Gravel, Monsoon Wet, Nordic Studded Snow, Rally Semi-Slick).

### 3. Iconic Group B Machines & 8 Rally Stages
- **Cars**:
  - *Bergmeister Q85 S1* (AWD Turbo 5-Cylinder)
  - *Lionceau T16 Evo 2* (Mid-Engine Turbo AWD)
  - *Veltro 037 Stradale* (Supercharged RWD Lightweight)
  - *Fulmine S4 Competizione* (Twincharged Turbo+Supercharged AWD)
- **8 Stages**:
  - *Ouninpohja Pine Run* (Finland / Black Forest gravel & timber bridge)
  - *Bandama Monsoon* (Ivory Coast / Borneo mud & water splashes)
  - *Col De Turini Whiteout* (Monte Carlo / Sweden snow, ice & alpine tarmac)
  - *Pinevalley Sprint* (Finland Clubman sprint)
  - *Canopy Valley Dash* (Borneo wet tarmac & mud sprint)
  - *Nordic Ridge Sprint* (Sweden snow & ice sprint)
  - *Tour De Corse Asphalt* (France dry mountain tarmac sweepers)
  - *Sanremo Storm Pass* (Italy wet rain-slicked mountain pass)

### 4. Cross-Platform UI
- **PC Controls**: Keyboard (WASD / Arrow Keys, Space for Handbrake, C for Glance, V for Wipers, L for Lights).
- **Phone Controls**: Dedicated on-screen multi-touch steering pads, pedals, handbrake, and optional gyroscope tilt steering.
- Auto-detects device type with manual toggle in settings.

---

## 🛠️ Tech Stack
- **Three.js** (WebGL 3D Rendering)
- **Web Audio API** (Procedural engine audio, turbo flutter, tyre squeal, and surface noise synthesis)
- **Web Speech API** (Co-pilot voice calls)
- **HTML5 Canvas** (Procedural track textures, live cockpit screens, and dashboard gauges)
- **Vanilla JavaScript & CSS** (Zero build steps, 100% static hosting on GitHub Pages)

---

## 📜 License
MIT License. Created by Gemini for educational and showcase purposes.
