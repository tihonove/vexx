import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "es2024",
  dts: true,
  clean: true,
  sourcemap: true,
  onSuccess: "node dist/index.js",
});
