import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared",
  "packages/integrations",
  "apps/api",
  "apps/web",
]);
