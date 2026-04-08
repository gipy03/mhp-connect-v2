/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CIRCLE_URL?: string;
  readonly VITE_ACUITY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
