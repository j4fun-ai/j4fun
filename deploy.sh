#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/j4fun-pages.XXXXXX")"

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
cp "$PROJECT_DIR/index.html" "$DEPLOY_DIR/"
cp "$PROJECT_DIR/about.html" "$DEPLOY_DIR/"
cp "$PROJECT_DIR/poetry.html" "$DEPLOY_DIR/"
cp "$PROJECT_DIR/sudoku.html" "$DEPLOY_DIR/"
cp "$PROJECT_DIR/strands.html" "$DEPLOY_DIR/"
cp "$PROJECT_DIR/poems.json" "$DEPLOY_DIR/"
cp -R "$PROJECT_DIR/assets" "$DEPLOY_DIR/assets"

echo "Deploying to Cloudflare Pages…"
npx wrangler pages deploy "$DEPLOY_DIR" \
  --project-name j4fun \
  --branch main
