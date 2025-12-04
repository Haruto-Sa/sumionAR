# sumionAR（Hiro マーカー + 固定地点 AR デモ）

Hiro マーカーと位置情報ベース AR（LocAR.js + three.js）を、現在の最小構成でまとめたプロジェクトです。

- **マーカー AR**: Hiro マーカー上に Duck / Suimon / Wankosoba の GLB モデルを表示  
- **固定地点 AR**: `public/config/locations.yaml` で定義した地点に 3D モデルを配置し、高さ・サイズ・向きをブラウザから調整  
- **地点マップ**: トップページ下部の OpenStreetMap で、`locations.yaml` の地点を一覧表示

---

## 現在のプロジェクト構成

実際に Git に含めるファイルは `.gitignore` も参照してください。

```text
ARjs/
├── index.html               # トップページ（モード選択 + OpenStreetMap 地点マップ）
├── marker-ar.html           # Hiro マーカー AR
├── location-ar.html         # 固定地点 AR（LocAR.js）
├── styles.css               # 共通スタイル
├── public/
│   ├── assets/
│   │   └── markers/
│   │       ├── hiro.png
│   │       └── pattern-marker.patt
│   └── config/
│       ├── locations.yaml   # 固定地点の座標・名称・アイコン
│       └── models.yaml      # 使用する 3D モデル定義（Duck / Suimon / Wankosoba）
├── src/
│   ├── marker-ar/
│   │   └── main.ts          # Hiro マーカー AR のメインロジック
│   ├── location/
│   │   ├── core.ts          # LocAR.js + three.js の共通 3D シーン制御
│   │   └── uiToggle.ts      # UI 最小化ボタン
│   ├── location-ar/
│   │   └── main.ts          # 固定地点 AR のメインロジック
│   └── models/
│       ├── Duck.glb
│       ├── suimon-kousin.glb
│       ├── wankosoba.glb
│       └── index.ts         # 3D モデル読み込みのエントリ
├── dist/                    # Vite のビルド成果物（自動生成、Git には含めない）
├── doc/
│   ├── README-en.md         # 英語版 README
│   └── manual/              # 詳細マニュアル類
│       ├── TROUBLESHOOTING.md
│       ├── SERVER_LOG_README.md
│       └── setup-ioscheck.md など
├── package.json             # Vite + TypeScript の設定
├── tsconfig.json
├── vite.config.mjs          # Vite 設定（input: index/marker-ar/location-ar, base: /sumionAR/）
└── .gitignore               # node_modules/, dist/, doc/manual/ などを除外
```

---

## セットアップ

### 前提

- Node.js 18 以上（LTS 系推奨）
- npm（Node 同梱のもので OK）

### 依存パッケージのインストール

```bash
cd /path/to/ARjs
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

`vite.config.mjs` でポート `8000` と `base: '/sumionAR/'` を設定しているため、ブラウザで:

- `http://localhost:8000/` → トップページ（`index.html`）

を開いて確認します。  
カメラ / 位置情報を使うので、**HTTPS または localhost** でアクセスしてください。

### 本番ビルド

```bash
npm run build
```

`dist/` 以下に静的ファイルが生成されます。GitHub Pages などの静的ホスティングにそのまま配置できます（`dist/` は `.gitignore` で除外しています）。

---

## 機能別の使い方

### 1. Hiro マーカー AR（`marker-ar.html`）

- トップページのカード「Hiro マーカー AR」から遷移  
  または `http://localhost:8000/marker-ar.html`
- 表示された「開始」ボタンを押し、カメラアクセスを許可
- `public/assets/markers/hiro.png` を印刷するか別画面に表示し、カメラに映すとモデルが出現します。

**特徴**

- Duck / Suimon / Wankosoba の 3 モデルを、画面下部のボタンから切り替え可能
- Suimon は Hiro マーカー上では 1/1000 スケール相当まで縮小して表示

---

### 2. 固定地点 AR（`location-ar.html`）

- トップページのカード「固定地点 AR（suimon ベース）」から遷移  
  または `http://localhost:8000/location-ar.html`
- カメラと位置情報の許可を与えると、`public/config/locations.yaml` に定義された地点まわりに 3D モデルが配置されます。

**右上パネル（モデル / 地点 / モデル調整）**

- **モデル選択**: Duck / Suimon / Wankosoba（または「自動（地点ごと）」）
- **地点選択**: `locations.yaml` に定義した地点（id, name, lat, lon）を切り替え
- **モデル高さ**: スライダー（0〜100m、初期 1m）
- **モデルサイズ (m)**: 数値入力（0.05〜100、少数対応）
- **モデル向き (Y)**: Y 軸まわりの回転（-180〜180°）

**右下パネル（位置情報表示）**

- 現在地（緯度経度）
- GPS 精度（m）
- 対象地点（名称 + 緯度経度）
- 対象地点までの距離（m）
- 対象地点への方位（コンパス方位 + 角度）

**挙動メモ**

- 高さ / サイズ / 向きを変更すると、内部的に一度モデルを外して再配置し、LocAR.js の座標系と整合を取ります。
- 一度 GLB をロードした後はキャッシュからクローンするため、再配置は高速です。

---

## 設定ファイル

### `public/config/locations.yaml`

固定地点一覧。例:

```yaml
locations:
  - id: suimon-1
    name: "水門 #1"
    latitude: 39.80219519075745
    longitude: 141.13317980590008
    icon: "🌊"
    color: "#4e9bff"
  # 以降、同様に地点を追加
```

ここに地点を追加すると、自動的に:

- `location-ar.html` の「地点選択」ドロップダウン
- `index.html` 下部の OpenStreetMap マップ（Leaflet）

に反映されます。

### `public/config/models.yaml`

使用する 3D モデル（Duck / Suimon / Wankosoba など）の定義用ファイルです。  
GLB ファイル自体は `src/models/` に置き、ビルド時に Vite により解決されます。

---

## トップページのマップ（OpenStreetMap）

`index.html` の下部に、Leaflet + OpenStreetMap を用いた簡易マップを表示しています。

- `public/config/locations.yaml` の `locations` を読み込んでマーカー表示
- 各地点は `icon`（絵文字） + `name` のポップアップで表示
- 地点が 1 件以上あれば `fitBounds` で全地点が入るよう自動調整

---

## ドキュメント

より詳しい説明やトラブルシューティングは `doc/manual/` 以下を参照してください。

- `doc/manual/TROUBLESHOOTING.md` – よくある問題と対処  
- `doc/manual/SERVER_LOG_README.md` – ログ付き HTTP サーバーの説明（必要な場合）  
- `doc/manual/setup-ioscheck.md` – iOS / スマホでの動作確認手順  
- `doc/manual/githubUpload.md` – GitHub Pages へのアップロード手順

---

## 技術スタック / ライブラリ

このリポジトリは、主に次のライブラリを利用しています。

- AR.js
- A-Frame
- three.js
- LocAR.js
- Vite + TypeScript

### ライセンス表記（主要ライブラリ）

このプロジェクト内部で利用している主な外部ライブラリとライセンスは次の通りです。

- three.js — MIT License (© 2010–2025 Mr.doob and contributors)
- A-Frame — MIT License
- AR.js — MIT License
- LocAR.js — MIT License

このリポジトリ自体はデモ / 学習目的で作成されています。  
再利用や商用利用の際は、上記ライブラリおよびその他依存パッケージのライセンスも併せて確認してください。
