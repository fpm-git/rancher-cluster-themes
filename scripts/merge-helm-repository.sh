#!/usr/bin/env bash
set -euo pipefail

source_dir=$1
site_dir=$2
cd "$source_dir"

chart="$(node -p "require('./pkg/rancher-cluster-themes/package.json').name")"
version="$(node -p "require('./pkg/rancher-cluster-themes/package.json').version")"
archive="assets/$chart/$chart-$version.tgz"
bundle="tmp/extensions/$chart/$version.tgz"
script="tmp/extensions/$chart/$version/plugin/$chart-$version.umd.min.js"

if [ -e "$site_dir/$archive" ] ||
   [ -e "$site_dir/extensions/$chart/$version" ] ||
   [ -e "$site_dir/extensions/$chart/$version.tgz" ]; then
  echo "Chart $chart-$version is already published; use a new version." >&2
  exit 1
fi

test -s "$archive"
test -s "$bundle"
test -s "$script"
tar -tzf "$bundle" | grep -Fx "$version/plugin/$chart-$version.umd.min.js"
helm show chart "$archive" |
  yq -e '.annotations."catalog.cattle.io/ui-component" == "plugins"'
helm show chart "$archive" | yq -o=json | node -e '
  const fs = require("fs");
  const chart = JSON.parse(fs.readFileSync(0, "utf8"));
  const pkg = require("./pkg/rancher-cluster-themes/package.json");
  const annotations = chart.annotations || {};
  const host = "catalog.cattle.io/ui-extensions-host";
  if (chart.name !== pkg.name || chart.version !== pkg.version ||
      Object.entries(pkg.rancher.annotations).some(([key, value]) => annotations[key] !== value) ||
      (!Object.hasOwn(pkg.rancher.annotations, host) && annotations[host] !== undefined)) {
    console.error("Chart metadata does not match the extension package.");
    process.exit(1);
  }
'

expected="https://raw.githubusercontent.com/$GITHUB_REPOSITORY/gh-pages/extensions/$chart/$version"
endpoint="$(helm show values "$archive" | yq -r '.plugin.endpoint')"
compressed="$(helm show values "$archive" | yq -r '.plugin.compressedEndpoint')"
if [ "$endpoint" != "$expected" ] || [ "$compressed" != "$expected.tgz" ]; then
  echo "Chart has unexpected extension endpoints." >&2
  exit 1
fi

if [ -f "$site_dir/index.yaml" ]; then
  helm repo index assets --url assets/ --merge "$site_dir/index.yaml"
else
  helm repo index assets --url assets/
fi
mkdir -p "$site_dir/assets" "$site_dir/extensions"
cp -a tmp/assets/. "$site_dir/assets/"
cp -a tmp/extensions/. "$site_dir/extensions/"
cp assets/index.yaml "$site_dir/index.yaml"
