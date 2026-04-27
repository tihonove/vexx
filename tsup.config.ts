import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "es2024",
  noExternal: ["chokidar", "vscode-textmate", "vscode-oniguruma"],
  dts: true,
  clean: true,
  sourcemap: true
});
