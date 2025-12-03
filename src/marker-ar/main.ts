import { MODEL_URLS } from '../models';

function setModelSrcByDataAttribute(): void {
  const duck = document.querySelector<HTMLElement>('[data-model="duck"]');
  const suimon = document.querySelector<HTMLElement>('[data-model="suimon"]');
  const wanko = document.querySelector<HTMLElement>('[data-model="wankosoba"]');

  if (duck) duck.setAttribute('src', MODEL_URLS.duck);
  if (suimon) suimon.setAttribute('src', MODEL_URLS.suimon);
  if (wanko) wanko.setAttribute('src', MODEL_URLS.wankosoba);
}

window.addEventListener('DOMContentLoaded', () => {
  setModelSrcByDataAttribute();
});


