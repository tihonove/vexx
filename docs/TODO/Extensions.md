# Extensions — VS Code-совместимые расширения

Цель: загружать расширения по формату VS Code (`package.json` с `contributes`) — сначала встроенные, потом из `~/.vexx/extensions/`. Архитектура должна быть готова к разгрузке (clean unload через `IDisposable`) и инкрементальному добавлению contribution points.

См. также: [docs/ARCHITECTURE.md](../ARCHITECTURE.md) (раздел `Extensions/`).

---

## Phase 1 — [x] Языки и TextMate-грамматики

Сделано:

- `src/Extensions/IExtensionManifest.ts` — полная типизация манифеста VS Code (нереализованные contribution points закомментированы).
- `src/Extensions/IExtension.ts` — `{ id, manifest, location, isBuiltin }`.
- `src/Extensions/ExtensionScanner.ts` — `scanBuiltinExtensions(rootDir)`: чтение поддиректорий, валидация `name`/`publisher`/`version`.
- `src/Extensions/LanguageRegistry.ts` (`implements ILanguageService`) — `register(IExtension): IDisposable` с refcount; `getLanguageIdForResource(filePath)` (filenames → patterns → extensions).
- `src/Extensions/ExtensionTokenizationContributor.ts` — собирает `contributes.grammars` в `IGrammarRecord[]`, регистрирует support в `TokenizationRegistry`.
- `src/Editor/Tokenization/ILanguageService.ts` — интерфейс + `NULL_LANGUAGE_SERVICE`. `EditorController.pickTokenizer` использует его вместо хардкода.
- `src/Extensions/builtin/{javascript,typescript-basics,css}/` — verbatim-копии встроенных расширений из microsoft/vscode.
- `src/main.ts` — bootstrap: scan → LanguageRegistry → ExtensionTokenizationContributor.apply().

Каверзы (записать в комментарии где нужно):

- В Phase 1 `language-configuration.json` загружается ТОЛЬКО как путь в манифесте — auto-closing pairs, brackets, on-enter rules ещё не применяются (типизация в `ILanguageConfiguration.ts` готова).
- `main` поле манифеста игнорируется — extension host (запуск JS-кода расширения) не реализован.
- ✅ SEA-сборка: `src/Extensions/builtin/**` и `onig.wasm` пакуются в `dist/vexx.bundle` (custom mini-archive) и читаются через `IAssetAccess` (см. `Common/Assets/` в [docs/ARCHITECTURE.md](../ARCHITECTURE.md)). Никаких файлов рядом с бинарём не нужно.

---

## Phase 2 — Темы и иконки

- [ ] `contributes.themes` — workbench colors + `tokenColors` (TextMate). Парсинг готов в `Theme/`, нужно подцепить к scanner.
- [ ] `contributes.iconThemes` / `productIconThemes` — file icons.
- [ ] Theme switcher в DI.

## Phase 3 — Language configuration runtime

- [ ] Загрузка `language-configuration.json` per language (через `LanguageRegistry` или отдельный `LanguageConfigurationRegistry`).
- [ ] Auto-closing pairs / surrounding pairs в редакторе.
- [ ] On-enter rules (smart indent после `{`, продолжение `//`-комментариев).
- [ ] Bracket matching, folding markers.

## Phase 4 — Snippets

- [ ] `contributes.snippets` — JSON-парсер snippet bodies.
- [ ] Snippet engine (tabstops, placeholders, transforms).
- [ ] Интеграция с completion-механизмом.

## Phase 5 — Commands и keybindings

- [ ] `contributes.commands` — регистрация в `CommandRegistry` без runtime callback (заглушка пока нет extension host).
- [ ] `contributes.keybindings` — регистрация в `KeybindingRegistry` с `when`-клаузами.
- [ ] `contributes.menus` / `submenus` — пункты в menu bar / context menus.

## Phase 6 — Configuration

Частично сделано:

- `Configuration/IConfigurationService.ts` — интерфейс (`get`, `getValue`, `inspect`, `onDidChangeConfiguration`).
- `Configuration/ConfigurationModel.ts` — иммутабельная модель с нормализацией dotted-keys и слиянием слоёв.
- `Configuration/ConfigurationService.ts` + `loadConfiguration(paths)` — реализация, читает JSONC через `jsonc-parser` (Microsoft).
- `Common/UserDataPaths.ts` + `Common/CliArgs.ts` — раскладка `~/.vexx/` (VS Code-совместимая), CLI `--user-data-dir`, `--profile`, `--help`.
- `Controllers/Modules/ConfigurationModule.ts` + DI в `ProductionProfile`/`TestProfile`; `EditorGroupController` применяет `editor.tabSize`/`editor.insertSpaces` к каждому новому редактору.
- `test-fixtures/vexx-home/` — изолированный каталог с default + `compact` профилями для ручного запуска.

Остаётся:

- [ ] `contributes.configuration` — JSON-схема настроек расширений, регистрация в ConfigurationService.
- [ ] Persistent storage и запись из UI/расширений (`update(key, value)`).
- [ ] `contributes.configurationDefaults` — оверрайды для language-specific.
- [ ] Live-reload settings.json через fs.watch + эмит `onDidChangeConfiguration` (сейчас no-op).
- [ ] Workspace-слой (`.vexx/settings.json` в корне проекта).
- [ ] Парсинг и применение `keybindings.json` (сейчас файл может существовать, но игнорируется).

