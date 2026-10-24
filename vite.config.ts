import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, lazyPlugins } from "vite-plus";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  fmt: {
    ignorePatterns: ["dist/**", "bun.lock", "prd.md"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [svelte()]),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    // Erreichbar im LAN, damit das Tablet den Dev-Server nutzen kann.
    host: true,
  },
  build: {
    target: "es2022",
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
