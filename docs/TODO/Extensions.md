# Extensions — VS Code-совместимые расширения

Цель: загружать расширения по формату VS Code (`package.json` с `contributes`) — сначала встроенные, потом из `~/.vexx/extensions/`. Архитектура должна быть готова к разгрузке (clean unload через `IDisposable`) и инкрементальному добавлению contribution points.

См. также: [docs/ARCHITECTURE.md](../ARCHITECTURE.md) (раздел `Extensions/`).

---

## Phase 1 — [x] Языки и TextMate-грамматики

- [x] Сделано: сканирование манифестов (`ExtensionScanner`), `LanguageRegistry` (`implements ILanguageService`), регистрация грамматик через `ExtensionTokenizationContributor` → `TokenizationRegistry`, builtin-расширения из microsoft/vscode, SEA-упаковка через `IAssetAccess`. Детали: [ARCHITECTURE.md](../ARCHITECTURE.md) → Extensions.

Каверза: `language-configuration.json` загружается ТОЛЬКО как путь в манифесте — auto-closing pairs, brackets, on-enter rules ещё не применяются (типизация в `ILanguageConfiguration.ts` готова, см. Phase 3).

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
- [x] Парсинг и применение `keybindings.json` (`Configuration/KeybindingsService.ts` → `AppController.applyUserKeybindings`; VS Code-семантика `-command` для unbind, `when` с tier/cap/mode/os).

## Phase 7 — Активация и lifecycle

- [ ] `activationEvents` (`onLanguage:*`, `onCommand:*`, `onStartupFinished`, …).
- [ ] Lazy activation — расширение не грузится до триггера.
- [ ] `IDisposable`-цепочка: при unload корректно убираются все contributions (TokenizationRegistry, CommandRegistry, …).
- [ ] Reload расширения (dispose → re-register).

## Phase 8 — [~] Extension host (ядро готово)

- [x] Сделано (in-process MVP + real subprocess): RPC (request/response/notification) поверх `IMessageChannel` с двумя транспортами (`InProcessChannelPair` для тестов, `IpcMessageChannel` поверх Node IPC), self-spawn subprocess'а (SEA и dev), стаб `require("vscode")` через `Module._cache`, `vscode.d.ts` с минимальной активной поверхностью, `EditorOptionsServiceAdapter` (runtime меняет настройки редактора, не зная про `EditorController`). Детали: [ARCHITECTURE.md](../ARCHITECTURE.md) → Extensions/Host. Тесты: `src/Extensions/Host/*.test.ts`, `e2e/sea-extensions.test.ts`.

Остаётся:

- [ ] `activationEvents` triggers — вызов `activate(context)` в нужный момент (сейчас всегда eager после `openFile`).
- [~] Расширение всего vscode-API: `commands`, `workspace`, `languages`, `window` за пределами `activeTextEditor.options`. В работе — active-editor API (`window.activeTextEditor` / `onDidChangeActiveTextEditor`).
- [ ] Изоляция исключений: упавшее расширение не валит host (сейчас уже не валит host благодаря RPC + try/catch, но diagnostics ещё нет).
- [ ] Маршрутизация ошибок RPC обратно в `editor.options =`, чтобы fire-and-forget не глотал.
- [ ] ESM-расширения (`import * as vscode from "vscode"` через ESM loader hooks).
- [ ] Restart subprocess'а при крэше (сейчас при exit'е extension host'а просто все RPC падают).

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
