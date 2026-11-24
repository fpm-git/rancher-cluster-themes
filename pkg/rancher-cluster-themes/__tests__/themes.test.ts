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
  const styles = document.createElement('style');
  styles.id = 'rancher-theme-fixture';
  styles.textContent = `
    body {
      --body-bg: #ffffff; --header-bg: #ffffff; --nav-bg: #ffffff; --topmenu-bg: #ffffff;
      --sortable-table-bg: #f2f2f2; --sortable-table-row-bg: #ffffff;
      --sortable-table-header-bg: #f5f5f5; --sortable-table-hover-bg: #f5f5f5;
      --modal-bg: #ffffff; --drawer-body-bg: #f4f5fa; --box-bg: #f4f5fa; --simple-box-bg: #ffffff;
      --rc-section-background-primary: #ffffff; --rc-section-background-secondary: #f5f5f5;
    }
    body.theme-dark {
      --body-bg: #171b20; --header-bg: #171b20; --nav-bg: #171b20; --topmenu-bg: #171b20;
      --sortable-table-bg: #171c22; --sortable-table-row-bg: #25282f;
      --sortable-table-header-bg: #171c22; --sortable-table-hover-bg: #32353c;
      --modal-bg: #25282f; --drawer-body-bg: #171c22; --box-bg: #171c22; --simple-box-bg: #25282f;
      --rc-section-background-primary: #25282f; --rc-section-background-secondary: #171c22;
    }
  `;
  document.head.appendChild(styles);
  document.body.style.setProperty('--body-text', '#111111');
  document.body.style.setProperty('--link', '#3458a8');
});

afterEach(() => {
  stopThemes();
  document.body.removeAttribute('style');
  document.body.classList.remove('theme-dark');
  document.getElementById('rancher-theme-fixture')?.remove();
  jest.restoreAllMocks();
});

