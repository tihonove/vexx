# demos/ · Stories (`*.stories.ts`) · TestUtils/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

## demos/
Демо-приложения для ручного тестирования отдельных компонентов. Подкаталог **`demos/tuidom/`** — песочница про **хостинг приложения**: как напрямую поднимается `TuiApplication` на `NodeTerminalBackend` (базовые сущности явно, без обёрток).

## Stories (`*.stories.ts`)
Интерактивные демо-сценарии виджетов живут **рядом с компонентами** (`*.stories.ts`) и экспортируют именованные функции-стори. Контракт — `src/StoryRunner/StoryTypes.ts` (`StoryContext { app, body, args, afterRun }`, `StoryMeta { title }`).

Сами story и контракт — часть tuidom и остаются в vexx. А **браузер** историй (дерево всех story + Ctrl+K-поиск, аналог веб-Storybook) вынесен в отдельный сайд-проект **`tuidom/storybook`**: он ссылается на соседний checkout vexx (`../../vexx`), сканирует его `src/**/*.stories.ts` и запускает выбранную story. Так сайд-проекты не живут в vexx; когда tuidom выделят в отдельную либу, storybook переключит единственный shim-файл на неё. Запуск — из репозитория storybook (`npm run storybook`), при vexx рядом на диске.

## TestUtils/
Общие утилиты для тестов (визуальные assertions для экрана). `ExtensionTestHarness.createExtensionTestHarness({ initialFile?, extensions? })` поднимает реальный `EditorService` (+ `EditorGroupComponent`) + `ExtensionHost` поверх `TestApp`/`MockTerminalBackend`. `ExtensionHost` форкается через `subprocessSpawnArgsForTests()` — `node --import tsx/esm src/Extensions/Host/__fixtures__/subprocessEntry.ts` (в vitest `process.argv[1]` указывает на vitest CLI, не на `main.ts`). Тестовые расширения лежат рядом — `*.cjs` файлы с `exports.activate = function(ctx) { var vscode = require("vscode"); ... }`.
