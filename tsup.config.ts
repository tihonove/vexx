import { defineConfig } from "tsup";

// Версия резолвится в scripts/resolve-version.mjs — тем же кодом, что и ключ кэша
// в build-selfextract.mjs. Общий источник правды: версия, зашитая в main.js, и
// версия в имени кэш-каталога обязаны совпадать.
// @ts-expect-error — build-скрипты живут в .mjs без типов (они не должны зависеть от tsx/jiti).
import { resolveVexxVersion } from "./scripts/resolve-version.mjs";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "es2024",
  // Список исчерпывающий: всё, что не перечислено, останется внешним import'ом,
  // которого рядом с main.js нет — бинарь упадёт с ERR_MODULE_NOT_FOUND на старте.
  // Новая рантайм-зависимость → сюда же.
  noExternal: ["chokidar", "vscode-textmate", "vscode-oniguruma", "jsonc-parser", "yauzl", "vscode-uri"],
  // SEA вшивает единственный main.js — code-splitting (дефолт tsup для esm)
  // вынес бы динамический import("yauzl") в отдельный chunk-*.js, которого в
  // бинаре нет. Держим всё в одном файле; import() остаётся ленивым инлайном.
  splitting: false,
  dts: true,
  clean: true,
  sourcemap: true,
  define: {
    __VEXX_VERSION__: JSON.stringify(resolveVexxVersion()),
  },
});
