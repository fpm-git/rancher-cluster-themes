#!/usr/bin/env bash
set -euo pipefail

repo_root=$1
test_dir=$2
test ! -e "$test_dir"
mkdir -p "$test_dir/bin" "$test_dir/page/assets/rancher-cluster-themes" "$test_dir/raw"
export HELM_CACHE_HOME="$test_dir/helm-cache"
export HELM_CONFIG_HOME="$test_dir/helm-config"
export HELM_DATA_HOME="$test_dir/helm-data"
export GITHUB_REPOSITORY=fpm-git/rancher-cluster-themes
export FAKE_ROOT="$test_dir"

cat > "$test_dir/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
url=
output=
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output=$2; shift 2 ;;
    --connect-timeout|--max-time|--retry|--retry-delay) shift 2 ;;
    -fsSL|--retry-all-errors) shift ;;
    *) url=$1; shift ;;
  esac
done
case "$url" in
  https://example.invalid/*) file="$FAKE_ROOT/page/${url#https://example.invalid/}" ;;
  https://raw.githubusercontent.com/fpm-git/rancher-cluster-themes/gh-pages/*)
    file="$FAKE_ROOT/raw/${url#https://raw.githubusercontent.com/fpm-git/rancher-cluster-themes/gh-pages/}" ;;
  *) echo "Unexpected URL: $url" >&2; exit 1 ;;
esac
cp "$file" "$output"
EOF
chmod +x "$test_dir/bin/curl"
export PATH="$test_dir/bin:$PATH"

mkdir -p "$test_dir/chart"
cat > "$test_dir/page/index.yaml" <<'EOF'
apiVersion: v1
entries:
  rancher-cluster-themes:
    - version: 0.2.0
      urls: [assets/rancher-cluster-themes/rancher-cluster-themes-0.2.0.tgz]
    - version: 0.1.1
      urls: [assets/rancher-cluster-themes/rancher-cluster-themes-0.1.1.tgz]
EOF

for version in 0.1.1 0.2.0; do
  endpoint="https://raw.githubusercontent.com/$GITHUB_REPOSITORY/gh-pages/extensions/rancher-cluster-themes/$version"
  cat > "$test_dir/chart/Chart.yaml" <<EOF
apiVersion: v2
name: rancher-cluster-themes
version: $version
annotations:
  catalog.cattle.io/ui-component: plugins
EOF
  cat > "$test_dir/chart/values.yaml" <<EOF
plugin:
  endpoint: $endpoint
  compressedEndpoint: $endpoint.tgz
EOF
  helm package "$test_dir/chart" --destination "$test_dir/page/assets/rancher-cluster-themes" > /dev/null
  asset_dir="$test_dir/raw/extensions/rancher-cluster-themes"
  mkdir -p "$asset_dir/$version/plugin"
  printf 'extension %s\n' "$version" > "$asset_dir/$version/plugin/rancher-cluster-themes-$version.umd.min.js"
  tar -czf "$asset_dir/$version.tgz" -C "$asset_dir" "$version"
done

check() {
  bash "$repo_root/scripts/check-published-repository.sh" https://example.invalid "$test_dir/check"
}
check

old_script="$test_dir/raw/extensions/rancher-cluster-themes/0.1.1/plugin/rancher-cluster-themes-0.1.1.umd.min.js"
mv "$old_script" "$old_script.saved"
if check; then
  echo "Missing older extension must fail the check" >&2
  exit 1
fi
mv "$old_script.saved" "$old_script"
printf 'different extension\n' > "$old_script"
if check; then
  echo "Extension differing from its archive must fail the check" >&2
  exit 1
fi
tar -xOzf "$test_dir/raw/extensions/rancher-cluster-themes/0.1.1.tgz" \
  0.1.1/plugin/rancher-cluster-themes-0.1.1.umd.min.js > "$old_script"
sed -i 's|assets/rancher-cluster-themes/rancher-cluster-themes-0.2.0.tgz|https://example.invalid/unexpected.tgz|' "$test_dir/page/index.yaml"
if check; then
  echo "Unexpected chart URL must fail the check" >&2
  exit 1
fi
