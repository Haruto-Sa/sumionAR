# sumionAR (Hiro Marker + Location-based AR Demo)

This repository contains a minimal setup for two web-based AR experiences:

- **Marker AR** – Renders Duck / Suimon / Wankosoba GLB models on a Hiro marker  
- **Location AR** – Places a 3D model at fixed GPS locations defined in `config/locations.yaml` (using LocAR.js + three.js)

## Minimal Project Layout

```text
ARjs/
├── index.html              # Top page (mode selector + OpenStreetMap of locations)
├── marker-ar.html          # Hiro marker AR
├── location-ar.html        # Location-based AR (LocAR.js)
├── styles.css              # Shared styles
├── public/
│   └── assets/
│       ├── Duck.glb
│       ├── suimon-kousin.glb
│       ├── wankosoba.glb
│       └── markers/
│           └── hiro.png
├── config/
│   ├── locations.yaml      # List of fixed locations (lat/lon, name, icon, color)
│   └── models.yaml         # Model definitions (GLB filenames, reserved for future use)
├── src/
│   ├── location/
│   │   ├── core.ts         # Shared LocAR + three.js scene setup
│   │   └── uiToggle.ts     # UI minimize button logic
│   └── location-ar/
│       └── main.ts         # Main logic for location-based AR
├── server.py               # Optional: Python HTTP server with logging (not required)
├── package.json            # Vite + TypeScript + locar configuration
├── vite.config.mjs         # Vite config (inputs: index/marker-ar/location-ar, base: /sumionAR/)
└── .gitignore              # Ignore doc/manual/, node_modules/, dist/, logs, etc.
```

`.gitignore` (excerpt):

```gitignore
doc/manual/

node_modules/
dist/
*.log
.DS_Store
```

## Setup

### Prerequisites

- Node.js ≥ 18 (LTS recommended)
- npm (bundled with Node.js)

### Install dependencies

```bash
cd /Users/harutosasaki/GithubRepo/ARjs
npm install
```

### Start dev server

```bash
npm run dev
```

Open:

- `http://localhost:8000/` → `index.html` (top page)

Because the app uses camera and geolocation, access it via **HTTPS or localhost**.

### Build for production

```bash
npm run build
```

This generates static files under `dist/`.  
You can deploy `dist/` directly to static hosting (e.g. GitHub Pages at `/sumionAR/`).  
`dist/` itself is ignored by Git via `.gitignore`.

## How to Use

### 1. Hiro Marker AR (`marker-ar.html`)

- From the top page, click the **“Hiro マーカー AR”** card  
  or open `http://localhost:8000/marker-ar.html`
- Click the “開始” (Start) button and allow camera access
- Print or display `public/assets/markers/hiro.png` on another screen
- Point your camera at the Hiro marker

**Features**

- Switch between **Duck / Suimon / Wankosoba** via buttons at the bottom of the screen
- Suimon is rendered at roughly **1/1000** of its original scale on the marker, so it fits nicely

### 2. Location-based AR (`location-ar.html`)

- From the top page, click the **“固定地点 AR（suimon ベース）”** card  
  or open `http://localhost:8000/location-ar.html`
- Allow camera and geolocation access
- Models are placed around the positions defined in `config/locations.yaml`

**Top-right panel (model / location / model adjustment)**

- **Model**: choose Duck / Suimon / Wankosoba, or “auto (per location)”
- **Location**: choose a target from `locations.yaml` (id, name, lat, lon)
- **Model height**: slider (0–100 m, default 1 m)
- **Model size (m)**: numeric input (0.05–100, supports decimals)
- **Model yaw (Y)**: rotation around Y axis in degrees (-180–180)

**Bottom-right panel (status)**

- Current GPS position
- GPS accuracy (m)
- Target location (name + lat/lon)
- Distance to target (m)
- Bearing to target (compass direction + degrees)

**Notes**

- When height/size/yaw changes, the model is removed and re-added to keep LocAR’s internal coordinate system consistent.
- GLBs are loaded once and then cloned from an in-memory cache for fast re-spawn.

## Configuration Files

### `config/locations.yaml`

Defines fixed locations. Example:

```yaml
locations:
  - id: suimon-1
    name: "Suimon #1"
    latitude: 39.80219519075745
    longitude: 141.13317980590008
    icon: "🌊"
    color: "#4e9bff"
  # Add more locations here
```

Whenever you add a location here, it automatically appears in:

- The **location selector** in `location-ar.html`
- The **OpenStreetMap map** at the bottom of `index.html` (Leaflet)

### `config/models.yaml`

Reserved for listing GLB models (Duck, Suimon, Wankosoba, etc.).  
Current logic doesn’t read it directly yet, but it’s useful for managing model metadata and future extensions.

## Top-page Map (OpenStreetMap)

`index.html` shows a simple Leaflet + OpenStreetMap map at the bottom:

- Loads `config/locations.yaml` and places markers
- Each marker popup shows `icon` + `name`
- If at least one location exists, the map auto-fits all markers using `fitBounds`

## License / Intended Use

This repository is intended for experimentation and learning around:

- Hiro marker AR (A-Frame + AR.js)
- Location-based AR in the browser (LocAR.js + three.js)

Before reusing it in production or commercially, please also review the licenses of AR.js, A-Frame, LocAR.js, three.js and other dependencies.
