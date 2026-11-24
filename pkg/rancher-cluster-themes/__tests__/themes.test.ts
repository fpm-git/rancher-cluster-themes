import { startThemes, stopThemes, themeColor, themeTints } from '../themes';
import { createStore } from 'vuex';
import { nextTick } from 'vue';
import extension from '../index';
import { init } from '../product';
import { COLOR_PREFERENCE, ColorChoice, COLORS, ENABLED_PREFERENCE, PersonalStyle, PREFERENCE, ThemeStyle } from '../preferences';

function createMockStore() {
  let callback = () => {};
  const overrides: Record<string, PersonalStyle> = {};
  const colors: Record<string, ColorChoice> = {};
  const enabled = { value: true };
  const store = {
    getters: {
      clusterId:      'production',
      targetRoute:    { params: { cluster: 'production' } },
      currentCluster: { id: 'production', metadata: { annotations: { 'ui.rancher/badge-color': '#f00', 'rancher-cluster-themes.local/style': 'bold' } } },
      'prefs/theme':  'light',
      'prefs/get':    (key: string) => key === PREFERENCE ? overrides : key === COLOR_PREFERENCE ? colors : enabled.value,
    },
    commit: jest.fn(),
    dispatch: jest.fn().mockResolvedValue({ data: {} }),
    overrides,
    colors,
    enabled,
    watch: jest.fn((_selector, onChange, options) => {
      callback = onChange;
      if (options.immediate) callback();
      return jest.fn();
    }),
    update: () => callback(),
  };
  return store;
}

beforeEach(() => {
  document.body.style.setProperty('--body-text', '#111111');
  document.body.style.setProperty('--link', '#3458a8');
});

afterEach(() => {
  stopThemes();
  document.body.removeAttribute('style');
  jest.restoreAllMocks();
});

test('defaults to no theme and allows account and per-cluster opt-out', () => {
  const store = createMockStore();
  store.enabled.value = false;
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
  store.enabled.value = true;
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 8%');
  store.overrides.production = 'off';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
  store.overrides.production = 'subtle';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 2%');
  store.enabled.value = false;
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
});

test('personal color can replace a missing badge or use its complementary hue', () => {
  const store = createMockStore();
  store.colors.production = 'complement';
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#00ffff 8%');
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
  store.colors.production = 'teal';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#43877f 8%');
  expect(themeColor('complement', '#123456')).toBe('#563412');
  expect(themeColor('complement', 'not-a-color')).toBeUndefined();
});

test('limits strong tints to preserve modern Rancher link contrast', () => {
  const store = createMockStore();
  store.overrides.production = 'immersive';
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '#000000';
  startThemes(store);
  expect(document.body.style.getPropertyValue('--nav-bg')).toContain('#000000 17%');
  document.body.style.setProperty('--body-text', '#fffafa');
  document.body.style.setProperty('--link', '#9bbffd');
  store.getters['prefs/theme'] = 'dark';
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '#ffffff';
  store.update();
  expect(document.body.style.getPropertyValue('--nav-bg')).toContain('#ffffff 22%');
});

test('preserves body and link contrast across styles and supported color extremes', () => {
  const rgb = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (channels: number[]) => channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const ratio = (a: number[], b: number[]) => {
    const first = luminance(a);
    const second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const styles: ThemeStyle[] = ['subtle', 'minimal', 'layered', 'immersive'];
  for (const [dark, base, body, link] of [
    [false, '#ffffff', '#111111', '#3458a8'],
    [false, '#ffffff', '#111111', '#4871c7'],
    [true, '#171b20', '#fffafa', '#9bbffd'],
  ] as const) {
    document.body.style.setProperty('--body-text', body);
    document.body.style.setProperty('--link', link);
    for (const color of [...Object.values(COLORS), '#000000', '#ffffff', '#ff0000', '#0000ff']) {
      for (const style of styles) {
        const tints = themeTints(style, color, dark);
        expect(tints).toBeDefined();
        for (const amount of Object.values(tints!)) {
          const background = rgb(base).map((channel, index) => channel * (100 - amount) / 100 + rgb(color)[index] * amount / 100);
          for (const text of [body, link]) {
            expect(ratio(background, rgb(text))).toBeGreaterThanOrEqual(Math.min(4.5, ratio(rgb(base), rgb(text))) - 1e-10);
          }
        }
      }
    }
  }
});

test('does not apply a theme when text colors cannot be verified', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  document.body.style.removeProperty('--link');
  const store = createMockStore();
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot verify'));
});

