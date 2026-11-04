#!/usr/bin/env bash
# Builds the upload package for shared hosting:
#   release/static-site-maker.zip  unpack on the host (or upload release/site/)
#   release/site/                  the same files, unzipped
set -euo pipefail
cd "$(dirname "$0")/.."

# npm ci wipes node_modules, which would break a running ng serve.
[ -d frontend/node_modules ] || (cd frontend && npm ci --silent)
(cd frontend && npx ng build)

rm -rf release/site release/static-site-maker.zip
mkdir -p release/site

cp -r backend/. release/site/
rm -f release/site/config/config.php release/site/config/.gitkeep
find release/site/uploads -mindepth 1 ! -name .htaccess -delete
cp -r frontend/dist/frontend/browser/. release/site/

(cd release/site && zip -qr ../static-site-maker.zip .)
echo "Created release/static-site-maker.zip"
