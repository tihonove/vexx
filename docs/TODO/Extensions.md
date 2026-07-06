# Extensions — VS Code-совместимые расширения

Цель: загружать расширения по формату VS Code (`package.json` с `contributes`) — сначала встроенные, потом из `~/.vexx/extensions/`. Архитектура должна быть готова к разгрузке (clean unload через `IDisposable`) и инкрементальному добавлению contribution points.

См. также: [docs/ARCHITECTURE.md](../ARCHITECTURE.md) (раздел `Extensions/`).

---

## Phase 1 — [x] Языки и TextMate-грамматики

- [x] Сделано: сканирование манифестов (`ExtensionScanner`), `LanguageRegistry` (`implements ILanguageService`), регистрация грамматик через `ExtensionTokenizationContributor` → `TokenizationRegistry`, builtin-расширения из microsoft/vscode, SEA-упаковка через `IAssetAccess`. Детали: [ARCHITECTURE.md](../ARCHITECTURE.md) → Extensions.
- [x] Полный набор языков: все 48 декларативных языковых паков из microsoft/vscode импортируются скриптом `scripts/import-vscode-extensions.mjs` (пин тега — `src/Extensions/builtin/VSCODE_VERSION`; обновление = бамп тега + перезапуск). Smoke-тест — `src/Extensions/BuiltinLanguagePacks.test.ts`. `git-base` содержит `main`, но builtin-расширения в extension host не активируются — берём только его языки (git-commit, git-rebase, ignore).

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
- [x] Completion (WP8): минимальный completion-UI ядра (`CompletionController` + `CompletionListElement`, триггер `editor.action.triggerSuggest`/Ctrl+Space) + surfacing провайдеров расширений. Host-запрос `languages.provideCompletionItems {fileName, languageId, text, line, character}` → subprocess матчит `DocumentSelector` (`Vscode/DocumentSelector.ts`) и вызывает `registerCompletionItemProvider`-провайдеры → `WireCompletionItem[]`. `item.command` исполняется через commands bridge. Тесты: `ExtensionHost.Completion.test.ts`, `CompletionController.test.ts`, `CompletionListElement.test.ts`.

Остаётся:

- [ ] `activationEvents` triggers — вызов `activate(context)` в нужный момент (сейчас всегда eager после `openFile`).
- [~] Расширение всего vscode-API: `commands`, `workspace`, `languages`, `window` за пределами `activeTextEditor.options`. В работе — active-editor API (`window.activeTextEditor` / `onDidChangeActiveTextEditor`).
- [ ] Изоляция исключений: упавшее расширение не валит host (сейчас уже не валит host благодаря RPC + try/catch, но diagnostics ещё нет).
- [ ] Маршрутизация ошибок RPC обратно в `editor.options =`, чтобы fire-and-forget не глотал.
- [ ] ESM-расширения (`import * as vscode from "vscode"` через ESM loader hooks).
- [ ] Restart subprocess'а при крэше (сейчас при exit'е extension host'а просто все RPC падают).

### Совместимость со стоковым editorconfig-vscode (подпроект) — [x] закрыт

Отдельный план — «стоковый editorconfig-vscode работает в Vexx» (WP1–WP9) — **завершён**.
В `main` собрана подсистема `src/Extensions/Host/Vscode/` (value-типы, реестр документов со
стабильной идентичностью, `workspace`/`window`/`languages`/`commands` namespace'ы, commands
bridge, async save-pipeline с will/did-save).

- [x] **WP7** — `workspace.fs.{stat,readFile,writeFile}` + `openTextDocument(uri, {encoding})`
      + сквозная команда `EditorConfig.generate`. `workspace.fs` реализован **локально
      через `node:fs`** в subprocess (целевой файл — на той же машине, не открытый буфер),
      без RPC.
- [x] **WP8** — минимальный completion-UI ядра (`CompletionController` + `CompletionListElement`)
      + surfacing провайдеров расширений (`languages.provideCompletionItems`).
- [x] **WP9** — интеграция со **стоковым `.vsix`** (`EditorConfig.EditorConfig@0.18.2` с open-vsx,
      немодифицированный, свои `node_modules` + `@one-ini/wasm`). Установка новым CLI-флагом
      `--install-extension`, прогон на собранном SEA-бинаре, драйв через TUIDom-inspector + pty,
      проверки save-трансформаций по байтам на диске. Сквозной e2e: `e2e/editorconfig-stock.test.ts`
      (фикстуры — `e2e/fixtures/editorconfig/`).

