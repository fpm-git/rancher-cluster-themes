import { IPlugin } from '@shell/core/types';
import { startThemes, stopThemes } from './themes';

export default function(plugin: Pick<IPlugin, 'metadata' | 'addProduct' | 'addUninstallHook' | 'addNavHooks'>): void {
  plugin.metadata = require('./package.json');
  plugin.addProduct(require('./product'));
  plugin.addUninstallHook(stopThemes);
  plugin.addNavHooks({
    async onLogin(store) {
      startThemes(store);
    },
    async onLogout() {
      stopThemes();
    },
  });
}
