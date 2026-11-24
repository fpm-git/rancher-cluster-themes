# Rancher Cluster Themes

A Rancher UI extension that colors cluster pages using the cluster's existing
**Cluster Appearance → Badge Background Color**. It changes page, navigation,
table, modal, drawer and log surfaces. Clusters without a badge color retain
Rancher's normal appearance.

The default style is `bold`. Set the cluster annotation
`rancher-cluster-themes.local/style` to `soft` for a lighter tint, or `bold`
to restore the default. Colors must be 3- or 6-digit hex values. Global pages
and logging out restore the original appearance.

## Publish the catalog

The **CI** workflow builds and tests the catalog image but does not publish it.
Add a GitHub Actions repository secret named `GHCR_TOKEN` containing a token
with permission to write this GHCR package, and a repository variable named
`GHCR_USERNAME` containing the token owner's GitHub username.
To publish the first image, commit the intended changes on `main` and push them:

```sh
git push origin main
```

Create the tag on the intended commit if it does not already exist. If it does
exist, inspect it with `git show rancher-cluster-themes-dev-0.1.0` instead;
do not move an existing release tag.

```sh
git tag -a rancher-cluster-themes-dev-0.1.0 -m "Initial catalog release"
```

Push the tag and publish the GitHub release (requires the `gh` CLI):

```sh
git push origin rancher-cluster-themes-dev-0.1.0
gh release create rancher-cluster-themes-dev-0.1.0 --verify-tag \
  --title "Cluster Themes 0.1.0" --notes "Initial Cluster Themes release."
```

In **Actions**, wait for **Release extension catalog** to succeed.
To retry a release after fixing a publishing failure, run the workflow from
`main` using the existing release tag:

```sh
gh workflow run release-catalog.yml --ref main \
  -f release_tag=rancher-cluster-themes-dev-0.1.0
```

The expected image is:

```text
ghcr.io/fpm-git/ui-extension-rancher-cluster-themes-dev:0.1.0
```

For each release, update the root `package.json` version and use
`rancher-cluster-themes-dev-<version>` as the release tag. Also update the
extension package version when the extension changes.

## Install in Rancher

1. Ensure the Rancher cluster can pull the published image. For a private GHCR
   package, create a registry pull secret in `cattle-ui-plugin-system`.
2. In Rancher, open **Extensions** from the main menu.
3. Open the top-right action menu and select **Manage Extension Catalog**,
   then **Import Extension Catalog**.
4. Paste the image reference above into the image field. If the package is
   private, select the registry pull secret, then click **Load**.
5. Return to **Extensions**, select **Available**, and install **Cluster Themes**.

Importing the catalog creates Rancher-managed resources to serve it; it does not
install the extension until step 5.

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
