#!/bin/bash
set -e

# Build the project
cd "$(dirname "$0")/.."
pnpm run build

# Start API Gateway locally
sam local start-api \
  --template template.yaml \
  --parameter-overrides ParameterKey=Environment,ParameterValue=local \
  --skip-pull-image \
  --warm-containers LAZY \
  --docker-network host
