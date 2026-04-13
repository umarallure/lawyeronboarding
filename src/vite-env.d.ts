/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ATTORNEY_PORTAL_URL?: string;
  readonly VITE_SLACK_WORKSPACE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