test.each(['subtle', 'minimal', 'layered', 'immersive'] as ThemeStyle[])(
  'preserves table grouping, hover and section surfaces with %s in light and dark modes',
  (style) => {
    const store = createMockStore();
    store.overrides.production = style;
    for (const dark of [false, true]) {
      document.body.classList.toggle('theme-dark', dark);
      store.getters['prefs/theme'] = dark ? 'dark' : 'light';
      document.body.style.setProperty('--body-text', dark ? '#fffafa' : '#111111');
      document.body.style.setProperty('--link', dark ? '#9bbffd' : '#3458a8');
      startThemes(store);
      const table = document.body.style.getPropertyValue('--sortable-table-bg');
      const row = document.body.style.getPropertyValue('--sortable-table-row-bg');
      const hover = document.body.style.getPropertyValue('--sortable-table-hover-bg');
      const section = document.body.style.getPropertyValue('--rc-section-background-primary');
      const sectionAlt = document.body.style.getPropertyValue('--rc-section-background-secondary');
      expect(table).not.toEqual(row);
      expect(hover).not.toEqual(row);
      expect(section).not.toEqual(sectionAlt);
      expect(table.match(/#f00 \d+%/)?.[0]).toEqual(row.match(/#f00 \d+%/)?.[0]);
      expect(hover.match(/#f00 \d+%/)?.[0]).toEqual(row.match(/#f00 \d+%/)?.[0]);
      expect(document.body.style.getPropertyValue('--logs-bg')).toBe('');
      expect(document.body.style.getPropertyValue('--terminal-bg')).toBe('');
      stopThemes();
    }
  }
);

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
  document.body.classList.add('theme-dark');
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '#ffffff';
  store.update();
  expect(document.body.style.getPropertyValue('--nav-bg')).toContain('#ffffff 22%');
});

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

test('preserves body and link contrast across styles and supported color extremes', () => {
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

test.each(['subtle', 'minimal', 'layered', 'immersive'] as ThemeStyle[])(
  'preserves text contrast on each actual surface with %s',
  (style) => {
    const store = createMockStore();
    store.overrides.production = style;
    for (const [dark, body, link] of [[false, '#111111', '#3458a8'], [true, '#fffafa', '#9bbffd']] as const) {
      document.body.classList.toggle('theme-dark', dark);
      document.body.style.setProperty('--body-text', body);
      document.body.style.setProperty('--link', link);
      store.getters['prefs/theme'] = dark ? 'dark' : 'light';
      for (const color of ['#000000', '#ffffff', '#ff0000', '#0000ff']) {
        store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = color;
        startThemes(store);
        for (const property of [
          '--body-bg', '--header-bg', '--nav-bg', '--topmenu-bg', '--modal-bg',
          '--sortable-table-bg', '--sortable-table-row-bg', '--sortable-table-header-bg', '--sortable-table-hover-bg',
          '--drawer-body-bg', '--box-bg', '--simple-box-bg', '--rc-section-background-primary', '--rc-section-background-secondary',
        ]) {
          const value = document.body.style.getPropertyValue(property);
          const match = value.match(/^color-mix\(in srgb, rgb\((\d+), (\d+), (\d+)\) \d+%, #[0-9a-f]{6} (\d+)%\)$/);
          expect(match).not.toBeNull();
          const base = match!.slice(1, 4).map(Number);
          const amount = Number(match![4]);
          const background = base.map((channel, index) => channel * (100 - amount) / 100 + rgb(color)[index] * amount / 100);
          for (const text of [body, link]) {
            expect(ratio(background, rgb(text))).toBeGreaterThanOrEqual(Math.min(4.5, ratio(base, rgb(text))) - 1e-10);
          }
        }
        stopThemes();
      }
    }
  }
);

test('does not apply a theme when text colors cannot be verified', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  document.body.style.removeProperty('--link');
  const store = createMockStore();
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot verify'));
});

test('clears the theme when a related surface cannot be resolved', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const store = createMockStore();
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).not.toBe('');
  const fixture = document.getElementById('rancher-theme-fixture')!;
  fixture.textContent = fixture.textContent!.replace('--sortable-table-bg: #f2f2f2', '--sortable-table-bg: not-a-color');
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('');
  expect(document.body.style.getPropertyValue('--sortable-table-bg')).toBe('');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('theme not applied'), expect.stringContaining('--sortable-table-bg'));
});

test('supports Rancher themes without section background variables', () => {
  const fixture = document.getElementById('rancher-theme-fixture')!;
  fixture.textContent = fixture.textContent!.replace(/--rc-section-background-(primary|secondary): #[0-9a-f]+;/g, '');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  startThemes(createMockStore());
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('#f00 8%');
  expect(warn).not.toHaveBeenCalled();
});

test('reapplying a theme uses original colors instead of accumulating tint', () => {
  const store = createMockStore();
  startThemes(store);
  const original = document.body.style.getPropertyValue('--sortable-table-bg');
  store.update();
  expect(document.body.style.getPropertyValue('--sortable-table-bg')).toBe(original);
  store.overrides.production = 'immersive';
  store.update();
  store.overrides.production = 'layered';
  store.update();
  expect(document.body.style.getPropertyValue('--sortable-table-bg')).toBe(original);
});

test('resolves browser-normalized Rancher text colors before checking dark-mode contrast', () => {
  document.body.style.setProperty('--body-text', '#ffffffff');
  document.body.style.setProperty('--link', 'hsl(218, 96%, 80%)');
  const store = createMockStore();
  store.getters['prefs/theme'] = 'dark';
  document.body.classList.add('theme-dark');
  startThemes(store);
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('rgb(23, 27, 32)');
  expect(themeTints('layered', '#ff0000', true)).toBeDefined();
  expect(document.body.querySelector('span')).toBeNull();
});

test('rejects invalid and translucent Rancher colors', () => {
  document.body.style.setProperty('--body-text', '#ffffffff');
  document.body.style.setProperty('--link', 'rgba(155, 191, 253, 0.5)');
  expect(themeTints('layered', '#ff0000', true)).toBeUndefined();
  document.body.style.setProperty('--link', 'not-a-color');
  expect(themeTints('layered', '#ff0000', true)).toBeUndefined();
});

test('re-reads Rancher colors when the theme class changes without a store change', async () => {
  const store = createMockStore();
  document.body.classList.add('theme-dark');
  startThemes(store);
  expect(document.body.style.getPropertyValue('--sortable-table-bg')).toContain('rgb(23, 28, 34)');
  document.body.classList.remove('theme-dark');
  document.body.style.setProperty('--body-text', '#111111');
  document.body.style.setProperty('--link', '#3458a8');
  await Promise.resolve();
  expect(document.body.style.getPropertyValue('--sortable-table-bg')).toContain('rgb(242, 242, 242)');
  stopThemes();
  document.body.classList.add('theme-dark');
  await Promise.resolve();
  expect(document.body.style.getPropertyValue('--sortable-table-bg')).toBe('');
});

test('rechecks text colors after Rancher updates its theme classes', async () => {
  const store = createMockStore();
  store.overrides.production = 'immersive';
  store.getters.currentCluster.metadata.annotations['ui.rancher/badge-color'] = '#ffffff';
  startThemes(store);
  store.getters['prefs/theme'] = 'dark';
  document.body.classList.add('theme-dark');
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
  document.body.classList.add('theme-dark');
  document.body.style.setProperty('--body-text', '#fffafa');
  document.body.style.setProperty('--link', '#9bbffd');
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toContain('rgb(23, 27, 32) 96%, #0088ff 4%');
});

test('clears the theme on global pages and restores prior inline styles on logout', () => {
  document.body.style.setProperty('--body-bg', '#ffffff', 'important');
  const store = createMockStore();
  startThemes(store);
  store.getters.targetRoute.params.cluster = '_';
  store.update();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('#ffffff');
  expect(document.body.style.getPropertyPriority('--body-bg')).toBe('important');
  store.getters.targetRoute.params.cluster = 'production';
  store.update();
  stopThemes();
  expect(document.body.style.getPropertyValue('--body-bg')).toBe('#ffffff');
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
