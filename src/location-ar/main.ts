import * as THREE from 'three';
import { MODEL_URLS } from '../models';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LocationScene, metersToLonDelta } from '../location/core';
import { setupUiMinimizer } from '../location/uiToggle';

// js-yaml を CDN から読み込んでいるため、グローバル宣言
declare const jsyaml: any;

type TargetModelConfig = {
  type: string | null;
  attributes: Record<string, unknown>;
};

type Target = {
  id: string | null;
  name: string;
  lat: number;
  lon: number;
  icon: string;
  color: string | null;
  model: TargetModelConfig | null;
};

type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

const TARGETS_CONFIG_URL = 'config/targets.yaml';
// 地点定義は locations.yaml を優先的に使用する
const SUIMON_CONFIG_URL = 'config/locations.yaml';

const state = {
  selectedIndex: 0,
  hasNearSpawned: false,
  hasFixedSpawned: false,
  lastPosition: null as GeoPosition | null,
  modelHeight: 1,
  modelSize: 12,
  modelRotationDeg: 0,
  selectedModelKind: null as ModelKind | null,
  fixedObject: null as THREE.Object3D | null,
  nearObject: null as THREE.Object3D | null,
  loading: false,
  targets: [] as Target[],
  suimonModels: [] as SuimonModelConfig[],
  suimonByKey: new Map<string, SuimonModelConfig>(),
};

type ModelKind = 'duck' | 'suimon' | 'wankosoba';

const loader = new GLTFLoader();
const modelCache = new Map<ModelKind, THREE.Object3D>();

const ui = {
  status: document.getElementById('info-status') as HTMLElement | null,
  current: document.getElementById('info-current') as HTMLElement | null,
  accuracy: document.getElementById('info-accuracy') as HTMLElement | null,
  target: document.getElementById('info-target') as HTMLElement | null,
  distance: document.getElementById('info-distance') as HTMLElement | null,
  bearing: document.getElementById('info-bearing') as HTMLElement | null,
};

const controls = {
  modelSelect: document.getElementById('model-select') as HTMLSelectElement | null,
  targetSelect: document.getElementById('target-select') as HTMLSelectElement | null,
  heightSlider: document.getElementById('height-slider') as HTMLInputElement | null,
  heightValue: document.getElementById('height-value') as HTMLElement | null,
  sizeInput: document.getElementById('size-input') as HTMLInputElement | null,
  sizeValue: document.getElementById('size-value') as HTMLElement | null,
  rotationSlider: document.getElementById('rotation-slider') as HTMLInputElement | null,
  rotationValue: document.getElementById('rotation-value') as HTMLElement | null,
};

type SuimonModelConfig = {
  id: string | null;
  name: string | null;
  lat: number;
  lon: number;
  modelFile: string | null;
  scale: number | null;
  rotationYDeg: number | null;
  height: number | null;
  altitude: number | null;
};

function suimonKey(lat: number, lon: number): string {
  return `${lat.toFixed(8)},${lon.toFixed(8)}`;
}

function normalizeTarget(raw: any): Target | null {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.latitude ?? raw.lat);
  const lon = Number(raw.longitude ?? raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.warn('[config] 無効な座標が検出されました', raw);
    return null;
  }
  return {
    id: raw.id ?? null,
    name:
      typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : `Target ${lat.toFixed(4)}`,
    lat,
    lon,
    icon: typeof raw.icon === 'string' && raw.icon.trim() ? raw.icon : '📍',
    color: typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : null,
    model: sanitizeModelConfig(raw.model),
  };
}

function normalizeSuimonModel(raw: any): SuimonModelConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.latitude ?? raw.lat);
  const lon = Number(raw.longitude ?? raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.warn('[suimon] 無効な座標が検出されました', raw);
    return null;
  }
  const toNumberOrNull = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: typeof raw.id === 'string' ? raw.id : null,
    name: typeof raw.name === 'string' ? raw.name : null,
    lat,
    lon,
    modelFile: typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : null,
    scale: toNumberOrNull(raw.scale),
    rotationYDeg: toNumberOrNull(raw.rotation),
    height: toNumberOrNull(raw.height),
    altitude: toNumberOrNull(raw.altitude),
  };
}

