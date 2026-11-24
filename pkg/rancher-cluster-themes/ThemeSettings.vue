<script>
import { loadPreferences, personalColors, personalStyles, savePersonalColor, savePersonalStyle, saveSharedStyle, saveThemesEnabled, sharedStyle, STYLE_ANNOTATION, themesEnabled } from './preferences';
import { themeColor, themeTints } from './themes';

export default {
  emits: ['close'],
  data() {
    return {
      personal: 'shared',
      shared: '',
      enabled: false,
      savedEnabled: false,
      colorChoice: 'badge',
      loading: true,
      loadFailed: false,
      saving: false,
      error: '',
      message: '',
      openedClusterId: this.$store.getters.currentCluster?.id,
    };
  },
  computed: {
    cluster() {
      return this.$store.getters.currentCluster;
    },
    clusterId() {
      return this.cluster?.id;
    },
    isOriginalCluster() {
      return !!this.openedClusterId && this.clusterId === this.openedClusterId
        && this.$store.getters.targetRoute?.params?.cluster === this.openedClusterId;
    },
    color() {
      return themeColor(this.colorChoice, this.cluster?.metadata?.annotations?.['ui.rancher/badge-color']);
    },
    previewBase() {
      return this.$store.getters['prefs/theme'] === 'dark' ? '#171b20' : '#ffffff';
    },
    previews() {
      if (!this.color) return {};
      const dark = this.$store.getters['prefs/theme'] === 'dark';
      return Object.fromEntries(['subtle', 'minimal', 'layered', 'immersive'].map((preset) => {
        const tints = themeTints(preset, this.color, dark);
        if (!tints) return [preset, null];
        return [preset, {
          '--swatch-page': `color-mix(in srgb, ${this.previewBase} ${100 - tints.page}%, ${this.color} ${tints.page}%)`,
          '--swatch-chrome': `color-mix(in srgb, ${this.previewBase} ${100 - tints.chrome}%, ${this.color} ${tints.chrome}%)`,
        }];
      }));
    },
  },
  async mounted() {
    try {
      await loadPreferences(this.$store);
      this.personal = personalStyles(this.$store)[this.clusterId] || 'shared';
      this.enabled = themesEnabled(this.$store);
      this.savedEnabled = this.enabled;
      this.colorChoice = personalColors(this.$store)[this.clusterId] || 'badge';
      this.shared = sharedStyle(this.cluster?.metadata?.annotations?.[STYLE_ANNOTATION]) || '';
    } catch (error) {
      this.loadFailed = true;
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    async saveEnabled() {
      this.saving = true;
      this.error = '';
      this.message = '';
      try {
        await saveThemesEnabled(this.$store, this.enabled);
        this.savedEnabled = this.enabled;
        this.message = this.enabled ? 'Themes enabled for your account.' : 'Themes disabled for your account.';
      } catch (error) {
        this.enabled = this.savedEnabled;
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.saving = false;
      }
    },
    async saveColor() {
      this.saving = true;
      this.error = '';
      this.message = '';
      try {
        await savePersonalColor(this.$store, this.clusterId, this.colorChoice);
        this.message = 'Personal color saved.';
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.saving = false;
      }
    },
    async savePersonal() {
      this.saving = true;
      this.error = '';
      this.message = '';
      try {
        await savePersonalStyle(this.$store, this.clusterId, this.personal === 'shared' ? undefined : this.personal);
        this.message = 'Personal style saved.';
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.saving = false;
      }
    },
    async saveShared() {
      this.saving = true;
      this.error = '';
      this.message = '';
      try {
        await saveSharedStyle(this.$store, this.clusterId, this.shared);
        this.message = 'Shared cluster style saved.';
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <section class="cluster-themes-settings">
    <header>
      <div>
        <h2>Cluster Themes</h2>
        <p>Choose how {{ openedClusterId }} looks.</p>
      </div>
      <button type="button" class="cluster-themes-close" aria-label="Close" @click="$emit('close')">&times;</button>
    </header>

    <p v-if="loading">Loading settings...</p>
    <template v-else>
      <div v-if="color && previews.subtle" class="cluster-themes-preview" aria-label="Style previews">
        <div v-for="preset in ['subtle', 'minimal', 'layered', 'immersive']" :key="preset" class="cluster-themes-swatch" :style="previews[preset]">
          <span />
          <strong>{{ preset }}</strong>
        </div>
      </div>

      <p v-if="error" role="alert" class="cluster-themes-error">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <p v-if="!isOriginalCluster" role="alert">The cluster changed. Close these settings and open them again.</p>

      <label for="cluster-themes-enabled"><strong>Enable themes for my account</strong></label>
      <p>Off by default. This applies to all clusters and does not affect other users.</p>
      <div class="cluster-themes-row">
        <input id="cluster-themes-enabled" v-model="enabled" type="checkbox" :disabled="saving || loadFailed || !isOriginalCluster">
        <button type="button" :disabled="saving || loadFailed || !isOriginalCluster" @click="saveEnabled">Save account setting</button>
      </div>

      <label for="cluster-themes-personal"><strong>My style</strong></label>
      <p>Overrides the shared style for your Rancher account on this cluster.</p>
      <div class="cluster-themes-row">
        <select id="cluster-themes-personal" v-model="personal" :disabled="saving || loadFailed || !isOriginalCluster">
          <option value="shared">Use shared style</option>
          <option value="off">Off for this cluster</option>
          <option value="subtle">Subtle</option>
          <option value="layered">Layered</option>
          <option value="immersive">Immersive</option>
          <option value="minimal">Minimal</option>
        </select>
        <button type="button" :disabled="saving || loadFailed || !isOriginalCluster" @click="savePersonal">Save my style</button>
      </div>

      <label for="cluster-themes-color"><strong>My color</strong></label>
      <p>Only changes your theme, not the cluster badge or other users' colors.</p>
      <div class="cluster-themes-row">
        <select id="cluster-themes-color" v-model="colorChoice" :disabled="saving || loadFailed || !isOriginalCluster">
          <option value="badge">Cluster badge</option>
          <option value="complement">Complementary to badge</option>
          <option value="ocean">Ocean</option>
          <option value="teal">Teal</option>
          <option value="forest">Forest</option>
          <option value="plum">Plum</option>
          <option value="rose">Rose</option>
          <option value="amber">Amber</option>
        </select>
        <button type="button" :disabled="saving || loadFailed || !isOriginalCluster" @click="saveColor">Save my color</button>
      </div>
      <p v-if="!color">Choose a curated color or set a valid cluster badge color.</p>
      <p v-else-if="!previews.subtle" role="alert">Cannot verify Rancher's text colors; themes will not be applied.</p>

      <label for="cluster-themes-shared"><strong>Shared cluster style</strong></label>
      <p>Applies to users who enabled themes and have no personal style. Requires permission to edit this cluster.</p>
      <div class="cluster-themes-row">
        <select id="cluster-themes-shared" v-model="shared" :disabled="saving || loadFailed || !isOriginalCluster">
          <option disabled value="">Select a style</option>
          <option value="subtle">Subtle</option>
          <option value="layered">Layered</option>
          <option value="immersive">Immersive</option>
          <option value="minimal">Minimal</option>
        </select>
        <button type="button" :disabled="saving || loadFailed || !isOriginalCluster || !shared" @click="saveShared">Save shared style</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.cluster-themes-settings { padding: 24px; color: var(--body-text); background: var(--modal-bg); }
.cluster-themes-settings header { display: flex; justify-content: space-between; align-items: flex-start; }
.cluster-themes-settings h2 { margin: 0; }
.cluster-themes-settings p { margin: 6px 0 12px; }
.cluster-themes-settings label { display: block; margin-top: 20px; }
.cluster-themes-close { background: transparent; border: 0; color: inherit; font-size: 24px; cursor: pointer; }
.cluster-themes-preview { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin: 20px 0; }
.cluster-themes-swatch { flex: 1; min-width: 0; padding: 8px; border-radius: 6px; background: var(--swatch-page); color: var(--body-text); text-transform: capitalize; }
.cluster-themes-swatch span { display: block; height: 20px; margin-bottom: 12px; border-radius: 3px; background: var(--swatch-chrome); }
.cluster-themes-row { display: flex; gap: 8px; }
.cluster-themes-row select { flex: 1; }
.cluster-themes-row select, .cluster-themes-row button { padding: 8px; }
.cluster-themes-error { color: var(--error); }
</style>
