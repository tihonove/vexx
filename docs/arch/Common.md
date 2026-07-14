# Common/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Базовые типы и утилиты без внешних зависимостей: геометрия (`Point`, `Size`, `Rect`, `BoxConstraints`), `IDisposable`/`Disposable`, DI-примитивы (`Token`, `Container`, см. [../DI.md](../DI.md)). Unicode: `UnicodeWidth` и `DisplayLine` (маппинг строки документа на grapheme-слоты + двусторонний конвертер offset↔column) — общий инструмент корректной обработки wide chars / emoji / табов / combining marks во всех слоях (Editor, TUIDom, RenderContext).

IO-абстракции (интерфейс + no-op/in-memory заглушка), которыми пользуются разные слои: `IClipboard`/`InMemoryClipboard`, `IFileClipboard`/`InMemoryFileClipboard`, `IFileWatcher`/`NULL_FILE_WATCHER` (слежение за отдельным файлом; реальная `ChokidarFileWatcher` и DI-токен `IFileWatcherDIToken` — в Controllers, но интерфейс живёт здесь, чтобы им мог пользоваться и слой Configuration для live-reload настроек).

## Common/Assets/
Унифицированный доступ к статическим ассетам (грамматики, `onig.wasm`, манифесты builtin-расширений) через один интерфейс `IAssetAccess` над виртуальными POSIX-путями — потребители не знают, откуда физически читаются файлы. Две реализации: `BundleAssetAccess` (in-memory mini-archive) и `FsAssetAccess` (dev, mapping `virtualPrefix → fsRoot`). `CompositeAssetAccess` — longest-prefix роутер, склеивающий builtin- и user-ассеты в одно адресное пространство. Сборка bundle — `scripts/pack-assets.mjs`.

`createDefaultAssetAccess()` выбирает источник **одного и того же** `vexx.bundle` по убыванию приоритета:
1. **SEA** — бандл внутри бинаря, `node:sea.getAsset("vexx.bundle")`;
2. **self-extract** — бандл лежит файлом рядом с `main.js` (`BundleFile.ts`; сборка — `scripts/build-selfextract.mjs`);
3. **dev/tests** — `FsAssetAccess` на `src/Extensions/builtin/` + `node_modules/vscode-oniguruma`.

Формат и потребители у всех трёх общие — меняется только источник байтов, поэтому новый способ упаковки не стоит ничего ни одному downstream-потребителю.

## Common/Logging/
Логирование в стиле VS Code: один `ILogService` на процесс (`ILogServiceDIToken`), из него `ILogger` per channel (dotted, напр. `extensions.host`). Уровень канала резолвится walk-up по точкам → wildcard `*` → дефолт. Sinks (`ILogSink`) — fan-out fire-and-forget: `RingBufferSink` (источник для будущей Output-вкладки) и `FileSink` (append-only). В тестах биндится `NULL_LOG_SERVICE`.

Неочевидные гейты:
- **dev vs packaged:** `FileSink` (`./vexx.log`) добавляется только когда `isPackagedRuntime() === false`; в упакованных сборках файлового sink нет. Гейт идёт именно по `isPackagedRuntime()` (`Assets/PackagedRuntime.ts`), а не по `isSeaBinary()`: self-extract — тоже прод, но `isSea()` там `false`, и по старому гейту прод писал бы `vexx.log` в cwd пользователя.
- При `NULL_LOG_SERVICE` extension-host stdio остаётся `"inherit"` — семантика тестов не меняется.
- `isSeaBinary()` идёт через `createRequire(...)("node:sea")`: статический ESM-import `node:sea` **ломает SEA-сборку**.
