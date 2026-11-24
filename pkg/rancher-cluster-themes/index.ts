import { IPlugin } from '@shell/core/types';
import { currentStore, startThemes, stopThemes } from './themes';
import ThemeSettings from './ThemeSettings.vue';

export default function(plugin: Pick<IPlugin, 'metadata' | 'addProduct' | 'addUninstallHook' | 'addNavHooks' | 'addAction' | 'register'>): void {
  plugin.metadata = require('./package.json');
  plugin.addProduct(require('./product'));
  plugin.register('dialog', 'ClusterThemesSettings', () => Promise.resolve(ThemeSettings));
  plugin.addAction('header-action', {}, {
    label: 'Cluster Themes',
    icon: 'icon-brush-icon',
    tooltip: 'Cluster themes',
    enabled: (context: { $route: { params: { cluster?: string } } }) => {
      const id = context.$route.params.cluster;
      return !!id && id !== '_';
    },
    invoke: () => {
      const store = currentStore();
      if (!store) {
        console.error('Cluster Themes: settings are unavailable.');
        return;
      }
      const id = store.getters.targetRoute?.params?.cluster;
      if (!id || id !== store.getters.clusterId || id !== store.getters.currentCluster?.id) {
        void store.dispatch('growl/error', {
          title: 'Cluster Themes',
          message: 'Cluster information is not ready. Try again once the cluster has loaded.',
        }).catch((error) => console.error('Cluster Themes: could not show an error.', error));
        return;
      }
      void store.dispatch('management/promptModal', {
        component: 'ClusterThemesSettings',
        modalWidth: '600px',
      }).catch((error) => console.error('Cluster Themes: could not open settings.', error));
    },
  });
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
