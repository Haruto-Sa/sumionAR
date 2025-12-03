import * as THREE from 'three';
import * as LocAR from 'locar';

export type LatLon = {
  lat: number;
  lon: number;
};

export function metersToLatDelta(meters: number): number {
  return meters / 111000;
}

export function metersToLonDelta(meters: number, latDeg: number): number {
  return meters / (111000 * Math.cos((latDeg * Math.PI) / 180));
}

const DEFAULT_VIDEO_ELEMENT_ID = 'locar-video-feed';

type PendingPlacement = {
  object: THREE.Object3D;
  lat: number;
  lon: number;
  altitude: number;
};

export type LocationSceneOptions = {
  gpsMinDistance?: number;
  gpsMinAccuracy?: number;
  videoElementId?: string;
  facingMode?: 'environment' | 'user';
};

export class LocationScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private locationBased: LocAR.LocationBased | null = null;
  private webcam: LocAR.Webcam | null = null;
  private deviceControls: LocAR.DeviceOrientationControls | null = null;
  private videoElement: HTMLVideoElement | null;
  private pendingAdds: PendingPlacement[] = [];
  private animationFrameId = 0;
  private originReady = false;
  private isDisposed = false;
  private readonly handleResize = () => this.onResize();
  private readonly handleBeforeUnload = () => this.dispose();

  constructor(options: LocationSceneOptions = {}) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200000
    );
    this.camera.position.set(0, 1.6, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1, 2, 1);
    this.scene.add(ambient);
    this.scene.add(dir);

    this.videoElement = this.setupVideoElement(options.videoElementId);

    const mountTarget = document.body || document.documentElement;
    if (mountTarget) {
      mountTarget.appendChild(this.renderer.domElement);
    }
    const canvas = this.renderer.domElement;
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '0';
    canvas.style.display = 'block';
    canvas.style.backgroundColor = 'transparent';
    canvas.setAttribute('aria-hidden', 'true');

    const facingMode = options.facingMode ?? 'environment';
    const videoSelector = this.videoElement ? `#${this.videoElement.id}` : undefined;
    this.webcam = new LocAR.Webcam({ video: { facingMode } }, videoSelector);
    if (this.webcam.on) {
      this.webcam.on('webcamstarted', () => {
        if (this.videoElement) {
          this.videoElement.style.opacity = '1';
        }
      });
      this.webcam.on('webcamerror', (event: any) => {
        console.warn('[LocationScene] カメラの初期化に失敗しました', event);
        if (this.videoElement) {
          this.videoElement.style.opacity = '0';
        }
      });
    }

    this.locationBased = new LocAR.LocationBased(this.scene, this.camera, {
      gpsMinDistance: options.gpsMinDistance ?? 3,
      gpsMinAccuracy: options.gpsMinAccuracy ?? 60,
    });

    if (this.locationBased.on) {
      this.locationBased.on('gpsupdate', () => {
        if (!this.originReady) {
          this.originReady = true;
        }
        this.flushPendingAdds();
      });
      this.locationBased.on('gpserror', (error: GeolocationPositionError) => {
        console.warn('[LocationScene] GPS 取得中にエラーが発生しました', error);
      });
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const startResult = this.locationBased.startGps();
        if (startResult && typeof (startResult as Promise<boolean>).then === 'function') {
          (startResult as Promise<boolean>).catch((error) => {
            console.warn('[LocationScene] GPS の開始に失敗しました', error);
          });
        } else if (startResult === false) {
          console.warn('[LocationScene] GPS を開始できませんでした (戻り値 false)');
        }
      } catch (error) {
        console.warn('[LocationScene] startGps 呼び出しに失敗しました', error);
      }
    } else {
      console.warn('[LocationScene] Geolocation API が利用できません');
    }

    this.deviceControls = new LocAR.DeviceOrientationControls(this.camera, {
      enablePermissionDialog: false,
    });
    this.deviceControls.init();
    this.deviceControls.connect();

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    this.animate();
  }

  private setupVideoElement(preferredId?: string): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null;
    const targetId = preferredId || DEFAULT_VIDEO_ELEMENT_ID;
    let element = document.getElementById(targetId) as HTMLVideoElement | null;
    if (!element) {
      element = document.createElement('video');
      element.id = targetId;
      element.muted = true;
      element.defaultMuted = true;
      element.playsInline = true;
      element.autoplay = true;
      element.controls = false;
      element.loop = false;
      element.setAttribute('playsinline', 'true');
      element.setAttribute('webkit-playsinline', 'true');
      element.setAttribute('muted', 'true');
      element.setAttribute('autoplay', 'true');
      element.setAttribute('aria-hidden', 'true');
      element.style.position = 'fixed';
      element.style.inset = '0';
      element.style.width = '100vw';
      element.style.height = '100vh';
      element.style.objectFit = 'cover';
      element.style.zIndex = '-1';
      element.style.pointerEvents = 'none';
      element.style.backgroundColor = '#000';
      element.style.opacity = '0';
      element.style.transition = 'opacity 0.25s ease';
      element.classList.add('locar-video-feed');
      const target = document.body || document.documentElement;
      target?.prepend(element);
    }
    if (element) {
      element.style.zIndex = '-1';
      element.style.pointerEvents = 'none';
      if (!element.style.opacity) {
        element.style.opacity = '0';
      }
    }
    return element;
  }

  private animate = () => {
    this.animationFrameId = window.requestAnimationFrame(this.animate);
    if (this.deviceControls?.update) {
      this.deviceControls.update();
    }
    this.renderer.render(this.scene, this.camera);
  };

  private tryPlaceObject(placement: PendingPlacement): boolean {
    if (!this.locationBased) return false;
    try {
      this.locationBased.add(placement.object, placement.lon, placement.lat, placement.altitude);
      return true;
    } catch (error) {
      const message = (error as Error)?.message || String(error);
      if (typeof message === 'string' && message.includes('No initial position determined')) {
        return false;
      }
      console.error('[LocationScene] addAtLatLon でエラーが発生しました', error);
      return true;
    }
  }

  private flushPendingAdds(): void {
    if (!this.pendingAdds.length) return;
    this.pendingAdds = this.pendingAdds.filter((placement) => !this.tryPlaceObject(placement));
  }

  addAtLatLon(object: THREE.Object3D, lat: number, lon: number, altitude?: number): void {
    const height =
      typeof altitude === 'number'
        ? altitude
        : typeof object.position?.y === 'number'
        ? object.position.y
        : 0;
    const placement: PendingPlacement = { object, lat, lon, altitude: height };
    if (!this.tryPlaceObject(placement)) {
      this.pendingAdds.push(placement);
    }
  }

  remove(object: THREE.Object3D): void {
    this.pendingAdds = this.pendingAdds.filter((placement) => placement.object !== object);
    if (object.parent === this.scene) {
      this.scene.remove(object);
    }
  }

  fakeGps(lon: number, lat: number, altitude?: number, accuracy?: number): void {
    this.locationBased?.fakeGps(lon, lat, altitude ?? null, accuracy ?? 0);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    try {
      this.locationBased?.stopGps();
    } catch (error) {
      console.warn('[LocationScene] stopGps 実行中にエラー', error);
    }

    try {
      this.deviceControls?.disconnect();
      this.deviceControls?.dispose?.();
    } catch (error) {
      console.warn('[LocationScene] DeviceOrientationControls の破棄に失敗しました', error);
    }

    try {
      this.webcam?.dispose();
    } catch (error) {
      console.warn('[LocationScene] Webcam の破棄に失敗しました', error);
    }

    this.pendingAdds = [];
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    if (this.videoElement && this.videoElement.parentElement) {
      this.videoElement.parentElement.removeChild(this.videoElement);
    }
    this.videoElement = null;
  }
}
