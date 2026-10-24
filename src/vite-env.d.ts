/// <reference types="svelte" />
/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

// hls.js liefert für den Light-Build keine eigenen Typen; API ist identisch.
declare module "hls.js/light" {
  export * from "hls.js";
  export { default } from "hls.js";
}
