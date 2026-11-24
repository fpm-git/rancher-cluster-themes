import { loadPreferences, personalStyles, registerPreference, SettingsStore, sharedStyle, STYLE_ANNOTATION, ThemeStyle } from './preferences';

const COLOR = 'ui.rancher/badge-color';

interface Cluster {
  id: string;
  metadata?: { annotations?: Record<string, string> };
}

interface Getters {
  clusterId?: string;
  currentCluster?: Cluster;
  targetRoute?: { params?: { cluster?: string } };
  'prefs/theme'?: string;
}

export interface ThemeStore extends SettingsStore {
  getters: Getters & SettingsStore['getters'];
  watch: (
    selector: (state: unknown, getters: Getters) => string,
    callback: () => void,
    options: { immediate: boolean; flush: 'sync' }
  ) => () => void;
}

const properties = [
  '--body-bg', '--header-bg', '--nav-bg', '--topmenu-bg', '--modal-bg',
  '--sortable-table-bg', '--sortable-table-row-bg', '--sortable-table-header-bg',
  '--sortable-table-hover-bg', '--drawer-body-bg', '--wm-body-bg', '--logs-bg',
  '--terminal-bg', '--rc-section-background-primary', '--rc-section-background-secondary',
  '--box-bg', '--simple-box-bg',
] as const;

let unwatch: (() => void) | undefined;
let originalStyles: Map<string, { value: string; priority: string }> | undefined;
let activeStore: ThemeStore | undefined;

const palettes: Record<ThemeStyle, { page: number; chrome: number; surface: number; accent: number }> = {
  layered:   { page: 8, chrome: 19, surface: 4, accent: 14 },
  immersive: { page: 18, chrome: 30, surface: 10, accent: 22 },
  minimal:   { page: 4, chrome: 10, surface: 2, accent: 7 },
};

export function currentStore(): ThemeStore | undefined {
  return activeStore;
}

function selectedStyle(store: ThemeStore, clusterId: string, value: string | undefined): ThemeStyle | undefined {
  try {
    return personalStyles(store)[clusterId] || sharedStyle(value);
  } catch (error) {
    console.error('Cluster Themes: could not read personal theme.', error);
    return sharedStyle(value);
  }
}

function clearTheme(): void {
  if (!originalStyles) return;

  for (const [property, original] of originalStyles) {
    if (original.value) {
      document.body.style.setProperty(property, original.value, original.priority);
    } else {
      document.body.style.removeProperty(property);
    }
  }
  originalStyles = undefined;
}

function syncTheme(store: ThemeStore): void {
  const getters = store.getters;
  const clusterId = getters.targetRoute?.params?.cluster;
  const cluster = getters.currentCluster;
  const annotations = cluster?.metadata?.annotations;
  const color = annotations?.[COLOR]?.trim();
  const style = selectedStyle(store, clusterId || '', annotations?.[STYLE_ANNOTATION]);

  if (!clusterId || clusterId === '_' || clusterId !== getters.clusterId || cluster?.id !== clusterId || !color) {
    clearTheme();
    return;
  }

  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) || !style) {
    console.warn('Cluster themes: invalid badge color or theme style for cluster', clusterId);
    clearTheme();
    return;
  }

  if (!originalStyles) {
    originalStyles = new Map(properties.map((property) => [
      property,
      {
        value:    document.body.style.getPropertyValue(property),
        priority: document.body.style.getPropertyPriority(property),
      },
    ]));
  }

  const dark = getters['prefs/theme'] === 'dark';
  const base = dark ? '#171b20' : '#ffffff';
  const palette = palettes[style];

  for (const property of properties) {
    const isChrome = property === '--nav-bg' || property === '--topmenu-bg' || property === '--header-bg';
    const isSurface = property === '--modal-bg' || property === '--sortable-table-row-bg'
      || property === '--drawer-body-bg' || property === '--box-bg' || property === '--simple-box-bg';
    const isAccent = property === '--sortable-table-header-bg'
      || property === '--sortable-table-hover-bg'
      || property === '--rc-section-background-secondary';
    const amount = isChrome ? palette.chrome : isSurface ? palette.surface : isAccent ? palette.accent : palette.page;
    const value = `color-mix(in srgb, ${base} ${100 - amount}%, ${color} ${amount}%)`;

    document.body.style.setProperty(property, value);
  }
}

export function startThemes(store: ThemeStore): void {
  stopThemes();
  activeStore = store;
  registerPreference(store);
  unwatch = store.watch(
    (_state, getters) => JSON.stringify([
      getters.targetRoute?.params?.cluster,
      getters.clusterId,
      getters.currentCluster?.id,
      getters.currentCluster?.metadata?.annotations?.[COLOR],
      getters.currentCluster?.metadata?.annotations?.[STYLE_ANNOTATION],
      getters['prefs/theme'],
      selectedStyle(store, getters.currentCluster?.id || '', getters.currentCluster?.metadata?.annotations?.[STYLE_ANNOTATION]),
    ]),
    () => syncTheme(store),
    { immediate: true, flush: 'sync' }
  );
  void loadPreferences(store).catch((error) => console.error('Cluster Themes: could not load personal themes.', error));
}

export function stopThemes(): void {
  unwatch?.();
  unwatch = undefined;
  activeStore = undefined;
  clearTheme();
}