test('rechecks text colors after Rancher updates its theme classes', async () => {
  const store = createMockStore();
  store.overrides.production = 'immersive';
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '#ffffff';
  startThemes(store);
  store.getters['prefs/theme'] = 'dark';
  store.update();
  document.body.style.setProperty('--body-text', '#fffafa');
  document.body.style.setProperty('--link', '#9bbffd');
  await nextTick();
  expect(document.body.style.getPropertyValue('--nav-bg')).toContain('#ffffff 22%');
});

test('a personal style overrides the shared style and can return to it', () => {
  const store = createMockStore();
  startThemes(store);
  store.overrides.production = 'immersive';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 18%');
  delete store.overrides.production;
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 8%');
});

test('themes the page and reacts to a cluster switch and theme preference', () => {
  const store = createMockStore();
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 8%');
  expect(document.body.style.getPropertyValue('--nav-bg')).toContain('#f00 19%');
  expect(document.body.style.getPropertyValue('--sortable-table-header-bg')).toContain('#f00 14%');

  store.getters.targetRoute.params.cluster = 'staging';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');

  store.getters.clusterId = 'staging';
  store.getters.currentCluster.id = 'staging';
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '#0088ff';
  store.getters.currentCluster.metadata.annotations['rancher-cluster-themes.local/style'] = 'soft';
  store.getters['prefs/theme'] = 'dark';
  document.body.style.setProperty('--body-text', '#fffafa');
  document.body.style.setProperty('--link', '#9bbffd');
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#171b20 96%, #0088ff 4%');
});

test('clears the theme on global pages and restores prior inline styles on logout', () => {
  document.body.style.setProperty('--body-bg', 'white', 'important');
  const store = createMockStore();
  startThemes(store);
  store.getters.targetRoute.params.cluster = '_';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('white');
  expect(document.body.style.getPropertyPriority('--body-bg')).toBe('important');
  store.getters.targetRoute.params.cluster = 'production';
  store.update();
  stopThemes();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('white');
});

test('does not apply invalid colors or styles', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const store = createMockStore();
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = 'red; color: red';
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
  expect(warn).toHaveBeenCalled();

  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '#ff0000';
  store.getters.currentCluster.metadata.annotations['rancher-cluster-themes.local/style'] = 'unknown';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
});

test('reacts to real Vuex changes without waiting for another navigation', () => {
  const store = createStore({
    state: {
      clusterId: 'production',
      cluster: { id: 'production', metadata: { annotations: { 'ui.rancher/badge-color': '#f00' } } },
      route: { params: { cluster: 'production' } },
      theme: 'light',
    },
    getters: {
      clusterId:      (state) => state.clusterId,
      currentCluster: (state) => state.cluster,
      targetRoute:    (state) => state.route,
      'prefs/theme':  (state) => state.theme,
    },
    mutations: {
      changeColor(state, color: string) {
        state.cluster.metadata.annotations['ui.rancher/badge-color'] = color;
      },
      leaveCluster(state) {
        state.route.params.cluster = '_';
      },
    },
    modules: {
      prefs: {
        namespaced: true,
        getters: { get: () => (key: string) => key === ENABLED_PREFERENCE ? true : {} },
        mutations: { setDefinition() {} },
        actions: { loadServer: () => ({ data: {} }) },
      },
    },
  });

  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 8%');
  store.commit('changeColor', '#00f');
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#00f 8%');
  store.commit('leaveCluster');
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
});

test('starts when dynamically loaded and cleans up when uninstalled', () => {
  const plugin = {
    metadata: { name: '', version: '', description: '', icon: '' },
    addProduct: jest.fn(),
    addUninstallHook: jest.fn(),
    addNavHooks: jest.fn(),
    addAction: jest.fn(),
    register: jest.fn(),
  };
  extension(plugin);
  const store = createMockStore();
  init(plugin, store);
  const action = plugin.addAction.mock.calls[0][2];
  expect(action.enabled({ $route: { params: { cluster: '_' } } })).toBe(false);
  expect(action.enabled({ $route: { params: { cluster: 'production' } } })).toBe(true);
  action.invoke();
  expect(store.dispatch).toHaveBeenCalledWith('management/promptModal', expect.objectContaining({ component: 'ClusterThemesSettings' }));
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 8%');
  plugin.addUninstallHook.mock.calls[0][0]();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
});
