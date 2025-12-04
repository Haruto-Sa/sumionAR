# sumionAR (Hiro Marker + Location-based AR Demo)

This repository provides a minimal, up-to-date setup for two browser-based AR experiences:

- **Marker AR** – Renders Duck / Suimon / Wankosoba GLB models on a Hiro marker  
- **Location AR** – Places 3D models at fixed GPS locations defined in `public/config/locations.yaml` (using LocAR.js + three.js)
- **Location map** – Shows all locations from `locations.yaml` on an OpenStreetMap map on the top page

---

## Current Project Layout

```text
ARjs/
├── index.html               # Top page (mode selector + OpenStreetMap of locations)
├── marker-ar.html           # Hiro marker AR
├── location-ar.html         # Location-based AR (LocAR.js)
├── styles.css               # Shared styles
├── public/
│   ├── assets/
│   │   └── markers/
│   │       ├── hiro.png
│   │       └── pattern-marker.patt
│   └── config/
│       ├── locations.yaml   # List of fixed locations (lat/lon, name, icon, color)
│       └── models.yaml      # Model definitions (Duck / Suimon / Wankosoba)
├── src/
│   ├── marker-ar/
│   │   └── main.ts          # Main logic for marker-based AR
│   ├── location/
│   │   ├── core.ts          # Shared LocAR.js + three.js scene setup
│   │   └── uiToggle.ts      # UI minimize button logic
│   ├── location-ar/
│   │   └── main.ts          # Main logic for location-based AR
│   └── models/
│       ├── Duck.glb
│       ├── suimon-kousin.glb
│       ├── wankosoba.glb
│       └── index.ts         # Entry point for model loading
├── dist/                    # Vite build output (generated, not committed)
├── doc/
│   ├── README-en.md         # This file
│   └── manual/              # Additional manuals
│       ├── TROUBLESHOOTING.md
│       ├── SERVER_LOG_README.md
│       └── setup-ioscheck.md, githubUpload.md, ...
├── package.json             # Vite + TypeScript configuration
├── tsconfig.json
├── vite.config.mjs          # Vite config (inputs: index/marker-ar/location-ar, base: /sumionAR/)
└── .gitignore               # Ignore node_modules/, dist/, doc/manual/, logs, etc.
```

---

## Setup

### Prerequisites

- Node.js ≥ 18 (LTS recommended)
- npm (bundled with Node.js)

### Install dependencies

```bash
cd /path/to/ARjs
npm install
```

### Start dev server

```bash
npm run dev
```

Then open:

- `http://localhost:8000/` → `index.html` (top page)

Because the app uses camera and geolocation, access it via **HTTPS or localhost**.

### Build for production

```bash
npm run build
```

This generates static files under `dist/`.  
You can deploy `dist/` directly to static hosting (for example, GitHub Pages at `/sumionAR/`).  
`dist/` itself is ignored by Git via `.gitignore`.

---

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

---

### 2. Location-based AR (`location-ar.html`)

- From the top page, click the **“固定地点 AR（suimon ベース）”** card  
  or open `http://localhost:8000/location-ar.html`
- Allow camera and geolocation access
- Models are placed around the positions defined in `public/config/locations.yaml`

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

---

## Configuration Files

### `public/config/locations.yaml`

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

### `public/config/models.yaml`

Lists GLB models used by the app (Duck, Suimon, Wankosoba, etc.).  
The GLB files themselves live under `src/models/` and are resolved by Vite at build time.

---

## Top-page Map (OpenStreetMap)

`index.html` shows a simple Leaflet + OpenStreetMap map at the bottom:

- Loads `public/config/locations.yaml` and places markers
- Each marker popup shows `icon` + `name`
- If at least one location exists, the map auto-fits all markers using `fitBounds`

---

## Documentation

For more detailed notes and troubleshooting, see the documents under `doc/manual/`:

- `doc/manual/TROUBLESHOOTING.md` – common problems and fixes  
- `doc/manual/SERVER_LOG_README.md` – HTTP server / logging notes (if you use that setup)  
- `doc/manual/setup-ioscheck.md` – how to test on iOS / mobile  
- `doc/manual/githubUpload.md` – how to upload to GitHub Pages

---

## Tech Stack and Licenses

This repository is intended for experimentation and learning around:

- Hiro marker AR (A-Frame + AR.js)
- Location-based AR in the browser (LocAR.js + three.js)

Main libraries used in this project and their licenses:

- three.js — MIT License (© 2010–2025 Mr.doob and contributors)
- A-Frame — MIT License
- AR.js — MIT License
- LocAR.js — MIT License

Before reusing this project in production or commercially, please also review the licenses of the above libraries and any other dependencies.
