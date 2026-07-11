# Editor/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Модель текстового редактора и виджет-мост к TUIDom: хранение текста (пока `string[]`, в планах Piece Table), view-state (scroll/selections/folding/cursor), undo/redo, интерфейсы. **Ключевой инвариант: Editor не зависит от Theme и Extensions напрямую — только через интерфейсы `ITokenStyleResolver` и `ILanguageService`.**

Документ публикует структурные изменения через `ITextDocument.onDidChangeContent` (`{ startLine, oldEndLine, newEndLine }`) — точка расширения для всех per-document подсистем (токенайзер, decorations, marker tracking, future Piece Tree). Язык живёт на документе: `languageId`, `setLanguage` (no-op при совпадении, **не** бампает versionId → смена языка не делает документ dirty), `onDidChangeLanguage`.

**Слежение за файлом на диске (à la VS Code).** `EditorController` хранит снимок `diskStat` и слушает внешние изменения через `IFileWatcher`. Чистый буфер — молча перечитывается (`revertToDisk`); «грязный» — взводит `hasDiskConflict`. `save({ overwrite? })` сверяет текущий stat с `diskStat`: параллельная правка → `SaveOutcome === "conflict"`, пока пользователь не подтвердит перезапись. Собственные записи отсеиваются сверкой stat.

## Folding
Модель — в `EditorViewState` как «линза» проекции документа на видимые строки. `IFoldingRegion { startLine, endLine, isCollapsed }` прячет тело, оставляя заголовок; курсорная навигация и `revealRange` пропускают/раскрывают свёрнутое. Источник областей — `FoldingRangeProvider.computeIndentationFolds` (по отступам, как VS Code); расширенческий провайдер — будущий seam. Рендер: фолд-контрол в гуттере + inline-маркер `⋯` + indent-guides `│`. Команды и бинды — `Controllers/Actions/FoldingActions.ts`.

## Editor/Tokenization/ (швы)
Подсветка синтаксиса разделена как в VS Code: *источник токенов / хранилище / резолвер стиля / рендер*. Контракты:
- **`IState`** + `NULL_STATE` — состояние токенайзера на границе строк.
- **`ITokenizationSupport`** — `tokenizeLine(line, state)`. Sync MVP; async (LSP semantic tokens) — точка расширения.
- **`TokenizationRegistry`** (`TokenizationRegistryDIToken`) — `register`/`get`/`onDidChange` по languageId.
- **`DocumentTokenStore`** — per-document кеш токенов, подписан на `onDidChangeContent`, догоняет через `tokenizeUpTo(line)` с end-state оптимизацией.
- **`ITokenStyleResolver`** — `resolve(scopes) → ResolvedTokenStyle`. **Editor зависит только от этого интерфейса, не от Theme.**
- **`ILanguageService`** — `languageId` по пути файла + display name. **Editor зависит только от интерфейса, не от Extensions.** Реализацию (`LanguageRegistry`) поставляет слой Extensions.
- `builtin/` — заглушки (`PlainTextTokenizer`, `WordTokenizer`) как fallback; `textmate/` — адаптер над `vscode-textmate`/`vscode-oniguruma` с защитой от ReDoS. Конкретные грамматики поставляют builtin-расширения.

## Theme/Tokenization/ (мост стиля токенов)
`TokenThemeResolver implements ITokenStyleResolver` — компилирует правила темы по специфичности (число `.`-сегментов; позже-определённое побеждает на ties), каскадирует fg/bg/fontStyle независимо, кеширует по scopes. Связывание сервисов (`TokenizationRegistry` + `TokenStyleResolver` + `LanguageService`) — на App-уровне (`main.ts`), дальше они попадают в `EditorController` → `EditorElement`. **Hot-swap:** `EditorController` подписан на `TokenizationRegistry.onDidChange` и `onDidChangeLanguage` — догрузившаяся после открытия файла грамматика и ручная смена языка подхватываются без пересоздания редактора.

## Editor/Markers/ (диагностики)
Провайдер-агностичный реестр диагностик (аналог VS Code `IMarkerService`). **Диагностики отвязаны от источников:** LSP / problem matchers / расширения — *поставщики* (пишут `MarkerService.changeOne(owner, resource, markers)`); squiggle в редакторе, панель Problems, счётчики — *потребители* (`read`/`onDidChangeMarkers`). Поэтому MVP собирается с одним поставщиком, без LSP.
- **`IMarker`/`IMarkerData`/`MarkerSeverity`** (`Hint|Info|Warning|Error`) — модель; `IMarker` = `IMarkerData` + `owner` (неймспейс поставщика) + `resource` (путь файла).
- **`MarkerService`** — чистый реестр `owner → resource → IMarker[]` без DI (зеркало `TokenizationRegistry`; DI-токен и модуль — в Controllers).
- **`IMarkerDecoration`** — view-проекция маркера (`range` + `severity`), чтобы Editor не зависел от `owner`/`resource`/`message`. Рендер — `EditorElement` красит покрытые ячейки severity-цветом (`editorError/Warning/Info/Hint.foreground`) + `StyleFlags.Undercurl` (на legacy-терминалах — обычный цвет). Точка пересчёта — `onDidChangeContent`. Проводка «поставщик → реестр → потребитель» — в Controllers (`DiagnosticsController`, см. [Controllers.md](Controllers.md)).