## Phase 7 — Активация и lifecycle

- [ ] `activationEvents` (`onLanguage:*`, `onCommand:*`, `onStartupFinished`, …).
- [ ] Lazy activation — расширение не грузится до триггера.
- [ ] `IDisposable`-цепочка: при unload корректно убираются все contributions (TokenizationRegistry, CommandRegistry, …).
- [ ] Reload расширения (dispose → re-register).

## Phase 8 — Extension host

Сделано в Phase 1.5 (in-process MVP):

- `src/Extensions/Api/vscode.d.ts` — полная копия `vscode.d.ts` из microsoft/vscode, line-commented. Активной оставлена минимальная поверхность: `version`, `Disposable`, `Event<T>`, `TextEditorOptions { tabSize, insertSpaces }`, `TextEditor.options`, `window.activeTextEditor`, `ExtensionContext`. `tsconfig paths` маршрутизирует `import type * as vscode from "vscode"` сюда.
- `src/Extensions/Host/IMessageChannel.ts` + `InProcessChannelPair.ts` — абстракция «канала сообщений» с двумя реализациями (сейчас только in-process, в будущем pipe/MessagePort/IPC). Сообщения проходят через `JSON.stringify`/`parse`, что эмулирует structural cloning и ловит мутации общих объектов уже сейчас.
- `src/Extensions/Host/RpcEndpoint.ts` — request/response/notification поверх `IMessageChannel`. Парные endpoints на host- и runtime-стороне.
- `src/Extensions/Host/IEditorOptionsService.ts` + `EditorOptionsServiceAdapter.ts` — host-сервис, через который runtime меняет настройки активного редактора. Адаптер живёт в Extensions, чтобы `EditorController` ничего не знал про расширения.
- `src/Controllers/EditorController.ts::setIndentOptions` — публичный seam; выключает auto-detect indent при явной установке.
- `src/Extensions/Host/IExtensionEntry.ts` — Phase 1 сигнатура `activate(context, api: typeof vscode)`. Phase 8: вернётся к каноническому `activate(context)` с импортом `vscode` после self-spawn.
- `src/Extensions/Host/ExtensionRuntime.ts` — runtime-сторона: строит минимальный `vscode` namespace (с прокси на `editor.options`, который шлёт `editor.setOptions` через RPC) и вызывает `entry.activate(ctx, api)`.
- `src/Extensions/Host/ExtensionHost.ts` — host-сторона: `registerExtension/unregisterExtension/dispose`, создаёт пару каналов на расширение, регистрирует RPC-обработчики `editor.setOptions/getOptions`.
- `src/Controllers/Modules/ExtensionHostModule.ts` — DI binding; `main.ts` поднимает host (пока пустой — `main` builtin-расширений не исполняется).
- `src/TestUtils/ExtensionTestHarness.ts` — `createExtensionTestHarness({ initialFile?, extensions? })` поднимает `EditorGroupController` + `ExtensionHost` поверх `TestApp`/`MockTerminalBackend`. Расширения регистрируются sequentially.
- Тесты: `InProcessChannelPair.test.ts` (6), `RpcEndpoint.test.ts` (7), `ExtensionHost.test.ts` (7), `ExtensionHost.Indent.test.ts` (3). Фикстуры в `src/Extensions/Host/__fixtures__/`.

Остаётся:

- [ ] Self-spawn: `main` field → `child_process.fork()` extension host subprocess.
- [ ] Канал поверх `node:stream`/IPC между host и subprocess.
- [ ] Стаб `Module._cache["vscode"]` в subprocess → канонический `import * as vscode from "vscode"` в расширениях; убрать `api` 2-м аргументом.
- [ ] `activationEvents` triggers — вызов `activate(context)` в нужный момент.
- [ ] Расширение всего vscode-API: `commands`, `workspace`, `languages`, `window` (за пределами `activeTextEditor.options`).
- [ ] Изоляция исключений: упавшее расширение не валит host (сейчас уже не валит host благодаря RPC + try/catch, но diagnostics ещё нет).
- [ ] Маршрутизация ошибок RPC обратно в `editor.options =`, чтобы fire-and-forget не глотал.

## Phase 9 — Внешние расширения

Частично сделано:

- `scanExtensions(assets, rootPrefix, { isBuiltin })` (`Extensions/ExtensionScanner.ts`) используется и для builtin (`Extensions/builtin/`), и для юзерского префикса `UserExtensions/`.
- `Common/Assets/CompositeAssetAccess.ts` роутит виртуальные пути между builtin (SEA/FS) и user (FsAssetAccess на `<userData>/extensions/`).
- `Extensions/mergeExtensions.ts` разруливает конфликты id (builtin побеждает user с `console.warn`).
- `main.ts` сканирует оба источника и регистрирует в `LanguageRegistry` + `ExtensionTokenizationContributor`.

Остаётся:

- [ ] Установка из `.vsix` (или из marketplace API позже).
- [ ] Версионирование (выбор последней из нескольких версий одного id), миграции.
- [ ] Конфликты contribution points (сейчас резолвится только по id расширения, не по перекрывающимся language ids).
- [ ] Активация user-расширений в ExtensionHost после Phase 7/8.

---

## Открытые вопросы

- Совместимость API `vscode.*` — насколько глубоко имитировать (минимум для language extensions: workspace, languages, commands, window).
- Unbundled vs bundled extensions при SEA-сборке.
- Webview / notebook — отдельный большой подпроект.
