#!/bin/bash
set -e

# Create layer directory
mkdir -p deps-layer/nodejs
cd deps-layer/nodejs

# Create package.json with only production dependencies
cat > package.json <<EOL
{
  "name": "wiki-scraper-deps",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@sparticuz/chromium": "^123.0.1",
    "puppeteer-core": "^22.15.0",
    "winston": "^3.11.0"
  }
}
EOL

# Install production dependencies
pnpm install --production

# Clean up unnecessary files
rm -rf node_modules/.bin
find node_modules -name "*.md" -type f -delete
find node_modules -name "LICENSE*" -type f -delete
find node_modules -name "CHANGELOG*" -type f -delete
find node_modules -name "README*" -type f -delete

# Go back to project root
cd ../..

echo "Dependencies layer created at deps-layer/"
echo "You can now deploy with 'pnpm run deploy'"
