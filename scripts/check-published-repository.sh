#!/usr/bin/env bash
set -euo pipefail

page_url=${1%/}
work_dir=$2
chart=rancher-cluster-themes
mkdir -p "$work_dir"

fetch() {
  curl -fsSL --connect-timeout 15 --max-time 120 --retry 3 --retry-delay 5 --retry-all-errors "$1" -o "$2"
}

fetch "$page_url/index.yaml" "$work_dir/index.yaml"
yq -e '.entries."rancher-cluster-themes" | length > 0' "$work_dir/index.yaml" > /dev/null
yq -r '.entries."rancher-cluster-themes"[].version' "$work_dir/index.yaml" > "$work_dir/versions"
test -s "$work_dir/versions"

while IFS= read -r version; do
  if [[ ! "$version" =~ ^[0-9A-Za-z][0-9A-Za-z.+-]*$ ]]; then
    echo "Invalid chart version in index: $version" >&2
    exit 1
  fi
  export version
  chart_url="$(yq -r '.entries."rancher-cluster-themes"[] | select(.version == strenv(version)) | .urls[0]' "$work_dir/index.yaml")"
  if [ "$chart_url" != "assets/$chart/$chart-$version.tgz" ]; then
    echo "Unexpected chart URL for $version" >&2
    exit 1
  fi
  echo "Checking $chart $version"
  fetch "$page_url/$chart_url" "$work_dir/chart.tgz"
  helm show chart "$work_dir/chart.tgz" > "$work_dir/chart.yaml"
  yq -e '.name == "rancher-cluster-themes" and .version == strenv(version) and .annotations."catalog.cattle.io/ui-component" == "plugins"' "$work_dir/chart.yaml" > /dev/null
  helm show values "$work_dir/chart.tgz" > "$work_dir/values.yaml"
  endpoint="https://raw.githubusercontent.com/$GITHUB_REPOSITORY/gh-pages/extensions/$chart/$version"
  if [ "$(yq -r '.plugin.endpoint' "$work_dir/values.yaml")" != "$endpoint" ] ||
     [ "$(yq -r '.plugin.compressedEndpoint' "$work_dir/values.yaml")" != "$endpoint.tgz" ]; then
    echo "Unexpected extension endpoints for $version" >&2
    exit 1
  fi
  script="$version/plugin/$chart-$version.umd.min.js"
  fetch "$endpoint.tgz" "$work_dir/extension.tgz"
  tar -xOzf "$work_dir/extension.tgz" "$script" > "$work_dir/bundled.js"
  fetch "$endpoint/plugin/$chart-$version.umd.min.js" "$work_dir/extension.js"
  test -s "$work_dir/extension.js"
  cmp "$work_dir/bundled.js" "$work_dir/extension.js"
done < "$work_dir/versions"
