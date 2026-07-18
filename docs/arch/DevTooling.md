# demos/ · StoryRunner/ · TestUtils/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

## demos/
Демо-приложения для ручного тестирования отдельных компонентов. Подкаталог **`demos/tuidom/`** — песочница про **хостинг приложения**: как напрямую поднимается `TuiApplication` на `NodeTerminalBackend` (базовые сущности явно, без обёрток), в отличие от `StoryRunner`, который показывает отдельные виджеты.

## StoryRunner/
Лёгкий CLI-раннер для интерактивных stories (по аналогии со Storybook). Story-файлы (`*.stories.ts`) живут рядом с компонентами и экспортируют именованные функции-стори. Раннер автоматически создаёт `TuiApplication` + `BodyElement`, вызывает выбранную стори и запускает приложение.

Запуск: `npm run story -- <story-file> [story-name] [extra-args...]`

## TestUtils/
Общие утилиты для тестов (визуальные assertions для экрана). `ExtensionTestHarness.createExtensionTestHarness({ initialFile?, extensions? })` поднимает реальный `EditorService` (+ `EditorGroupComponent`) + `ExtensionHost` поверх `TestApp`/`MockTerminalBackend`. `ExtensionHost` форкается через `subprocessSpawnArgsForTests()` — `node --import tsx/esm src/Extensions/Host/__fixtures__/subprocessEntry.ts` (в vitest `process.argv[1]` указывает на vitest CLI, не на `main.ts`). Тестовые расширения лежат рядом — `*.cjs` файлы с `exports.activate = function(ctx) { var vscode = require("vscode"); ... }`.
