# Rancher Cluster Themes

A Rancher UI extension that colors cluster pages using the cluster's existing
**Cluster Appearance → Badge Background Color**. It changes page, navigation,
table, modal, drawer and log surfaces. Clusters without a badge color retain
Rancher's normal appearance.

The 0.1.1 MVP was installed and its cluster theme verified in Rancher 2.15.2.

Use the brush button in a cluster's header to choose **Layered**, **Immersive**
or **Minimal**. The shared style applies to everyone unless they choose a
personal override, saved in their Rancher user preferences. Changing the shared
style requires permission to edit the cluster.

The shared style is stored in the `rancher-cluster-themes.local/style`
annotation. The default is `layered`; the legacy values `bold` and `soft` map
to `layered` and `minimal`. Badge colors must be 3- or 6-digit hex values.
Global pages and logging out restore the original appearance.

## Publish the Helm repository

The repository and its published extension assets must be public. Once, create
the `gh-pages` branch from `main` if it does not exist, and set
**Settings → Pages → Source** to **GitHub Actions**:

```sh
git push origin main:refs/heads/gh-pages
```

After pushing this workflow to `main`, publish the existing 0.1.1 release:

```sh
gh workflow run release-charts.yml --ref main \
  -f release_tag=rancher-cluster-themes-dev-0.1.1
```

Wait for **Publish extension Helm repository** to succeed. Its public URL is:

```text
https://fpm-git.github.io/rancher-cluster-themes
```

For future releases, update both `package.json` versions, commit the changes,
and publish a GitHub release tagged `rancher-cluster-themes-dev-<version>`.
The workflow preserves previous charts and extension files on `gh-pages`. Do
not reuse a published extension version. To redeploy already published assets
without rebuilding, run:

```sh
gh workflow run release-charts.yml --ref main \
  -f release_tag=rancher-cluster-themes-dev-0.1.1 -f redeploy=true
```

CI tests chart packaging and version retention; a separate job checks the
public index, chart and extension files after deployment. If deployment or
verification fails, rerun the failed jobs.

## Install in Rancher

1. In Rancher's local cluster, open **Apps → Repositories** and add the URL
   above as an HTTP Helm repository.
2. Reload **Extensions → Available** and install **Cluster Themes**.
3. When installation completes, click **Reload** in Rancher to load it.

Existing installations from the catalog image still depend on that catalog's
service. Do not remove it until those installations have been migrated.

## Development

Requires Node 24, Yarn 1 and a Rancher 2.15.2 test instance. The extension is
built against the exact Shell version in Rancher 2.15.2; other Rancher releases
have not been tested.

```sh
yarn install
yarn lint
yarn test:ci --runInBand
yarn tsc --noEmit -p pkg/rancher-cluster-themes/tsconfig.json
yarn build-pkg rancher-cluster-themes
```

For browser testing, follow Rancher's
[Developer Load instructions](https://extensions.rancher.io/extensions/next/extensions-getting-started#loading-into-rancher-in-a-quick-way-developer-load).
Run `yarn serve-pkgs`, enable extension developer features, then load the URL
printed by the server in **Extensions → Developer Load**. Use a test instance;
the browser must be able to reach the local server.

Test cluster switches, global pages, dark/light modes and alert readability before
installing for users. CSS tokens are Rancher internals and may change on upgrades.
If an extension prevents navigation, use [Safe Mode](https://extensions.rancher.io/extensions/next/advanced/safe-mode).
