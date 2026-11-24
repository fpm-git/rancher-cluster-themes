import { ColorChoice, COLOR_PREFERENCE, COLORS, ENABLED_PREFERENCE, loadPreferences, personalColors, personalStyles, PREFERENCE, registerPreference, SettingsStore, sharedStyle, STYLE_ANNOTATION, themesEnabled, ThemeStyle } from './preferences';
import { nextTick } from 'vue';

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
  subtle:    { page: 2, chrome: 5, surface: 1, accent: 3 },
};

type RGB = [number, number, number];

function parseColor(value: string): RGB | undefined {
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
    return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16)];
  }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) !== 1)) return undefined;
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) return undefined;
  return [channels[0], channels[1], channels[2]];
}

function readThemeColor(value: string): RGB | undefined {
  const parsed = parseColor(value);
  if (parsed) return parsed;
  if (!value.trim()) return undefined;

  const probe = document.createElement('span');
  probe.style.color = value;
  if (!probe.style.color) return undefined;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return parseColor(resolved);
}

function luminance(color: RGB): number {
  const linear = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: RGB, second: RGB): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function safeAmount(base: RGB, color: RGB, amount: number, textColors: RGB[]): number {
  const minimums = textColors.map((text) => Math.min(4.5, contrast(base, text)));
  for (let candidate = amount; candidate > 0; candidate--) {
    const mix = (index: number) => base[index] * (100 - candidate) / 100 + color[index] * candidate / 100;
    const background: RGB = [mix(0), mix(1), mix(2)];
    if (textColors.every((text, index) => contrast(background, text) >= minimums[index])) return candidate;
  }
  return 0;
}

export function themeTints(style: ThemeStyle, color: string, dark: boolean): typeof palettes[ThemeStyle] | undefined {
  const computed = getComputedStyle(document.body);
  const bodyText = readThemeColor(computed.getPropertyValue('--body-text'));
  const linkText = readThemeColor(computed.getPropertyValue('--link'));
  const baseColor = parseColor(dark ? '#171b20' : '#ffffff');
  const tintColor = parseColor(color);
  if (!bodyText || !linkText || !baseColor || !tintColor) return undefined;
  const desired = palettes[style];
  const textColors = [bodyText, linkText];
  return {
    page: safeAmount(baseColor, tintColor, desired.page, textColors),
    chrome: safeAmount(baseColor, tintColor, desired.chrome, textColors),
    surface: safeAmount(baseColor, tintColor, desired.surface, textColors),
    accent: safeAmount(baseColor, tintColor, desired.accent, textColors),
  };
}

export function themeColor(choice: ColorChoice, badge: string | undefined): string | undefined {
  if (choice !== 'badge' && choice !== 'complement') return COLORS[choice];
  const color = badge?.trim();
  if (!color || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return undefined;
  if (choice === 'badge') return color;
  const hex = color.slice(1);
  const expanded = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
  const channels = [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16));
  const sum = Math.max(...channels) + Math.min(...channels);
  return `#${channels.map((channel) => (sum - channel).toString(16).padStart(2, '0')).join('')}`;
}

export function currentStore(): ThemeStore | undefined {
  return activeStore;
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

  if (!clusterId || clusterId === '_' || clusterId !== getters.clusterId || cluster?.id !== clusterId) {
    clearTheme();
    return;
  }

  let style: ThemeStyle | 'off' | undefined;
  let color: string | undefined;
  try {
    if (!themesEnabled(store)) {
      clearTheme();
      return;
    }
    style = personalStyles(store)[clusterId] || sharedStyle(annotations?.[STYLE_ANNOTATION]);
    color = themeColor(personalColors(store)[clusterId] || 'badge', annotations?.[COLOR]);
  } catch (error) {
    console.error('Cluster Themes: could not read theme preferences.', error);
    clearTheme();
    return;
  }
  if (style === 'off') {
    clearTheme();
    return;
  }
  if (!color || !style) {
    if (annotations?.[COLOR] || !style) console.warn('Cluster themes: invalid badge color or theme style for cluster', clusterId);
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
  const palette = themeTints(style, color, dark);
  if (!palette) {
    console.warn('Cluster Themes: cannot verify body and link contrast; theme not applied.');
    clearTheme();
    return;
  }

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
      store.getters['prefs/get'](ENABLED_PREFERENCE),
      store.getters['prefs/get'](PREFERENCE),
      store.getters['prefs/get'](COLOR_PREFERENCE),
    ]),
    () => {
      syncTheme(store);
      void nextTick(() => {
        if (activeStore === store) syncTheme(store);
      });
    },
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