**Проверенная паритетность (все 6 свойств + generate + completion):** `indent_style`/`indent_size`
(рендер таб-ширины), `trim_trailing_whitespace` и `insert_final_newline` на Ctrl+S (расширение
делегирует ядровым `editor.action.trimTrailingWhitespace`/`insertFinalNewLine` — вложенный
executeCommand во время will-save), `end_of_line` в обе стороны (LF↔CRLF, байты на диске),
`charset` — graceful degrade, `EditorConfig.generate` через палитру, completion свойств в
`.editorconfig`.

**Несоответствия, найденные и починенные в WP9 (мелкие, точечно):**

- `LanguageRegistry.getLanguageIdForResource` не резолвил dotfile `.editorconfig` (`path.extname` пуст)
  и не разрешал конфликт ассоциаций расширения. Теперь: dotfile матчится по полному имени, а при
  конфликте `.ext` побеждает **зарегистрированный позже** (user editorconfig > builtin `properties`/ini,
  как в VS Code) — иначе `.editorconfig` резолвился в `properties` и completion-селектор
  `{language:'editorconfig'}` не матчил.
- `FileSystemError.name` теперь в формате VS Code `"${providerCode} (FileSystemError)"`
  (FileNotFound → `EntryNotFound (FileSystemError)`) — стоковый `generate` ловит ENOENT именно по `name`.
- В снапшот will-save проброшен реальный `eol` документа (`ISaveSnapshot.eol` → wire → `ExtHostTextDocument.eol`),
  иначе `SetEndOfLine` видел всегда LF и `end_of_line=lf` не нормализовал CRLF-файлы.
- `contributes.commands` теперь прокидывает `title` в host (`IExtensionRegistration.commandTitles`) —
  рантайм-`registerCommand` расширения появляется в палитре (иначе `EditorConfig.generate` не выбрать).

**Ограничение WP7 (принято):** ядро Vexx utf-8/LF-only. `openTextDocument` всегда
читает файл как utf-8 и строит эфемерный документ (не в реестре) с `eol=LF`,
`encoding="utf8"`; параметр `encoding` принимается для совместимости с API 1.100, но
при несовпадении — graceful degrade с предупреждением `window.showMessage`. Полноценные
не-utf8 кодировки в ядре — вне объёма (см. EOL-модель WP5 и будущую работу по charset).

## Phase 9 — Внешние расширения

Частично сделано:

- `scanExtensions(assets, rootPrefix, { isBuiltin })` (`Extensions/ExtensionScanner.ts`) используется и для builtin (`Extensions/builtin/`), и для юзерского префикса `UserExtensions/`.
- `Common/Assets/CompositeAssetAccess.ts` роутит виртуальные пути между builtin (SEA/FS) и user (FsAssetAccess на `<userData>/extensions/`).
- `Extensions/mergeExtensions.ts` разруливает конфликты id (builtin побеждает user с `console.warn`).
- `main.ts` сканирует оба источника и регистрирует в `LanguageRegistry` + `ExtensionTokenizationContributor`.

Остаётся:

- [ ] Установка из `.vsix` (откуда берётся артефакт и как выбирается версия — см. Phase 10).
- [ ] Версионирование (выбор последней из нескольких версий одного id), миграции (резолв версии — см. Phase 10).
- [ ] Конфликты contribution points (сейчас резолвится только по id расширения, не по перекрывающимся language ids).
- [ ] Активация user-расширений в ExtensionHost после Phase 7/8.

## Phase 10 — Discovery и дистрибуция (registry)

