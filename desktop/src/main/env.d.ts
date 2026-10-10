/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  readonly MAIN_VITE_API_URL?: string
}

declare module '*?inline' {
  const src: string
  export default src
}