function sanitizeModelConfig(model: any): TargetModelConfig | null {
  if (!model || typeof model !== 'object') return null;
  const type =
    typeof model.type === 'string' && model.type.trim() ? (model.type.trim() as string) : null;
  const attributes: Record<string, unknown> = {};
  if (model.attributes && typeof model.attributes === 'object') {
    Object.entries(model.attributes).forEach(([key, value]) => {
      attributes[key] = value as unknown;
    });
  }
  return { type, attributes };
}

function pickModelFallback(target: Target): ModelKind {
  const index = Math.max(0, state.targets.indexOf(target));
  const options: ModelKind[] = ['duck', 'suimon', 'wankosoba'];
  return options[index % options.length];
}

function summarizeTarget(target: Target | null) {
  if (!target) return null;
  return {
    id: target.id,
    name: target.name,
    lat: target.lat,
    lon: target.lon,
    icon: target.icon,
    model: target.model?.type ?? null,
  };
}

async function loadTargetsConfig(): Promise<Target[]> {
  const response = await fetch(TARGETS_CONFIG_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (typeof jsyaml === 'undefined' || typeof jsyaml.load !== 'function') {
    throw new Error('js-yaml ローダーが利用できません');
  }
  const text = await response.text();
  const parsed = jsyaml.load(text);
  const rawTargets = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.targets)
    ? parsed.targets
    : [];
  const normalized = (rawTargets as any[]).map(normalizeTarget).filter(Boolean) as Target[];
  if (!normalized.length) {
    throw new Error('有効な地点が設定されていません');
  }
  state.targets = normalized;
  state.selectedIndex = Math.min(state.selectedIndex, state.targets.length - 1);
  if (state.selectedIndex < 0) state.selectedIndex = 0;
  resetFixedObject();
  logEvent('config-load', 'ターゲット設定を読み込みました', { count: normalized.length });
  return state.targets;
}

async function loadSuimonConfig(): Promise<SuimonModelConfig[]> {
  const response = await fetch(SUIMON_CONFIG_URL, { cache: 'no-store' });
  if (!response.ok) {
    console.warn('[suimon] suimon.yaml の読み込みに失敗しました', response.status);
    return [];
  }
  if (typeof jsyaml === 'undefined' || typeof jsyaml.load !== 'function') {
    console.warn('[suimon] js-yaml ローダーが利用できません');
    return [];
  }
  const text = await response.text();
  const parsed = jsyaml.load(text);
  // locations.yaml を想定（後方互換として models 配列も許可）
  const rawModels =
    Array.isArray((parsed as any)?.locations)
      ? (parsed as any).locations
      : Array.isArray((parsed as any)?.models)
      ? (parsed as any).models
      : Array.isArray(parsed)
      ? (parsed as any)
      : [];
  const normalized = (rawModels as any[]).map(normalizeSuimonModel).filter(Boolean) as SuimonModelConfig[];
  state.suimonModels = normalized;
  state.suimonByKey.clear();
  normalized.forEach((m) => {
    state.suimonByKey.set(suimonKey(m.lat, m.lon), m);
  });
  console.log(`[suimon] suimon.yaml を読み込みました (${normalized.length} 件)`);
  return normalized;
}