Phase 9 отвечает на «как загрузить расширение из `<userData>/extensions/`». Phase 10 —
«откуда оно туда попадает»: как искать, версионировать и устанавливать расширения. В идеале
конечная цель — [openvsx](https://open-vsx.org/), но на старте — GitHub без центральной
курируемой инфраструктуры. Дизайн с самого начала артефакт- и версия-ориентированный, чтобы
переход от декларативных расширений к массивным code-расширениям не ломал ни схему, ни клиент,
а миграция на openvsx сводилась к смене провайдера.

**Модель:**

- **Discovery через GitHub topic `vexx-extension`** — топик помечает репозиторий как
  расширение (идиоматично для GitHub, не трогает имя; нативный поиск `topic:vexx-extension`).
  Не суффикс в имени репо: тот не кодирует publisher и не верифицируется.
- **Артефакты — `.vsix`** (zip с манифестом + собранными файлами; Vexx уже VS Code-совместим),
  лежат **распределённо** в GitHub Releases авторов. `browser_download_url` — прямая ссылка
  без auth и без API-лимитов на скачивание. Централизован только лёгкий индекс с метаданными
  и ссылками; бинарники в индекс не попадают.
- **Краулер** — GitHub Action в отдельном `vexx-registry`-репозитории, по расписанию.
  Находит репо по топику, через GraphQL читает `package.json` на тегах релизов
  (`version`, `engines.vexx`) **не распаковывая `.vsix`**, и публикует на GitHub Pages:
  - `index.json` — только валидные расширения (чистый список для клиента);
  - `diagnostics.json` — всё, что краулер видел, со статусом и текстом ошибок (pull-only
    обратная связь автору: зашёл по URL своего репо — посмотрел).
- **Клиент** — интерфейс `IRegistryProvider` (`search` / `resolve` / `download`) с
  реализацией `GitHubIndexProvider` сейчас и `OpenVsxProvider` позже (миграция = смена
  провайдера, не формата). Установка: скачать ассет → проверить `sha256` → распаковать
  в `<userData>/extensions/<publisher>.<name>-<version>/` → существующий `scanExtensions`
  подхватывает.

**Схема записи индекса:**

```jsonc
{
  "id": "acme.markdown-tools",
  "owner": "acme", "repo": "vexx-markdown", "stars": 42,
  "versions": [
    { "version": "1.2.0", "engines": { "vexx": "^0.5.0" },
      "asset": "https://github.com/acme/vexx-markdown/releases/download/v1.2.0/acme.markdown-tools-1.2.0.vsix",
      "size": 124000, "sha256": "…", "publishedAt": "…" }
  ]
}
```

Клиент берёт наивысшую версию, чей `engines.vexx` совместим с версией его сборки.

**Задачи:**

- [ ] Конвенция: топик `vexx-extension`; `.vsix`-ассет в GitHub Release (имя `<id>-<version>.vsix`).
- [ ] Краулер в `vexx-registry`-репо (Action + Pages): topic-поиск → чтение манифестов на
      тегах → `index.json` + `diagnostics.json`.
- [ ] Валидация при кравле: невалидные (нет `engines.vexx` / `publisher ≠ owner` / нет
      `.vsix`-ассета) → в `diagnostics.json`, не в `index.json`.
- [ ] Клиентский `IRegistryProvider` + `GitHubIndexProvider` (читает `index.json`, локальный
      поиск/фильтрация/ранжирование по звёздам).
- [ ] Резолв `engines.vexx` ↔ версия сборки; выбор совместимой версии.
- [ ] Install-флоу: download ассета → проверка `sha256` → распаковка в
      `<userData>/extensions/<id>-<version>/`.
- [ ] `vexx validate` (часть packaging-CLI) + GitHub Action-обёртка — ранний сигнал автору
      в его CI до публикации.

**Слои обратной связи автору (позже, поверх той же диагностики):**

- [ ] Краулер заводит/обновляет одну трекинг-issue в репо при ошибке (нативное письмо через
      GitHub-уведомления; одна issue, update-in-place, закрытие когда всё зелёное).
- [ ] Status-badge / страница расширения.
- [ ] GitHub App + Checks API — real-time ✅/❌ на коммите релиза (требует хостинга вебхука).

**Оговорки:**

- Иммутабельность ассетов неполная (GitHub допускает замену) → `sha256` в индексе + проверка
  на клиенте.
- Топик-самоподписка ⇒ возможны спам/сквоттинг; на старте неважно, дальше — порог по
  звёздам/возрасту или блок-лист на этапе валидации.
- Доверие publisher: на старте `publisher = owner` (без верификации) — это та часть, ради
  которой существуют настоящие реестры.

---

## Открытые вопросы

- Совместимость API `vscode.*` — насколько глубоко имитировать (минимум для language extensions: workspace, languages, commands, window).
- Unbundled vs bundled extensions при SEA-сборке.
- Webview / notebook — отдельный большой подпроект.
- Момент перехода с GitHub-индекса на openvsx (когда оправдан `OpenVsxProvider`).
- Свой формат артефакта или строго `.vsix`.
- Политика доверия/верификации publisher (`publisher = owner` → подпись/верификация).
