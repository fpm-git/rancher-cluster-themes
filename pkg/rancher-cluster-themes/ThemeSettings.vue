<script>
import { loadPreferences, personalStyles, savePersonalStyle, saveSharedStyle, sharedStyle, STYLE_ANNOTATION } from './preferences';

export default {
  emits: ['close'],
  data() {
    return {
      personal: 'shared',
      shared: '',
      loading: true,
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
      const color = this.cluster?.metadata?.annotations?.['ui.rancher/badge-color'];
      return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color || '') ? color : '#777777';
    },
    previewBase() {
      return this.$store.getters['prefs/theme'] === 'dark' ? '#171b20' : '#ffffff';
    },
  },
  async mounted() {
    try {
      await loadPreferences(this.$store);
      this.personal = personalStyles(this.$store)[this.clusterId] || 'shared';
      this.shared = sharedStyle(this.cluster?.metadata?.annotations?.[STYLE_ANNOTATION]) || '';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
    }
  },
  methods: {
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
      <div class="cluster-themes-preview" :style="{ '--preview-color': color, '--preview-base': previewBase }" aria-label="Style previews">
        <div v-for="preset in ['layered', 'immersive', 'minimal']" :key="preset" :class="['cluster-themes-swatch', preset]">
          <span />
          <strong>{{ preset }}</strong>
        </div>
      </div>

      <p v-if="error" role="alert" class="cluster-themes-error">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <p v-if="!isOriginalCluster" role="alert">The cluster changed. Close these settings and open them again.</p>

      <label for="cluster-themes-personal"><strong>My style</strong></label>
      <p>Overrides the shared style for your Rancher account on this cluster.</p>
      <div class="cluster-themes-row">
        <select id="cluster-themes-personal" v-model="personal" :disabled="saving || !isOriginalCluster">
          <option value="shared">Use shared style</option>
          <option value="layered">Layered</option>
          <option value="immersive">Immersive</option>
          <option value="minimal">Minimal</option>
        </select>
        <button type="button" :disabled="saving || !isOriginalCluster" @click="savePersonal">Save my style</button>
      </div>

      <label for="cluster-themes-shared"><strong>Shared cluster style</strong></label>
      <p>Applies to everyone without a personal override. Requires permission to edit this cluster.</p>
      <div class="cluster-themes-row">
        <select id="cluster-themes-shared" v-model="shared" :disabled="saving || !isOriginalCluster">
          <option disabled value="">Select a style</option>
          <option value="layered">Layered</option>
          <option value="immersive">Immersive</option>
          <option value="minimal">Minimal</option>
        </select>
        <button type="button" :disabled="saving || !isOriginalCluster || !shared" @click="saveShared">Save shared style</button>
      </div>
      <p>The cluster's badge color supplies the theme color.</p>
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
.cluster-themes-preview { display: flex; gap: 8px; margin: 20px 0; }
.cluster-themes-swatch { flex: 1; padding: 8px; border-radius: 6px; background: color-mix(in srgb, var(--preview-base) 92%, var(--preview-color) 8%); color: var(--body-text); text-transform: capitalize; }
.cluster-themes-swatch span { display: block; height: 20px; margin-bottom: 12px; border-radius: 3px; background: color-mix(in srgb, var(--preview-base) 81%, var(--preview-color) 19%); }
.cluster-themes-swatch.immersive { background: color-mix(in srgb, var(--preview-base) 82%, var(--preview-color) 18%); }
.cluster-themes-swatch.immersive span { background: color-mix(in srgb, var(--preview-base) 70%, var(--preview-color) 30%); }
.cluster-themes-swatch.minimal { background: color-mix(in srgb, var(--preview-base) 96%, var(--preview-color) 4%); }
.cluster-themes-swatch.minimal span { background: color-mix(in srgb, var(--preview-base) 90%, var(--preview-color) 10%); }
.cluster-themes-row { display: flex; gap: 8px; }
.cluster-themes-row select { flex: 1; }
.cluster-themes-row select, .cluster-themes-row button { padding: 8px; }
.cluster-themes-error { color: var(--error); }
</style>
