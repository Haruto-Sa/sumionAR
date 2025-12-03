import { MODEL_URLS, ModelKey } from '../models';

// js-yaml を CDN から読み込んでいるため、グローバル宣言
declare const jsyaml: any;

// Vite の base 設定（本番は /sumionAR/）を持ってくる。
// ローカルで / に置いたまま開いているときは、ここでパスを補正する。
const BUILD_BASE = (import.meta as any).env?.BASE_URL ?? '/';

type ModelYamlEntry = {
  id: string;
  kind?: string;
  glb?: string;
};

type ModelsYaml = {
  models?: ModelYamlEntry[];
};

const GLB_NAME_TO_KEY: Record<string, ModelKey> = {
  'Duck.glb': 'duck',
  'suimon-kousin.glb': 'suimon',
  'wankosoba.glb': 'wankosoba',
};

// models.yaml が壊れていても最低限表示できるように、デフォルトマッピングを用意
const DEFAULT_ID_TO_KEY: Record<string, ModelKey> = {
  duck: 'duck',
  suimon: 'suimon',
  wankosoba: 'wankosoba',
};

// base が一致しない環境（例: ローカルで dist を / に置いた場合）でも
// アセットを取得できるように、ビルド時の base を取り除いたパスを返す
function normalizeAssetUrl(url: string): string {
  const base = BUILD_BASE.endsWith('/') ? BUILD_BASE : `${BUILD_BASE}/`;
  if (base === '/' || window.location.pathname.startsWith(base)) {
    return url;
  }

  // 例）url: /sumionAR/assets/xxx → /assets/xxx に変換
  if (url.startsWith(base)) {
    const stripped = url.substring(base.length - 1);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }

  return url;
}

async function loadModelsConfig(): Promise<Record<string, ModelKey>> {
  const mapping: Record<string, ModelKey> = {};
  try {
    if (typeof jsyaml === 'undefined' || typeof jsyaml.load !== 'function') {
      return mapping;
    }
    const res = await fetch('config/models.yaml', { cache: 'no-store' });
    if (!res.ok) return mapping;
    const text = await res.text();
    const parsed = jsyaml.load(text) as ModelsYaml | undefined;
    const list = Array.isArray(parsed?.models) ? parsed!.models! : [];
    for (const m of list) {
      if (!m || typeof m.id !== 'string') continue;
      let key: ModelKey | undefined;
      if (m.glb && GLB_NAME_TO_KEY[m.glb]) {
        key = GLB_NAME_TO_KEY[m.glb];
      } else if (m.kind && (['duck', 'suimon', 'wankosoba'] as string[]).includes(m.kind)) {
        key = m.kind as ModelKey;
      }
      if (key) {
        mapping[m.id] = key;
      }
    }
  } catch (error) {
    console.warn('[marker-ar] models.yaml load failed', error);
  }
  return mapping;
}

async function setModelSrcByDataAttribute(): Promise<void> {
  const configMap = await loadModelsConfig();
  // models.yaml の設定をマージしつつ、足りない ID はデフォルトにフォールバック
  const idToKey: Record<string, ModelKey> = {
    ...DEFAULT_ID_TO_KEY,
    ...configMap,
    // UI ボタン用の「wanko」もここで定義しておく
    wanko: 'wankosoba',
  };

  // マーカー上の 3D モデルエンティティに直接 URL を設定する
  const nodes = document.querySelectorAll<HTMLElement>('[data-model-entity]');
  nodes.forEach((el) => {
    const id = el.getAttribute('data-model-entity') || '';
    const key = idToKey[id];
    const url = key ? normalizeAssetUrl(MODEL_URLS[key]) : undefined;
    if (url) {
      // A-Frame の gltf-model コンポーネントは url(...) 形式を推奨
      el.setAttribute('gltf-model', `url(${url})`);
      // デバッグ用ログ（モバイル Safari でも DevTools 経由で確認しやすいように）
      console.log('[marker-ar] set model src', { id, key, url });
    } else {
      console.warn('[marker-ar] unknown model id, skip', id);
    }
  });
}

// DOMContentLoaded を待たずに（モジュール実行直後に）適用して、
// A-Frame の初期化より前に src が入るようにする
void setModelSrcByDataAttribute();
