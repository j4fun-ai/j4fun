#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/j4fun-pages.XXXXXX")"
RELEASE_VERSION="1.0"
GIT_REVISION="$(git -C "$PROJECT_DIR" rev-parse --short=7 HEAD)"

if [[ -n "$(git -C "$PROJECT_DIR" status --short)" ]]; then
  GIT_REVISION="${GIT_REVISION}-dirty"
fi

BUILD_VERSION="v${RELEASE_VERSION} · build ${GIT_REVISION}"

cleanup() {
  rm -rf "$DEPLOY_DIR"
}
trap cleanup EXIT

echo "Checking 识本…"
pnpm --dir "$PROJECT_DIR/shiben-dev" check

echo "Building the Cloudflare version of 识本…"
SHIBEN_BASE_PATH="/shiben/" \
SHIBEN_OUT_DIR="$DEPLOY_DIR/shiben" \
pnpm --dir "$PROJECT_DIR/shiben-dev" build:static

echo "Collecting production files…"
for source_page in "$PROJECT_DIR"/*.html; do
  page="$(basename "$source_page")"
  sed \
    -e "s/build local/build ${GIT_REVISION}/g" \
    -e "s#assets/main.css#assets/main.css?v=${GIT_REVISION}#g" \
    -e "s#assets/site-nav.js#assets/site-nav.js?v=${GIT_REVISION}#g" \
    -e "s#assets/images/favicon-32.png#assets/images/favicon-32.png?v=${GIT_REVISION}#g" \
    -e "s#assets/images/apple-touch-icon.png#assets/images/apple-touch-icon.png?v=${GIT_REVISION}#g" \
    "$source_page" > "$DEPLOY_DIR/$page"
done
cp "$PROJECT_DIR/poems.json" "$DEPLOY_DIR/"
for data_file in math_problems.json; do
  cp "$PROJECT_DIR/$data_file" "$DEPLOY_DIR/$data_file"
done
cp -R "$PROJECT_DIR/assets" "$DEPLOY_DIR/assets"

echo "Adding Google Analytics to production HTML…"
node "$PROJECT_DIR/scripts/inject-analytics.js" "$DEPLOY_DIR"

echo "Build version: $BUILD_VERSION"

echo "Deploying to Cloudflare Pages…"
npx wrangler pages deploy "$DEPLOY_DIR" \
  --project-name j4fun \
  --branch main
