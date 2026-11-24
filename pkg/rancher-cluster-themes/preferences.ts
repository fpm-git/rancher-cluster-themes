export const PREFERENCE = 'cluster-themes-styles';
export const ENABLED_PREFERENCE = 'cluster-themes-enabled';
export const COLOR_PREFERENCE = 'cluster-themes-colors';
export const STYLE_ANNOTATION = 'rancher-cluster-themes.local/style';

export type ThemeStyle = 'layered' | 'immersive' | 'minimal' | 'subtle';
export type PersonalStyle = ThemeStyle | 'off';
export type PersonalStyles = Record<string, PersonalStyle>;
export const COLORS = {
  ocean: '#39739a',
  teal: '#43877f',
  forest: '#5d8064',
  plum: '#826b91',
  rose: '#ad7078',
  amber: '#aa814a',
} as const;
export type ColorChoice = 'badge' | 'complement' | keyof typeof COLORS;
export type PersonalColors = Record<string, ColorChoice>;

interface PreferenceResource {
  data: Record<string, string>;
  save: (options: { redirectUnauthorized: boolean }) => Promise<unknown>;
}

interface NormanCluster {
  annotations: Record<string, string>;
  save: () => Promise<unknown>;
}

export interface SettingsStore {
  getters: {
    'prefs/get': (key: string) => unknown;
  };
  commit: (type: string, value: unknown) => void;
  dispatch: (type: string, value?: unknown) => Promise<unknown>;
}

const pendingLoads = new WeakMap<SettingsStore, Promise<void>>();

export function isThemeStyle(value: unknown): value is ThemeStyle {
  return value === 'layered' || value === 'immersive' || value === 'minimal' || value === 'subtle';
}

export function isColorChoice(value: unknown): value is ColorChoice {
  return value === 'badge' || value === 'complement' ||
    (typeof value === 'string' && Object.prototype.hasOwnProperty.call(COLORS, value));
}

export function sharedStyle(value: string | undefined): ThemeStyle | undefined {
  if (!value || value === 'bold') return 'layered';
  if (value === 'soft') return 'minimal';
  return isThemeStyle(value) ? value : undefined;
}

function validateStyles(value: unknown): PersonalStyles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Cluster Themes user preference.');
  }
  const styles: PersonalStyles = {};
  for (const [cluster, style] of Object.entries(value)) {
    if (!isThemeStyle(style) && style !== 'off') throw new Error(`Invalid personal theme for cluster ${cluster}.`);
    styles[cluster] = style;
  }
  return styles;
}

function validateColors(value: unknown): PersonalColors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Cluster Themes color preference.');
  }
  const colors: PersonalColors = {};
  for (const [cluster, color] of Object.entries(value)) {
    if (!isColorChoice(color)) throw new Error(`Invalid personal color for cluster ${cluster}.`);
    colors[cluster] = color;
  }
  return colors;
}

export function themesEnabled(store: SettingsStore): boolean {
  const value = store.getters['prefs/get'](ENABLED_PREFERENCE);
  if (typeof value !== 'boolean') throw new Error('Invalid Cluster Themes enabled preference.');
  return value;
}

export function personalStyles(store: SettingsStore): PersonalStyles {
  return validateStyles(store.getters['prefs/get'](PREFERENCE));
}

export function personalColors(store: SettingsStore): PersonalColors {
  return validateColors(store.getters['prefs/get'](COLOR_PREFERENCE));
}

export function registerPreference(store: SettingsStore): void {
  for (const [name, def] of [[PREFERENCE, {}], [COLOR_PREFERENCE, {}], [ENABLED_PREFERENCE, false]] as const) {
    store.commit('prefs/setDefinition', {
      name,
      definition: { def, parseJSON: true, asCookie: false, asUserPreference: true },
    });
  }
}

export function loadPreferences(store: SettingsStore): Promise<void> {
  const pending = pendingLoads.get(store);
  if (pending) return pending;
  const request = Promise.resolve().then(async () => {
    const server = await store.dispatch('prefs/loadServer') as PreferenceResource | undefined;
    if (!server?.data) throw new Error('Could not load Rancher user preferences.');
    const raw = server.data[PREFERENCE];
    if (raw !== undefined) validateStyles(JSON.parse(raw));
    const colors = server.data[COLOR_PREFERENCE];
    if (colors !== undefined) validateColors(JSON.parse(colors));
    const enabled = server.data[ENABLED_PREFERENCE];
    if (enabled !== undefined && typeof JSON.parse(enabled) !== 'boolean') throw new Error('Invalid Cluster Themes enabled preference.');
    personalStyles(store);
    personalColors(store);
    themesEnabled(store);
  }).finally(() => pendingLoads.delete(store));
  pendingLoads.set(store, request);
  return request;
}

async function savePreference(store: SettingsStore, key: string, update: (value: unknown) => unknown): Promise<void> {
  const pending = pendingLoads.get(store);
  if (pending) await pending;
  const server = await store.dispatch('prefs/loadServer', key) as PreferenceResource | undefined;
  if (!server?.data || typeof server.save !== 'function') throw new Error('Could not load Rancher user preferences.');
  const raw = server.data[key];
  const value = update(raw === undefined ? undefined : JSON.parse(raw));
  server.data[key] = JSON.stringify(value);
  try {
    await server.save({ redirectUnauthorized: false });
  } catch (error) {
    if (raw === undefined) delete server.data[key];
    else server.data[key] = raw;
    throw error;
  }
  store.commit('prefs/load', { key, value });
}

export async function saveThemesEnabled(store: SettingsStore, enabled: boolean): Promise<void> {
  if (typeof enabled !== 'boolean') throw new Error('Invalid Cluster Themes enabled preference.');
  await savePreference(store, ENABLED_PREFERENCE, () => enabled);
}

export async function savePersonalStyle(store: SettingsStore, clusterId: string, style?: PersonalStyle): Promise<void> {
  if (!clusterId || (style !== undefined && !isThemeStyle(style) && style !== 'off')) throw new Error('Invalid cluster or theme style.');
  await savePreference(store, PREFERENCE, (value) => {
    const styles = validateStyles(value === undefined ? {} : value);
    if (style) styles[clusterId] = style;
    else delete styles[clusterId];
    return styles;
  });
}

export async function savePersonalColor(store: SettingsStore, clusterId: string, color: ColorChoice): Promise<void> {
  if (!clusterId || !isColorChoice(color)) throw new Error('Invalid cluster or theme color.');
  await savePreference(store, COLOR_PREFERENCE, (value) => {
    const colors = validateColors(value === undefined ? {} : value);
    if (color === 'badge') delete colors[clusterId];
    else colors[clusterId] = color;
    return colors;
  });
}

export async function saveSharedStyle(store: SettingsStore, clusterId: string, style: ThemeStyle): Promise<void> {
  if (!clusterId || !isThemeStyle(style)) throw new Error('Invalid cluster or theme style.');
  const cluster = await store.dispatch('rancher/find', { type: 'cluster', id: clusterId }) as NormanCluster | undefined;
  if (!cluster?.annotations || typeof cluster.save !== 'function') throw new Error('Could not load the Rancher cluster.');
  const previous = cluster.annotations[STYLE_ANNOTATION];
  cluster.annotations[STYLE_ANNOTATION] = style;
  try {
    await cluster.save();
  } catch (error) {
    if (previous === undefined) delete cluster.annotations[STYLE_ANNOTATION];
    else cluster.annotations[STYLE_ANNOTATION] = previous;
    throw error;
  }
}
