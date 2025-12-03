const KEY_PREFIX = 'ui-min-toggle:';

function getStorageKey(suffix?: string) {
  if (suffix && suffix.trim().length) return `${KEY_PREFIX}${suffix.trim()}`;
  return `${KEY_PREFIX}${window.location.pathname}`;
}

export function setupUiMinimizer(storageSuffix?: string) {
  if (typeof document === 'undefined') return;
  const button = document.getElementById('ui-toggle-button') as HTMLButtonElement | null;
  if (!button) return;
  const storageKey = getStorageKey(storageSuffix);

  const applyState = (minimized: boolean) => {
    document.body.classList.toggle('ui-minimized', minimized);
    button.setAttribute('aria-pressed', minimized ? 'true' : 'false');
    button.textContent = minimized ? 'UI再表示' : 'UI最小化';
  };

  let initial = false;
  try {
    initial = localStorage.getItem(storageKey) === '1';
  } catch (error) {
    console.warn('[ui-toggle] localStorage へアクセスできませんでした', error);
  }
  applyState(initial);

  button.addEventListener('click', () => {
    const next = !document.body.classList.contains('ui-minimized');
    applyState(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch (error) {
      console.warn('[ui-toggle] localStorage への保存に失敗しました', error);
    }
  });
}
