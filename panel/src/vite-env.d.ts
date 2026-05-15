/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_BRANDING_PUBLIC_URL?: string;
  readonly VITE_BRANDING_ICON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
