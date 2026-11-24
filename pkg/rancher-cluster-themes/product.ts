import { startThemes, ThemeStore } from './themes';

export function init(_plugin: object, store: ThemeStore): void {
  startThemes(store);
}
