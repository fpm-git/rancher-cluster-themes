const COLOR = 'ui.rancher/badge-color';
const STYLE = 'rancher-cluster-themes.local/style';

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

export interface ThemeStore {
  getters: Getters;
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
] as const;

let unwatch: (() => void) | undefined;
let originalStyles: Map<string, { value: string; priority: string }> | undefined;

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

function syncTheme(getters: Getters): void {
  const clusterId = getters.targetRoute?.params?.cluster;
  const cluster = getters.currentCluster;
  const annotations = cluster?.metadata?.annotations;
  const color = annotations?.[COLOR]?.trim();
  const style = annotations?.[STYLE] || 'bold';

  if (!clusterId || clusterId === '_' || clusterId !== getters.clusterId || cluster?.id !== clusterId || !color) {
    clearTheme();
    return;
  }

  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) || (style !== 'bold' && style !== 'soft')) {
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
  const amount = style === 'bold' ? 30 : 14;
  const surface = `color-mix(in srgb, ${base} ${100 - amount}%, ${color} ${amount}%)`;
  const secondary = `color-mix(in srgb, ${base} ${100 - amount - 5}%, ${color} ${amount + 5}%)`;

  for (const property of properties) {
    const isSecondary = property === '--sortable-table-header-bg'
      || property === '--sortable-table-hover-bg'
      || property === '--rc-section-background-secondary';

    document.body.style.setProperty(property, isSecondary ? secondary : surface);
  }
}

export function startThemes(store: ThemeStore): void {
  stopThemes();
  unwatch = store.watch(
    (_state, getters) => JSON.stringify([
      getters.targetRoute?.params?.cluster,
      getters.clusterId,
      getters.currentCluster?.id,
      getters.currentCluster?.metadata?.annotations?.[COLOR],
      getters.currentCluster?.metadata?.annotations?.[STYLE],
      getters['prefs/theme'],
    ]),
    () => syncTheme(store.getters),
    { immediate: true, flush: 'sync' }
  );
}

export function stopThemes(): void {
  unwatch?.();
  unwatch = undefined;
  clearTheme();
}
