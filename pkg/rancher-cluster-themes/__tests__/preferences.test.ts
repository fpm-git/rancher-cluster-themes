import { createStore } from 'vuex';
import * as prefs from '@shell/store/prefs';
import { COLOR_PREFERENCE, ENABLED_PREFERENCE, loadPreferences, personalColors, personalStyles, PREFERENCE, registerPreference, savePersonalColor, savePersonalStyle, saveSharedStyle, saveThemesEnabled, sharedStyle, STYLE_ANNOTATION, themesEnabled } from '../preferences';

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
  expect(themesEnabled(store)).toBe(false);
  await savePersonalStyle(store, 'c-123', 'immersive');
  expect(personalStyles(store)).toEqual({ 'c-123': 'immersive' });
  await saveThemesEnabled(store, true);
  await savePersonalColor(store, 'c-123', 'teal');
  expect(themesEnabled(store)).toBe(true);
  expect(personalColors(store)).toEqual({ 'c-123': 'teal' });
  expect(resource.save).toHaveBeenCalledWith({ redirectUnauthorized: false });
});

test('saves account opt-in and independent per-cluster colors without losing preferences', async () => {
  const resource = {
    data: { [PREFERENCE]: JSON.stringify({ current: 'minimal' }), [COLOR_PREFERENCE]: JSON.stringify({ other: 'teal' }) } as Record<string, string>,
    save: jest.fn().mockResolvedValue(undefined),
  };
  const store = {
    getters: { 'prefs/get': (key: string) => key === ENABLED_PREFERENCE ? false : {} },
    commit: jest.fn(),
    dispatch: jest.fn().mockResolvedValue(resource),
  };
  await saveThemesEnabled(store, true);
  expect(JSON.parse(resource.data[ENABLED_PREFERENCE])).toBe(true);
  expect(JSON.parse(resource.data[PREFERENCE])).toEqual({ current: 'minimal' });
  await savePersonalColor(store, 'current', 'ocean');
  expect(JSON.parse(resource.data[COLOR_PREFERENCE])).toEqual({ other: 'teal', current: 'ocean' });
  await savePersonalColor(store, 'current', 'badge');
  expect(JSON.parse(resource.data[COLOR_PREFERENCE])).toEqual({ other: 'teal' });
  expect(personalColors(store)).toEqual({});
});

test('restores enabled and color preferences if saving fails', async () => {
  const resource = {
    data: { [ENABLED_PREFERENCE]: 'true', [COLOR_PREFERENCE]: JSON.stringify({ c: 'teal' }) },
    save: jest.fn().mockRejectedValue(new Error('forbidden')),
  };
  const store = { getters: { 'prefs/get': () => ({}) }, commit: jest.fn(), dispatch: jest.fn().mockResolvedValue(resource) };
  await expect(saveThemesEnabled(store, false)).rejects.toThrow('forbidden');
  await expect(savePersonalColor(store, 'c', 'plum')).rejects.toThrow('forbidden');
  expect(resource.data[ENABLED_PREFERENCE]).toBe('true');
  expect(JSON.parse(resource.data[COLOR_PREFERENCE])).toEqual({ c: 'teal' });
  expect(store.commit).not.toHaveBeenCalled();
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
