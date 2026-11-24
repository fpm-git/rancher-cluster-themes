import { startThemes, stopThemes } from '../themes';
import { createStore } from 'vuex';
import extension from '../index';
import { init } from '../product';
import { ThemeStyle } from '../preferences';

function createMockStore() {
  let callback = () => {};
  const overrides: Record<string, ThemeStyle> = {};
  const store = {
    getters: {
      clusterId:      'production',
      targetRoute:    { params: { cluster: 'production' } },
      currentCluster: { id: 'production', metadata: { annotations: { 'ui.rancher/badge-color': '#f00', 'rancher-cluster-themes.local/style': 'bold' } } },
      'prefs/theme':  'light',
      'prefs/get':    () => overrides,
    },
    commit: jest.fn(),
    dispatch: jest.fn().mockResolvedValue({ data: {} }),
    overrides,
    watch: jest.fn((_selector, onChange, options) => {
      callback = onChange;
      if (options.immediate) callback();
      return jest.fn();
    }),
    update: () => callback(),
  };
  return store;
}

afterEach(() => {
  stopThemes();
  document.body.removeAttribute('style');
  jest.restoreAllMocks();
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
        getters: { get: () => () => ({}) },
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
