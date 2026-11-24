# Rancher Cluster Themes

A Rancher UI extension that colors cluster pages. It changes page, navigation,
table, modal and drawer surfaces. Log and terminal colors remain unchanged to
preserve their own text and highlight contrast.

Versions 0.1.1 and 0.2.0 were installed and visually verified in Rancher 2.15.2.

Themes are **off by default for every account**, including existing users.
Use the brush button in a cluster's header to enable them for your account,
then choose a style and color. **Subtle** is fainter than **Minimal**; you can
also turn them off for an individual cluster. Personal settings are saved in
Rancher user preferences and do not affect other users.

Colors can follow the cluster badge, its complementary hue, or a curated
palette. A curated color works even without a badge color. The shared style
applies only to users who enable themes and have no personal style override.
Changing it requires permission to edit the cluster. Style previews are
illustrative; actual colors depend on Rancher's active theme.

The shared style is stored in the `rancher-cluster-themes.local/style`
annotation. The default is `layered`; the legacy values `bold` and `soft` map
to `layered` and `minimal`. Badge-based colors require a 3- or 6-digit hex badge.
Existing per-cluster style preferences remain saved when themes are disabled.
Global pages and logging out restore the original appearance.

## Publish the Helm repository

The repository and its published extension assets must be public. Once, create
the `gh-pages` branch from `main` if it does not exist, and set
**Settings → Pages → Source** to **GitHub Actions**:

```sh
git push origin main:refs/heads/gh-pages
```

If the `github-pages` environment restricts deployment refs, allow release tags
matching `rancher-cluster-themes-dev-*` as well as `main`.

To publish a release whose assets have not already been published, for example:

```sh
gh workflow run release-charts.yml --ref main \
  -f release_tag=rancher-cluster-themes-dev-0.2.0
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
  -f release_tag=rancher-cluster-themes-dev-0.2.0 -f redeploy=true
```

CI tests chart packaging and version retention; a separate job checks the
public index, chart and extension files after deployment. If deployment or
verification fails, rerun the failed jobs.

Dependabot proposes weekly dependency and GitHub Actions updates for review.
The Rancher Shell pin is excluded, including from Dependabot security-update
PRs; check security alerts and evaluate Shell changes against the target Rancher
version separately. A weekly workflow checks all published chart versions and
extension files. Enable GitHub Actions failure notifications: checks detect
problems but do not repair outages, publish updates, or upgrade installations.
Review the nested extension manifest's development dependencies separately.
Scheduled workflows in public repositories can be disabled after 60 days without
repository activity; use independent monitoring for critical availability.

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
Rancher's original surface colors are tinted rather than replaced, preserving
table groups, hover states and section shading. The tint is reduced to maintain
4.5:1 body-text and link contrast where the untinted background already meets it,
and otherwise not worsen it. If required background or text colors cannot be
resolved, the theme is not applied. Other UI elements still
need visual checks in both light and dark modes. Named, HSL and opaque hex
colors are resolved by the browser before contrast is checked. See
[WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
[non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
and [Material color guidance](https://m3.material.io/styles/color/system/overview).
If an extension prevents navigation, use [Safe Mode](https://extensions.rancher.io/extensions/next/advanced/safe-mode).
