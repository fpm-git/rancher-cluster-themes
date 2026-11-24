export const PREFERENCE = 'cluster-themes-styles';
export const STYLE_ANNOTATION = 'rancher-cluster-themes.local/style';

export type ThemeStyle = 'layered' | 'immersive' | 'minimal';
export type PersonalStyles = Record<string, ThemeStyle>;

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
  return value === 'layered' || value === 'immersive' || value === 'minimal';
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
    if (!isThemeStyle(style)) throw new Error(`Invalid personal theme for cluster ${cluster}.`);
    styles[cluster] = style;
  }
  return styles;
}

export function personalStyles(store: SettingsStore): PersonalStyles {
  return validateStyles(store.getters['prefs/get'](PREFERENCE));
}

export function registerPreference(store: SettingsStore): void {
  store.commit('prefs/setDefinition', {
    name: PREFERENCE,
    definition: { def: {}, parseJSON: true, asCookie: false, asUserPreference: true },
  });
}

export function loadPreferences(store: SettingsStore): Promise<void> {
  const pending = pendingLoads.get(store);
  if (pending) return pending;
  const request = Promise.resolve().then(async () => {
    const server = await store.dispatch('prefs/loadServer') as PreferenceResource | undefined;
    if (!server?.data) throw new Error('Could not load Rancher user preferences.');
    const raw = server.data[PREFERENCE];
    if (raw !== undefined) validateStyles(JSON.parse(raw));
    personalStyles(store);
  }).finally(() => pendingLoads.delete(store));
  pendingLoads.set(store, request);
  return request;
}

export async function savePersonalStyle(store: SettingsStore, clusterId: string, style?: ThemeStyle): Promise<void> {
  if (!clusterId || (style !== undefined && !isThemeStyle(style))) throw new Error('Invalid cluster or theme style.');
  const pending = pendingLoads.get(store);
  if (pending) await pending;
  const server = await store.dispatch('prefs/loadServer', PREFERENCE) as PreferenceResource | undefined;
  if (!server?.data || typeof server.save !== 'function') throw new Error('Could not load Rancher user preferences.');
  const raw = server.data[PREFERENCE];
  const styles = validateStyles(raw === undefined ? {} : JSON.parse(raw));
  if (style) styles[clusterId] = style;
  else delete styles[clusterId];
  server.data[PREFERENCE] = JSON.stringify(styles);
  try {
    await server.save({ redirectUnauthorized: false });
  } catch (error) {
    if (raw === undefined) delete server.data[PREFERENCE];
    else server.data[PREFERENCE] = raw;
    throw error;
  }
  store.commit('prefs/load', { key: PREFERENCE, value: styles });
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