function buildTargetsFromSuimon(): void {
  if (!state.suimonModels.length) return;
  const targets: Target[] = state.suimonModels.map((m, index) => {
    const name =
      (m.name && m.name.trim()) ||
      (m.id && m.id.trim()) ||
      `水門 #${index + 1}`;
    return {
      id: m.id,
      name,
      lat: m.lat,
      lon: m.lon,
      icon: '🌊',
      color: '#4e9bff',
      model: { type: 'suimon', attributes: {} },
    };
  });
  state.targets = targets;
  state.selectedIndex = Math.min(state.selectedIndex, state.targets.length - 1);
  if (state.selectedIndex < 0) state.selectedIndex = 0;
  resetFixedObject();
  logEvent('config-load', 'suimon.yaml から地点設定を構築しました', {
    count: targets.length,
    source: 'suimon.yaml',
  });
}

function getSelectedTarget(): Target | null {
  if (!state.targets.length) return null;
  return state.targets[state.selectedIndex] || state.targets[0];
}

function setupTargetOptions() {
  const select = controls.targetSelect;
  if (!select) return;
  select.innerHTML = '';
  if (!state.targets.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '地点設定なし';
    select.appendChild(option);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  state.targets.forEach((target, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${target.icon || '📍'} ${target.name}`;
    select.appendChild(option);
  });
  select.value = String(state.selectedIndex);
  if (!select.dataset.bound) {
    select.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      handleTargetChange(value);
    });
    select.dataset.bound = '1';
  }
}

function setupModelControl() {
  const select = controls.modelSelect;
  if (!select) return;
  // 初期値は「自動（地点ごと）」 = null
  select.value = '';
  if (!select.dataset.bound) {
    select.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (value === '') {
        state.selectedModelKind = null;
      } else if (value === 'duck' || value === 'suimon' || value === 'wankosoba') {
        state.selectedModelKind = value;
      } else {
        console.warn('[model-select] 未知のモデル種別', value);
        state.selectedModelKind = null;
      }
      resetFixedObject();
      spawnFixedTarget();
      logEvent(
        'model-switch',
        'モデル選択を切り替えました',
        { modelKind: state.selectedModelKind ?? 'auto' },
        true
      );
    });
    select.dataset.bound = '1';
  }
}

function handleTargetChange(value: string) {
  const index = Number(value);
  if (!Number.isInteger(index) || !state.targets[index]) {
    console.warn('[target] 無効な選択値', value);
    return;
  }
  if (index === state.selectedIndex) return;
  state.selectedIndex = index;
  resetFixedObject();
  updateTargetInfo();
  if (state.lastPosition) {
    updateInfoPanel(state.lastPosition);
  }
  spawnFixedTarget();
  logEvent(
    'target-switch',
    '地点を切り替えました',
    { target: summarizeTarget(getSelectedTarget()) },
    true
  );
}

function updateTargetInfo() {
  const target = getSelectedTarget();
  if (controls.targetSelect) {
    controls.targetSelect.value = state.targets.length ? String(state.selectedIndex) : '';
  }
  if (!target) {
    if (ui.target) ui.target.textContent = '--';
    return;
  }
  if (ui.target) {
    ui.target.textContent = `${target.name} / ${formatLatLon(target.lat, target.lon)}`;
  }
}

function setupHeightControl(scene: LocationScene) {
  const slider = controls.heightSlider;
  const label = controls.heightValue;
  if (!slider || !label) return;
  slider.value = String(state.modelHeight);
  label.textContent = `${state.modelHeight.toFixed(1)} m`;
  slider.addEventListener('input', (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    state.modelHeight = value;
    label.textContent = `${state.modelHeight.toFixed(1)} m`;
    updateFixedModelHeight();
  });
  slider.addEventListener('change', () => {
    logEvent(
      'height-adjust',
      'モデル高さを調整しました',
      { height: state.modelHeight.toFixed(2) },
      true
    );
  });
}

function updateFixedModelTransform() {
  if (!sceneInstance) return;
  const target = getSelectedTarget();
  if (!target) return;
  if (state.fixedObject) {
    sceneInstance.remove(state.fixedObject);
    state.fixedObject = null;
    state.hasFixedSpawned = false;
  }
  void spawnFixedTarget();
}

function setupSizeControl() {
  const input = controls.sizeInput;
  const label = controls.sizeValue;
  if (!input || !label) return;
  input.value = String(state.modelSize);
  label.textContent = `${state.modelSize.toFixed(2)} m`;
  const handleUpdate = () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    state.modelSize = value;
    label.textContent = `${state.modelSize.toFixed(2)} m`;
    updateFixedModelTransform();
  };
  input.addEventListener('input', handleUpdate);
  input.addEventListener('change', () => {
    handleUpdate();
    logEvent(
      'size-adjust',
      'モデルサイズを調整しました',
      { size: state.modelSize.toFixed(2) },
      true
    );
  });
}

function setupRotationControl() {
  const slider = controls.rotationSlider;
  const label = controls.rotationValue;
  if (!slider || !label) return;
  slider.value = String(state.modelRotationDeg);
  label.textContent = `${state.modelRotationDeg.toFixed(0)}°`;
  slider.addEventListener('input', (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    state.modelRotationDeg = value;
    label.textContent = `${state.modelRotationDeg.toFixed(0)}°`;
    updateFixedModelTransform();
  });
  slider.addEventListener('change', () => {
    logEvent(
      'rotation-adjust',
      'モデル向きを調整しました',
      { rotationY: state.modelRotationDeg.toFixed(1) },
      true
    );
  });
}

function updateFixedModelHeight() {
  updateFixedModelTransform();
}

function logEvent(
  type: string,
  message: string,
  details: Record<string, unknown> = {},
  attachLocation = false
) {
  const payload: any = {
    type,
    message,
    details,
  };
  if (attachLocation && state.lastPosition) {
    payload.location = {
      lat: state.lastPosition.latitude,
      lon: state.lastPosition.longitude,
    };
  }
  console.log(`[log][${type}] ${message}`, details);
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.warn('[log] サーバー送信に失敗しました', error);
  });
}

function formatLatLon(lat: number, lon: number): string {
  const format = (value: number, positive: string, negative: string) => {
    const sign = value >= 0 ? positive : negative;
    return `${Math.abs(value).toFixed(6)}°${sign}`;
  };
  return `${format(lat, 'N', 'S')} / ${format(lon, 'E', 'W')}`;
}

function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6378137;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const λ2 = (lon2 * Math.PI) / 180;
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;
  return bearing;
}

function bearingToCompass(bearing: number): string {
  const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  const index = Math.round(bearing / 45) % 8;
  return `${dirs[index]} (${bearing.toFixed(1)}°)`;
}

function updateInfoPanel(position: GeoPosition) {
  const target = getSelectedTarget();
  if (ui.current) {
    ui.current.textContent = formatLatLon(position.latitude, position.longitude);
  }
  if (ui.accuracy) {
    const acc = position.accuracy;
    ui.accuracy.textContent =
      typeof acc === 'number' ? `${acc.toFixed(1)} m` : '--';
  }
  if (target) {
    const distance = calcDistanceMeters(
      position.latitude,
      position.longitude,
      target.lat,
      target.lon
    );
    if (ui.distance) {
      ui.distance.textContent = `${distance.toFixed(distance >= 1000 ? 0 : 1)} m`;
    }
    const bearing = calcBearing(
      position.latitude,
      position.longitude,
      target.lat,
      target.lon
    );
    if (ui.bearing) {
      ui.bearing.textContent = bearingToCompass(bearing);
    }
  } else {
    if (ui.distance) ui.distance.textContent = '--';
    if (ui.bearing) ui.bearing.textContent = '--';
  }
  if (ui.status) {
    ui.status.textContent = '追跡中';
  }
}

function pickModel(target: Target): ModelKind {
  if (state.selectedModelKind) return state.selectedModelKind;
  const type = (target.model?.type as ModelKind | null)?.toLowerCase();
  if (type === 'duck' || type === 'suimon' || type === 'wankosoba') return type;
  return pickModelFallback(target);
}

function getSuimonConfigForTarget(target: Target): SuimonModelConfig | null {
  const key = suimonKey(target.lat, target.lon);
  const direct = state.suimonByKey.get(key);
  if (direct) return direct;
  // 緯度経度が僅かに異なる場合のフォールバック（±1e-5 程度）
  let best: SuimonModelConfig | null = null;
  let bestDist = Infinity;
  for (const cfg of state.suimonModels) {
    const dLat = Math.abs(cfg.lat - target.lat);
    const dLon = Math.abs(cfg.lon - target.lon);
    const dist = dLat + dLon;
    if (dist < bestDist && dist < 1e-4) {
      bestDist = dist;
      best = cfg;
    }
  }
  return best;
}

function getModelUrl(kind: ModelKind, target: Target): string {
  const suimonConfig = getSuimonConfigForTarget(target);
  // suimon タイプかつ suimon.yaml に modelFile があればそれを優先
  if (kind === 'suimon' && suimonConfig?.modelFile) {
    // suimon.yaml の modelFile も src/models/ 直下に置く前提で、Vite の URL 解決を使う
    if (suimonConfig.modelFile === 'Duck.glb') return MODEL_URLS.duck;
    if (suimonConfig.modelFile === 'suimon-kousin.glb') return MODEL_URLS.suimon;
    if (suimonConfig.modelFile === 'wankosoba.glb') return MODEL_URLS.wankosoba;
  }
  if (kind === 'suimon') return MODEL_URLS.suimon;
  if (kind === 'wankosoba') return MODEL_URLS.wankosoba;
  return MODEL_URLS.duck;
}

function applySuimonTransform(obj: THREE.Object3D, target: Target) {
  const cfg = getSuimonConfigForTarget(target);
  const baseHeight = typeof cfg?.height === 'number' ? cfg.height : state.modelHeight;
  const baseScaleMultiplier = typeof cfg?.scale === 'number' ? cfg.scale : 1;
  const baseRotationDeg = typeof cfg?.rotationYDeg === 'number' ? cfg.rotationYDeg : 0;
  const userRotationDeg = state.modelRotationDeg || 0;
  obj.position.set(0, baseHeight, 0);
  const scaleMeters = state.modelSize * baseScaleMultiplier;
  const scale = scaleMeters / 10;
  obj.scale.setScalar(scale);
  obj.rotation.y = ((baseRotationDeg + userRotationDeg) * Math.PI) / 180;
}

async function createTargetObject(target: Target): Promise<THREE.Object3D> {
  const kind = pickModel(target);
  const cached = modelCache.get(kind);
  if (cached) {
    const inst = cached.clone(true);
    applySuimonTransform(inst, target);
    return prepareModelInstance(inst);
  }

  const url = getModelUrl(kind, target);
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root) {
          reject(new Error('GLB にシーンが含まれていません'));
          return;
        }
        modelCache.set(kind, root);
        const inst = root.clone(true);
        applySuimonTransform(inst, target);
        resolve(prepareModelInstance(inst));
      },
      undefined,
      (error) => reject(error)
    );
  });
}

function prepareModelInstance(obj: THREE.Object3D): THREE.Object3D {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  return obj;
}

async function spawnFixedTarget() {
  if (state.hasFixedSpawned || state.loading) return;
  const target = getSelectedTarget();
  if (!target || !sceneInstance) return;
  state.loading = true;
  try {
    const obj = await createTargetObject(target);
    state.fixedObject = obj;
    sceneInstance.addAtLatLon(obj, target.lat, target.lon, state.modelHeight);
    state.hasFixedSpawned = true;
    logEvent('spawn-fixed', '固定モデルを配置しました', { target: summarizeTarget(target) });
  } catch (error) {
    console.warn('[model] load failed', error);
  } finally {
    state.loading = false;
  }
}

function spawnNearBox(position: GeoPosition) {
  if (state.hasNearSpawned || !position || !sceneInstance) return;
  const dLon = metersToLonDelta(5, position.latitude);
  const lat = position.latitude;
  const lon = position.longitude + dLon;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshStandardMaterial({ color: '#3399ff' })
  );
  box.position.y = 3;
  state.nearObject = box;
  sceneInstance.addAtLatLon(box, lat, lon);
  state.hasNearSpawned = true;
  logEvent(
    'spawn-near',
    'デバッグ用の近距離ボックスを配置しました',
    { offsetMetersEast: 5 },
    true
  );
}

let sceneInstance: LocationScene | null = null;

function resetFixedObject() {
  if (state.fixedObject && sceneInstance) {
    sceneInstance.remove(state.fixedObject);
  }
  state.fixedObject = null;
  state.hasFixedSpawned = false;
}

function handlePositionUpdate(position: GeoPosition, source = 'gps-event') {
  if (!position) return;
  state.lastPosition = position;
  updateInfoPanel(position);
  if (!state.hasNearSpawned) {
    //spawnNearBox(position);
  }
  if (!state.hasFixedSpawned) {
    spawnFixedTarget();
  }
  console.log(`[gps] update via ${source}`, position);
}

function setupMotionPermissionButton() {
  const button = document.getElementById('motion-permission-button') as HTMLButtonElement | null;
  if (!button) return;
  const needsPermission =
    typeof DeviceMotionEvent !== 'undefined' &&
    typeof (DeviceMotionEvent as any).requestPermission === 'function';
  const needsOrientation =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as any).requestPermission === 'function';
  if (!needsPermission && !needsOrientation) {
    button.style.display = 'none';
    return;
  }

  button.addEventListener('click', async () => {
    try {
      if (needsPermission) {
        await (DeviceMotionEvent as any).requestPermission();
      }
      if (needsOrientation) {
        await (DeviceOrientationEvent as any).requestPermission();
      }
      console.log('[perm] Device motion/orientation granted');
    } catch (error) {
      console.warn('[perm] requestPermission failed', error);
    } finally {
      button.style.display = 'none';
    }
  });
}

function main() {
  sceneInstance = new LocationScene();
  setupMotionPermissionButton();
  setupHeightControl(sceneInstance);
  setupSizeControl();
  setupRotationControl();
  setupModelControl();
  setupUiMinimizer('location-ar');

  // 優先的に suimon.yaml から地点リストを構築し、失敗時のみ targets.yaml をフォールバックに使用
  loadSuimonConfig()
    .then(() => {
      if (state.suimonModels.length) {
        buildTargetsFromSuimon();
        setupTargetOptions();
        updateTargetInfo();
        spawnFixedTarget();
        return;
      }
      // suimon.yaml が空の場合のみ targets.yaml を利用
      return loadTargetsConfig().then(() => {
        setupTargetOptions();
        updateTargetInfo();
        spawnFixedTarget();
      });
    })
    .catch((error) => {
      console.warn('[config] suimon.yaml / targets.yaml の読み込みに失敗しました', error);
      logEvent('config-error', '地点設定の読み込みに失敗しました', {
        message: (error as Error)?.message,
      });
      state.targets = [];
      state.selectedIndex = 0;
      resetFixedObject();
      if (ui.status) ui.status.textContent = '設定読み込み失敗';
      if (ui.target) ui.target.textContent = '--';
      const select = controls.targetSelect;
      if (select) {
        select.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '地点設定なし';
        select.appendChild(option);
        select.disabled = true;
      }
    });

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        const coords = position.coords;
        handlePositionUpdate(
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          },
          'geolocation'
        );
      },
      (error) => {
        console.warn('[geo] 位置取得に失敗しました', error);
        if (ui.status) ui.status.textContent = `エラー: ${error.code}`;
        logEvent('gps-error', 'Geolocation API でエラーが発生しました', {
          code: error.code,
          message: error.message,
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  } else {
    alert('⚠️ Geolocation API が利用できません。');
    if (ui.status) ui.status.textContent = '未対応';
  }
}

main();
