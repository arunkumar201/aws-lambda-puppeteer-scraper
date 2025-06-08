#!/bin/bash
set -e

# Clean up previous dist directory
rm -rf dist
mkdir -p dist

# Install all dependencies in the root for build
pnpm install

# Compile TypeScript files to JavaScript into the 'dist' directory
pnpm build

# Copy only necessary files to dist (no need to copy all node_modules)
cp package.json dist/
cp pnpm-lock.yaml dist/

# Install only production dependencies in dist
cd dist
pnpm install --prod --ignore-scripts --no-optional
cd ..

# Prune unnecessary files in dist/node_modules (optional, for extra speed)
cd dist
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

# Step 2: Build the SAM application
sam build --no-cached
