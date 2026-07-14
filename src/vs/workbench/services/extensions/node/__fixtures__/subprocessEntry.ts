/**
 * Test-only subprocess entry. Используется ExtensionHost.* тестами вместо
 * `main.ts`, чтобы не запускать TUI / CLI парсер. Параметризован через
 * `spawnArgs` опции `ExtensionHost`.
 *
 * Запускается через `node --import tsx <этот файл>` (tsx loader нужен для
 * `.ts` импортов в subprocess'е). См. `subprocessSpawnArgsForTests()`.
 */
import { runExtensionHostSubprocess } from "../../../../api/node/extensionHostProcess.ts";

runExtensionHostSubprocess();
