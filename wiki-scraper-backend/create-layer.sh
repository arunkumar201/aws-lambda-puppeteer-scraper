#!/bin/bash
set -e

# Create layer directory
mkdir -p layer/nodejs
cd layer/nodejs

# Create package.json with only production dependencies
cat > package.json <<EOL
{
  "name": "wiki-scraper-deps",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/client-sqs": "^3.0.0",
    "@sparticuz/chromium": "^123.0.1",
    "puppeteer-core": "^22.15.0",
    "winston": "^3.11.0"
  }
}
EOL

# Install production dependencies
npm install --production

# Clean up unnecessary files
rm -rf node_modules/.bin
find node_modules -name "*.md" -type f -delete
find node_modules -name "LICENSE*" -type f -delete
find node_modules -name "CHANGELOG*" -type f -delete
find node_modules -name "README*" -type f -delete

# Go back to project root
cd ../..

echo "Dependencies layer created at layer/nodejs"
