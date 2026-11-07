import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  noExternal: [/@metastorage\/.*/],
  sourcemap: true,
  target: "es2022",
});
