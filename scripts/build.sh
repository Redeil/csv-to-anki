#!/usr/bin/env bash
# Assembles the static site into _site/ (used by CI and for local preview).
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf _site
mkdir -p _site/css _site/python
cp html/index.html _site/index.html
cp -R js _site/
cp python/converter.py _site/python/
npx @tailwindcss/cli -i css/styles.css -o _site/css/styles.css --minify
