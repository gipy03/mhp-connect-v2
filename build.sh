#!/bin/bash
set -e
pnpm --filter '@mhp/shared' build
pnpm --filter '@mhp/integrations' build
pnpm --filter '@mhp/api' build
pnpm --filter '@mhp/web' build
