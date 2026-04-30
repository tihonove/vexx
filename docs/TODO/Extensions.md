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

- [ ] `contributes.configuration` — JSON-схема настроек.
- [ ] `ConfigurationService` + persistent storage.
- [ ] `contributes.configurationDefaults` — оверрайды для language-specific.

## Phase 7 — Активация и lifecycle

- [ ] `activationEvents` (`onLanguage:*`, `onCommand:*`, `onStartupFinished`, …).
- [ ] Lazy activation — расширение не грузится до триггера.
- [ ] `IDisposable`-цепочка: при unload корректно убираются все contributions (TokenizationRegistry, CommandRegistry, …).
- [ ] Reload расширения (dispose → re-register).

## Phase 8 — Extension host

- [ ] `main` entry point — sandboxed Node worker per extension.
- [ ] `vscode` API namespace — proxy через RPC (commands, workspace, window, languages, ...).
- [ ] Activation events triggers — вызов `activate(context)` с `ExtensionContext`.
- [ ] Изоляция исключений — упавшее расширение не валит host.

## Phase 9 — Внешние расширения

- [ ] Сканер `~/.vexx/extensions/`.
- [ ] Установка из `.vsix` (или из marketplace API позже).
- [ ] Версионирование, миграции, конфликты contribution points.

---

## Открытые вопросы

- Совместимость API `vscode.*` — насколько глубоко имитировать (минимум для language extensions: workspace, languages, commands, window).
- Unbundled vs bundled extensions при SEA-сборке.
- Webview / notebook — отдельный большой подпроект.
