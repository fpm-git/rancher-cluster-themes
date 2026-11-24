import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import ThemeSettings from '../ThemeSettings.vue';
import { PREFERENCE } from '../preferences';

test('settings save a personal style and show shared-save errors', async () => {
  const preference = { data: {}, save: jest.fn().mockResolvedValue(undefined) };
  const cluster = { annotations: { 'rancher-cluster-themes.local/style': 'bold' }, save: jest.fn().mockRejectedValue(new Error('forbidden')) };
  const store = {
    getters: {
      currentCluster: { id: 'c-123', metadata: { annotations: { 'ui.rancher/badge-color': '#f00' } } },
      targetRoute: { params: { cluster: 'c-123' } },
      'prefs/get': () => ({}),
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
      'prefs/get': () => ({}),
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
