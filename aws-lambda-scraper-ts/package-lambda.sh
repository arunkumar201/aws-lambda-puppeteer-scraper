#!/bin/bash
set -e

# Clean up previous dist directories
rm -rf api-dist worker-dist
mkdir -p api-dist worker-dist

echo "Building API function..."
# Build API function with esbuild
pnpm exec esbuild src/api.ts --bundle --platform=node --target=node18 \
  --external:winston \
  --outfile=api-dist/api.js

# Copy API package.json and install dependencies
cp api-package.json api-dist/package.json
cd api-dist
pnpm install --prod --ignore-scripts --no-optional

# Cleanup API node_modules
rm -rf node_modules/.bin
find node_modules -name "*.md" -type f -delete
find node_modules -name "test" -type d -prune -exec rm -rf '{}' +
find node_modules -name "__tests__" -type d -prune -exec rm -rf '{}' +
find node_modules -name "docs" -type d -prune -exec rm -rf '{}' +
find node_modules -name "example*" -type d -prune -exec rm -rf '{}' +
find node_modules -name "demo*" -type d -prune -exec rm -rf '{}' +
find node_modules -name "coverage" -type d -prune -exec rm -rf '{}' +
find node_modules -name "*.map" -type f -delete
find node_modules -name "*.ts" -type f -delete
find node_modules -name "CHANGELOG*" -type f -delete
find node_modules -name "LICENSE*" -type f -delete
find node_modules -name "README*" -type f -delete
cd ..

echo "Building Worker function..."
# Build Worker function with esbuild
pnpm exec esbuild src/worker.ts --bundle --platform=node --target=node18 \
  --external:puppeteer-core \
  --external:winston \
  --outfile=worker-dist/worker.js

# Copy Worker package.json and install dependencies
cp worker-package.json worker-dist/package.json
cd worker-dist
pnpm install --prod --ignore-scripts --no-optional

# Cleanup Worker node_modules
rm -rf node_modules/.bin
find node_modules -name "*.md" -type f -delete
find node_modules -name "test" -type d -prune -exec rm -rf '{}' +
find node_modules -name "__tests__" -type d -prune -exec rm -rf '{}' +
find node_modules -name "docs" -type d -prune -exec rm -rf '{}' +
find node_modules -name "example*" -type d -prune -exec rm -rf '{}' +
find node_modules -name "demo*" -type d -prune -exec rm -rf '{}' +
find node_modules -name "coverage" -type d -prune -exec rm -rf '{}' +
find node_modules -name "*.map" -type f -delete
find node_modules -name "*.ts" -type f -delete
find node_modules -name "CHANGELOG*" -type f -delete
find node_modules -name "LICENSE*" -type f -delete
find node_modules -name "README*" -type f -delete
cd ..

echo "Build complete!"
echo "API function size: $(du -sh api-dist/ | cut -f1)"
echo "Worker function size: $(du -sh worker-dist/ | cut -f1)"
find node_modules -name "README*" -type f -delete
cd .. 
