import { createStore } from 'vuex';
import * as prefs from '@shell/store/prefs';
import { loadPreferences, personalStyles, PREFERENCE, registerPreference, savePersonalStyle, saveSharedStyle, sharedStyle, STYLE_ANNOTATION } from '../preferences';

test('loads and saves account overrides through the Rancher preferences store', async () => {
  const resource = {
    data: { [PREFERENCE]: JSON.stringify({ 'c-123': 'minimal' }) },
    save: jest.fn().mockResolvedValue(undefined),
  };
  const store = createStore({
    modules: {
      prefs: { namespaced: true, state: prefs.state, getters: prefs.getters, mutations: prefs.mutations, actions: prefs.actions },
      management: { namespaced: true, actions: { findAll: () => [resource] } },
    },
  });
  registerPreference(store);
  await loadPreferences(store);
  expect(personalStyles(store)).toEqual({ 'c-123': 'minimal' });
  await savePersonalStyle(store, 'c-123', 'immersive');
  expect(personalStyles(store)).toEqual({ 'c-123': 'immersive' });
  expect(resource.save).toHaveBeenCalledWith({ redirectUnauthorized: false });
});

test('keeps existing users preferences when saving or clearing a personal override', async () => {
  const resource = {
    data: { [PREFERENCE]: JSON.stringify({ other: 'minimal', current: 'layered' }), unrelated: 'keep' },
    save: jest.fn().mockResolvedValue(undefined),
  };
  const store = {
    getters: { 'prefs/get': () => ({}) },
    commit: jest.fn(),
    dispatch: jest.fn().mockResolvedValue(resource),
  };
  await savePersonalStyle(store, 'current', 'immersive');
  expect(JSON.parse(resource.data[PREFERENCE])).toEqual({ other: 'minimal', current: 'immersive' });
  expect(resource.data.unrelated).toBe('keep');
  expect(store.commit).toHaveBeenLastCalledWith('prefs/load', { key: PREFERENCE, value: { other: 'minimal', current: 'immersive' } });
  await savePersonalStyle(store, 'current');
  expect(JSON.parse(resource.data[PREFERENCE])).toEqual({ other: 'minimal' });
});

test('does not apply a personal preference when saving fails', async () => {
  const resource = { data: {}, save: jest.fn().mockRejectedValue(new Error('forbidden')) };
  const store = { getters: { 'prefs/get': () => ({}) }, commit: jest.fn(), dispatch: jest.fn().mockResolvedValue(resource) };
  await expect(savePersonalStyle(store, 'current', 'layered')).rejects.toThrow('forbidden');
  expect(store.commit).not.toHaveBeenCalled();
});

test('updates only the shared theme annotation and restores it on failure', async () => {
  const cluster = {
    annotations: { [STYLE_ANNOTATION]: 'bold', other: 'keep' },
    save: jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('forbidden')),
  };
  const store = { getters: { 'prefs/get': () => ({}) }, commit: jest.fn(), dispatch: jest.fn().mockResolvedValue(cluster) };
  await saveSharedStyle(store, 'c-123', 'minimal');
  expect(cluster.annotations).toEqual({ [STYLE_ANNOTATION]: 'minimal', other: 'keep' });
  await expect(saveSharedStyle(store, 'c-123', 'immersive')).rejects.toThrow('forbidden');
  expect(cluster.annotations[STYLE_ANNOTATION]).toBe('minimal');
});

test('recognizes existing style annotations', () => {
  expect(sharedStyle('bold')).toBe('layered');
  expect(sharedStyle('soft')).toBe('minimal');
  expect(sharedStyle('unexpected')).toBeUndefined();
});
