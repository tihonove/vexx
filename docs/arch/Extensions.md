# Extensions/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Загрузка VS Code-совместимых расширений. Сейчас поддержаны `contributes.languages` и `contributes.grammars` для builtin (`src/Extensions/builtin/` — 48 языковых паков из microsoft/vscode, импорт verbatim скриптом с пином тега) и user-расширений (`<userData>/extensions/<publisher>.<name>-<version>/`). Остальные contribution points — отдельные фазы (см. [../TODO/Extensions.md](../TODO/Extensions.md)).

Контракты/швы:
- **`IExtension`** — `{ id, manifest, location, isBuiltin }`. `ExtensionScanner` парсит `package.json` через `IAssetAccess`; `mergeExtensions` разруливает конфликты id (builtin побеждает user).
- **`LanguageRegistry implements ILanguageService`** — собирает `contributes.languages`, резолвит language по пути файла. Неочевидное правило разрешения: приоритет `filenames` → `filenamePatterns` (мини-glob) → `extensions`; при конфликте одного `.ext` побеждает **зарегистрированный позже** (user поверх builtin, как в VS Code). Seed'ит core-язык `plaintext` как fallback.
- **`ExtensionTokenizationContributor`** — регистрирует грамматики из всех `contributes.grammars` в `TokenizationRegistry`.
- **`ExtensionInstaller`** — установка/удаление/список из `.vsix` (CLI `--install-extension` и т.п., до подъёма TUI): распаковка с защитой от zip-slip + атомарный `rename` в каталог, который ждёт `ExtensionScanner`.

## Extensions/Host/ — extension host (real subprocess)
Изоляция кода расширений от ядра. Host форкает **один subprocess** (тот же бинарь / `main.ts` с env `VEXX_EXTENSION_HOST=1`) и общается с ним через **RPC поверх Node IPC**. Швы:
- **`IMessageChannel`** — транспортно-агностичный двунаправленный канал. Реализации: `IpcMessageChannel` (Node IPC) и `createInProcessChannelPair()` (unit-тесты).
- **`RpcEndpoint`** — request/response/notification поверх канала, **симметричный** (запросы шлют обе стороны).
- **vscode-стаб:** subprocess патчит `Module._cache["vscode"]` + `Module._resolveFilename` (`installVscodeStub`), поэтому `require("vscode")` расширения отдаёт нашу поверхность. Сама поверхность собрана в `Extensions/Host/Vscode/` — тонкий ассемблер `buildVscodeNamespace(rpc)` над общим контекстом (`window`/`workspace`/`languages`/`commands` + value-типы `Position`/`Range`/`Uri`/enum'ы). Документы держат **стабильную идентичность** (`DocumentRegistry`: один объект на `fileName`, обновления мутируют его на месте — нужно для `activeTextEditor.document === doc`).
- **Save-participant / completion seams:** `EditorController.save()` асинхронный — при заданном `saveParticipant` он `await`-ится до записи (правки клампятся к границам, уходят одним undoable-батчем). Инъекция seam'ов — в `Controllers/Modules/ExtensionHostModule.ts`; **ядро (`EditorController`/`EditorGroupController`) про extension-слой не знает.**
- **`IExtensionRegistration`** несёт `configDefaults` и `commandTitles` — последние нужны, чтобы рантайм-`registerCommand` расширения **показался в палитре** (host заводит прокси в `CommandRegistry` с этим title; иначе команда исполнима, но невидима).
- **Lifecycle:** `ExtensionHost.dispose()` — graceful `host.shutdown` → `SIGTERM` → `SIGKILL`. В DI — `ExtensionHostDIToken`. `main.ts` содержит ранний branch на env-флаг: subprocess уходит в `runExtensionHostSubprocess()`, обычный запуск — в `runEditor()`.

## Правило роста `vscode.d.ts` (важно)
`Extensions/Api/vscode.d.ts` — дословная копия upstream, всё line-commented кроме активной поверхности. Нужные блоки **дословно раскомментируются** из нижней части в активный модуль — их **нельзя сужать / переписывать / переоформлять** (комментарии тоже upstream). Это стадийная копия реального API, а не стаб под реализацию. Если блок тянет ещё не раскомментированные типы (dependency closure) — либо раскомментируй и их, либо **отложи блок целиком**, но не подменяй сужённой версией. Runtime-значение может опережать типовую декларацию (namespace отдаётся через `as unknown as typeof vscode`).

**Зависимости:** Extensions → Editor (через `ILanguageService`, `TextMateGrammarLoader`, `TokenizationRegistry`), Common. Подмодуль **`Extensions/Host` дополнительно → Controllers** (через `EditorGroupController`-адаптер) — единственное место, где Extensions поднимается выше Controllers.
