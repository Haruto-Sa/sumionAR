export const MODEL_URLS = {
  duck: new URL('./Duck.glb', import.meta.url).href,
  suimon: new URL('./suimon-kousin.glb', import.meta.url).href,
  wankosoba: new URL('./wankosoba.glb', import.meta.url).href,
} as const;

export type ModelKey = keyof typeof MODEL_URLS;


