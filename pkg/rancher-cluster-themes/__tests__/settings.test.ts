import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import ThemeSettings from '../ThemeSettings.vue';
import { COLOR_PREFERENCE, ENABLED_PREFERENCE, PREFERENCE } from '../preferences';

beforeEach(() => {
  document.body.style.setProperty('--body-text', '#111111');
  document.body.style.setProperty('--link', '#3458a8');
});

afterEach(() => {
  document.body.removeAttribute('style');
});

test('settings save a personal style and show shared-save errors', async () => {
  const preference = { data: {}, save: jest.fn().mockResolvedValue(undefined) };
  const cluster = { annotations: { 'rancher-cluster-themes.local/style': 'bold' }, save: jest.fn().mockRejectedValue(new Error('forbidden')) };
  const store = {
    getters: {
      currentCluster: { id: 'c-123', metadata: { annotations: { 'ui.rancher/badge-color': '#f00' } } },
      targetRoute: { params: { cluster: 'c-123' } },
      'prefs/get': (key: string) => key === ENABLED_PREFERENCE ? false : {},
    },
    dispatch: jest.fn((type: string) => Promise.resolve(type === 'rancher/find' ? cluster : preference)),
    commit: jest.fn(),
  };
  const wrapper = mount(ThemeSettings, { global: { mocks: { $store: store } } });
  await flushPromises();
  await wrapper.get('#cluster-themes-personal').setValue('immersive');
  await wrapper.findAll('button').find((button) => button.text() === 'Save my style')!.trigger('click');
  await flushPromises();
  expect(preference.save).toHaveBeenCalled();
  expect(store.commit).toHaveBeenCalledWith('prefs/load', { key: PREFERENCE, value: { 'c-123': 'immersive' } });
  expect(wrapper.get('[role="status"]').text()).toContain('Personal style saved');
  await wrapper.get('#cluster-themes-shared').setValue('minimal');
  await wrapper.findAll('button').find((button) => button.text() === 'Save shared style')!.trigger('click');
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('forbidden');
  expect(cluster.annotations['rancher-cluster-themes.local/style']).toBe('bold');
});

test('disables settings if the current cluster changes while the dialog is open', async () => {
  const store = {
    getters: reactive({
      currentCluster: { id: 'c-123', metadata: { annotations: {} } },
      targetRoute: { params: { cluster: 'c-123' } },
      'prefs/get': (key: string) => key === ENABLED_PREFERENCE ? false : {},
    }),
    dispatch: jest.fn().mockResolvedValue({ data: {} }),
  };
  const wrapper = mount(ThemeSettings, { global: { mocks: { $store: store } } });
  await flushPromises();
  store.getters.targetRoute.params.cluster = 'c-456';
  await nextTick();
  expect(wrapper.get('#cluster-themes-shared').attributes('disabled')).toBeDefined();
  expect(wrapper.get('[role="alert"]').text()).toContain('cluster changed');
});

test('settings opt in for the account and save a personal color', async () => {
  const preference = { data: {}, save: jest.fn().mockResolvedValue(undefined) };
  const store = {
    getters: {
      currentCluster: { id: 'c-123', metadata: { annotations: { 'ui.rancher/badge-color': '#f00' } } },
      targetRoute: { params: { cluster: 'c-123' } },
      'prefs/get': (key: string) => key === ENABLED_PREFERENCE ? false : {},
    },
    dispatch: jest.fn().mockResolvedValue(preference),
    commit: jest.fn(),
  };
  const wrapper = mount(ThemeSettings, { global: { mocks: { $store: store } } });
  await flushPromises();
  for (const button of wrapper.findAll('.cluster-themes-row button')) {
    expect(button.classes()).toEqual(expect.arrayContaining(['btn', 'role-primary']));
  }
  expect((wrapper.get('#cluster-themes-enabled').element as HTMLInputElement).checked).toBe(false);
  await wrapper.get('#cluster-themes-enabled').setValue(true);
  await wrapper.findAll('button').find((button) => button.text() === 'Save account setting')!.trigger('click');
  await flushPromises();
  expect(store.commit).toHaveBeenCalledWith('prefs/load', { key: ENABLED_PREFERENCE, value: true });
  await wrapper.get('#cluster-themes-color').setValue('plum');
  await wrapper.findAll('button').find((button) => button.text() === 'Save my color')!.trigger('click');
  await flushPromises();
  expect(store.commit).toHaveBeenCalledWith('prefs/load', { key: COLOR_PREFERENCE, value: { 'c-123': 'plum' } });
});

test('disables settings when preferences cannot be loaded', async () => {
  const store = {
    getters: {
      currentCluster: { id: 'c-123', metadata: { annotations: {} } },
      targetRoute: { params: { cluster: 'c-123' } },
      'prefs/get': (key: string) => key === ENABLED_PREFERENCE ? false : {},
    },
    dispatch: jest.fn().mockRejectedValue(new Error('preferences unavailable')),
  };
  const wrapper = mount(ThemeSettings, { global: { mocks: { $store: store } } });
  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toContain('preferences unavailable');
  expect(wrapper.get('#cluster-themes-enabled').attributes('disabled')).toBeDefined();
  expect(wrapper.get('#cluster-themes-color').attributes('disabled')).toBeDefined();
});

test('shows dark-mode previews when Rancher uses browser-normalized text colors', async () => {
  document.body.style.setProperty('--body-text', '#ffffffff');
  document.body.style.setProperty('--link', 'hsl(218, 96%, 80%)');
  const store = {
    getters: {
      currentCluster: { id: 'c-123', metadata: { annotations: { 'ui.rancher/badge-color': '#f00' } } },
      targetRoute: { params: { cluster: 'c-123' } },
      'prefs/theme': 'dark',
      'prefs/get': (key: string) => key === ENABLED_PREFERENCE ? false : {},
    },
    dispatch: jest.fn().mockResolvedValue({ data: {} }),
  };
  const wrapper = mount(ThemeSettings, { global: { mocks: { $store: store } } });
  await flushPromises();
  expect(wrapper.findAll('.cluster-themes-swatch')).toHaveLength(4);
  expect(wrapper.text()).not.toContain("Cannot verify Rancher's text colors");
});
