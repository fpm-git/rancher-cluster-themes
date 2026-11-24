#!/usr/bin/env bash
set -euo pipefail

repo_root=$1
test_dir=$2
test ! -e "$test_dir"
mkdir -p "$test_dir/site"
export GITHUB_REPOSITORY=fpm-git/rancher-cluster-themes

build_version() {
  local source_dir="$test_dir/$1"
  git clone --quiet --no-hardlinks "$repo_root" "$source_dir"
  git -C "$source_dir" branch gh-pages
  ln -s "$repo_root/node_modules" "$source_dir/node_modules"
  if [ "$1" = old ]; then
    node -e '
      const fs = require("fs");
      for (const file of process.argv.slice(1)) {
        const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
        pkg.version = "0.0.0";
        fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
      }
    ' "$source_dir/package.json" "$source_dir/pkg/rancher-cluster-themes/package.json"
  fi
  mkdir -p "$source_dir/assets"
  if [ -f "$test_dir/site/index.yaml" ]; then
    cp "$test_dir/site/index.yaml" "$source_dir/index.yaml"
  else
    helm repo index "$source_dir/assets" --url assets/
    cp "$source_dir/assets/index.yaml" "$source_dir/index.yaml"
  fi
  (cd "$source_dir" && yarn publish-pkgs -s "$GITHUB_REPOSITORY" -b gh-pages -n)
  bash "$repo_root/scripts/merge-helm-repository.sh" "$source_dir" "$test_dir/site"
}

chart=rancher-cluster-themes
version="$(node -p 'require(process.argv[1]).version' "$repo_root/pkg/rancher-cluster-themes/package.json")"
if [ "$version" = 0.0.0 ]; then
  echo "The current version must differ from the old-version fixture." >&2
  exit 1
fi

build_version old
build_version new

for current in 0.0.0 "$version"; do
  CURRENT_VERSION="$current" yq -e \
    '.entries."rancher-cluster-themes"[] | select(.version == strenv(CURRENT_VERSION))' \
    "$test_dir/site/index.yaml" > /dev/null
  url="$(CURRENT_VERSION="$current" yq -r \
    '.entries."rancher-cluster-themes"[] | select(.version == strenv(CURRENT_VERSION)) | .urls[0]' \
    "$test_dir/site/index.yaml")"
  test "$url" = "assets/$chart/$chart-$current.tgz"
  test -s "$test_dir/site/assets/$chart/$chart-$current.tgz"
  test -s "$test_dir/site/extensions/$chart/$current.tgz"
  test -s "$test_dir/site/extensions/$chart/$current/plugin/$chart-$current.umd.min.js"
done
cmp "$test_dir/old/assets/$chart/$chart-0.0.0.tgz" \
  "$test_dir/site/assets/$chart/$chart-0.0.0.tgz"
cmp "$test_dir/old/tmp/extensions/$chart/0.0.0.tgz" \
  "$test_dir/site/extensions/$chart/0.0.0.tgz"
cmp "$test_dir/old/tmp/extensions/$chart/0.0.0/plugin/$chart-0.0.0.umd.min.js" \
  "$test_dir/site/extensions/$chart/0.0.0/plugin/$chart-0.0.0.umd.min.js"
if bash "$repo_root/scripts/merge-helm-repository.sh" "$test_dir/new" "$test_dir/site"; then
  echo "Republishing an existing chart version must fail." >&2
  exit 1
fi
