import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Monaco JSON editoru ayri parca olarak kalsin; yalnizca JSON penceresi acilinca yuklenir
  splitting: true,
  external: ["react", "react-dom", "react/jsx-runtime", "monaco-editor", /^monaco-editor\//],
});
