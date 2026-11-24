# Rancher Cluster Themes

A Rancher UI extension that colors cluster pages using the cluster's existing
**Cluster Appearance → Badge Background Color**. It changes page, navigation,
table, modal, drawer and log surfaces. Clusters without a badge color retain
Rancher's normal appearance.

The default style is `bold`. Set the cluster annotation
`rancher-cluster-themes.local/style` to `soft` for a lighter tint, or `bold`
to restore the default. Colors must be 3- or 6-digit hex values. Global pages
and logging out restore the original appearance.

## Development

Requires Node 24, Yarn 1 and a Rancher 2.15.2 test instance. The extension is
built against the exact Shell version in Rancher 2.15.2; other Rancher releases
have not been tested.

```sh
yarn install
yarn lint
yarn test:ci --runInBand
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
