import { execSync } from "node:child_process";

import { defineConfig } from "tsup";

/**
 * Версия, «зашиваемая» в сборку. Приоритет:
 *  1. env `VEXX_VERSION` — задаётся в CI (релиз: тег `vX.Y.Z`; ночная: `nightly-<hash>`);
 *     ведущая `v` срезается.
 *  2. git-fallback — точный тег `vX.Y.Z` → его номер; иначе `nightly-<short-hash>`.
 *  3. если git недоступен → `0.0.0-dev`.
 */
function resolveVersion(): string {
  const fromEnv = process.env.VEXX_VERSION?.trim();
  if (fromEnv) return fromEnv.replace(/^v/, "");

  try {
    const tag = execSync("git describe --tags --exact-match", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (/^v\d/.test(tag)) return tag.replace(/^v/, "");
  } catch {
    // HEAD не на релизном теге — упадём в nightly-ветку ниже.
  }

  try {
    const shortSha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (shortSha) return `nightly-${shortSha}`;
  } catch {
    // git недоступен.
  }

  return "0.0.0-dev";
}

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "es2024",
  noExternal: ["chokidar", "vscode-textmate", "vscode-oniguruma", "jsonc-parser", "yauzl"],
  // SEA вшивает единственный main.js — code-splitting (дефолт tsup для esm)
  // вынес бы динамический import("yauzl") в отдельный chunk-*.js, которого в
  // бинаре нет. Держим всё в одном файле; import() остаётся ленивым инлайном.
  splitting: false,
  dts: true,
  clean: true,
  sourcemap: true,
  define: {
    __VEXX_VERSION__: JSON.stringify(resolveVersion()),
  },
});
