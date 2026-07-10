# Vexx — Архитектура

## Обзор слоёв

Проект организован в виде стека слоёв. Каждый слой зависит только от нижележащих.

1. **App** (main.ts) — точка входа, bootstrap (CLI → user data paths → configuration → asset access → extensions → DI)
2. **Extensions** — VS Code-совместимые расширения: манифесты, грамматики, extension host (subprocess + RPC)
3. **Controllers** — контроллеры с lifecycle (constructor → mount → activate → dispose), оркестрация UI и бизнес-логики
4. **Configuration** — настройки пользователя (JSONC, профили, слои default/user/profile)
5. **Theme** — темизация (VS Code-совместимые theme files); на одном уровне с Controllers, подключается к Editor через интерфейсы
6. **Editor** — модель текстового редактора + мост к TUIDom
7. **TUIDom** — TUI-фреймворк (аналог браузерного DOM): дерево элементов, события, виджеты
8. **Input**, **Rendering**, **Backend** — платформенный слой: парсинг ввода, отрисовка, терминальный I/O
9. **Common** — общие примитивы и утилиты

Точная схема зависимостей (включая исключения) — в разделе [Правила зависимостей](#правила-зависимостей).

## Каталоги src/

### Common/
Базовые типы и утилиты, не зависящие ни от чего: `Point`, `Size`, `Offset`, `BoxConstraints`, `Rect`, `IDisposable`, `Disposable`, DI-контейнер (`Token`, `Container`, см. [docs/DI.md](DI.md)).

Также здесь живут Unicode-утилиты: `UnicodeWidth` (ширина code point/grapheme) и `DisplayLine` — маппинг строки документа на массив grapheme-слотов с двусторонним конвертером offset↔column. `DisplayLine` используется всеми слоями (Editor, TUIDom/Widgets, RenderContext) для корректной обработки wide chars, emoji, табов и combining marks.

#### Common/Assets/
Унифицированный доступ к статическим ассетам (грамматики, `onig.wasm`, манифесты builtin-расширений). Один интерфейс `IAssetAccess` (sync read/exists/listEntries) с двумя реализациями:
- `BundleAssetAccess` — читает из in-memory mini-archive (формат `AssetBundleFormat`: magic + JSON header + concat data). В SEA-бинаре bundle грузится через `node:sea.getAsset("vexx.bundle")`.
- `FsAssetAccess` — читает из файловой системы по mapping `virtualPrefix → fsRoot`. Используется в dev-режиме (`createDevAssetAccess()` мапит `Extensions/builtin/` на `src/Extensions/builtin` и `onig.wasm` на пакет `vscode-oniguruma`).

`createDefaultAssetAccess()` автоматически выбирает реализацию через `node:sea.isSea()`. Все consumers (ExtensionScanner, OnigLib, TextMateGrammarLoader, ExtensionTokenizationContributor, LanguageRegistry) работают с виртуальными POSIX-путями и не знают, откуда физически читаются файлы. Сборка bundle — `scripts/pack-assets.mjs`, вызывается из `scripts/build-sea.mjs`.

`CompositeAssetAccess` — роутер по longest-prefix между несколькими `IAssetAccess`. Используется в `main.ts` чтобы склеить builtin-ассеты (SEA-bundle/`Extensions/builtin/`) и user-extensions (`<userData.root>/extensions/`, замапленный на виртуальный префикс `UserExtensions/`) в единое адресное пространство. Downstream-потребители (`ExtensionTokenizationContributor`, грамматики) видят расширения единообразно и не различают builtin vs user по способу чтения.

#### Common/Logging/
Подсистема логирования и диагностики в стиле VS Code. Один `ILogService` на процесс, из него создаются `ILogger` per channel (channel — dotted string, например `extensions`, `extensions.host`, `configuration`).

- **Уровни**: `Off | Trace | Debug | Info | Warn | Error` (`LogLevel.ts`).
- **Резолв уровня по каналу** (`LogService.getLevel`): exact match → walk dots up (`a.b.c` → `a.b` → `a`) → wildcard `*` → DEFAULT (Trace — пока активная разработка). `setLevel("*", …)` меняет глобальный дефолт; `setLevel("extensions.host", Trace)` — точечно поддерево.
- **Sinks** (`ILogSink`): fan-out fire-and-forget, ошибки одного sink не валят остальные. Базовые реализации:
  - `RingBufferSink` — per-channel ring (default capacity 1000). Источник данных для будущей Output-вкладки; `onAppend` колбэк позволяет подписаться на новые записи.
  - `FileSink` — append-only текстовый файл, форматирует `[ISO] [LEVEL] [channel] message\\tjsonArg…`. По умолчанию `flags: "w"` — truncate per run.
- **`onDidAppend(listener)`** — общий subscribe на все добавленные записи (для Output UI / live-tail).
- **DI**: токен `ILogServiceDIToken`, модули `loggingModule` (продакшен — биндит переданный `LogService`) и `loggingModuleDefault` (тесты — биндит `NULL_LOG_SERVICE`).
- **Bootstrap-функции** (вызываются до построения DI-контейнера: `mergeExtensions`, `loadConfiguration`) принимают опциональный `ILogger` параметром — `main.ts` пробрасывает туда соответствующие каналы.
- **Extension host channels** (`extensions.host.*`): `ExtensionHost` берёт из DI логгеры `extensions.host` (lifecycle: spawn/ready/register/exit), `extensions.host.rpc` (trace каждого RPC-сообщения в обе стороны), `extensions.host.stdout` / `.stderr` (линейно-буферизованный вывод subprocess'а). При NULL_LOG_SERVICE (тесты) `isEnabled` всегда `false`, и stdio остаётся `"inherit"` (никаких изменений семантики).
- **dev vs SEA**: в `main.ts` всегда добавляется `RingBufferSink`; `FileSink` добавляется только если `isSeaBinary() === false` — пишет `./vexx.log` в текущий рабочий каталог (удобно для агентов и разработки). В SEA-prod файловый sink не создаётся.

`isSeaBinary()` (`src/Common/IsSea.ts`) — тонкая обёртка над `node:sea.isSea()` через `createRequire("file:///")("node:sea")` (статический ESM import `node:sea` ломает SEA-сборку).

### Input/
Пайплайн парсинга терминального ввода: сырые байты stdin → токены → `KeyPressEvent`. Включает токенизатор stdin, отслеживание мыши, stateful парсер клавиатурных событий (keydown/keypress/keyup в browser-like стиле) и обратную сериализацию для тестов.

### Rendering/
Вывод на экран: двойная буферизация, diff, минимальные ANSI-последовательности. Модель ячейки экрана, 2D-матрица с diff-алгоритмом, высокоуровневое API рисования (drawText, fill, clip) и генератор ANSI escape-последовательностей для flush в stdout.

### Backend/
Абстракция терминального I/O. Определяет интерфейс бэкенда (onInput, onResize, flush, setup, teardown) и две реализации: реальную (Node.js stdin/stdout, Kitty protocol, alternate screen) и in-memory для тестов (sendKey DSL, screenToString).

### TUIDom/
TUI-фреймворк — дерево элементов с layout, событиями, фокусом. Аналог браузерного DOM. Содержит базовый класс элемента, корневой event loop и три подкаталога. Система layout и позиционирования описана в [docs/LAYOUT.md](LAYOUT.md).

`RenderContext` предоставляет метод `drawText(x, y, text, style?, options?)` который инкапсулирует рендеринг wide chars через `DisplayLine` — виджеты не обязаны знать про grapheme-слоты и wide-char продолжение.

- **Events** — система событий: capture/bubble фазы, клавиатурные и фокус-события, менеджер фокуса с tab-навигацией, механизм default actions
- **Styles** — система стилей: наследование `fg`/`bg` от родителя к потомку, sentinel-значения (`INHERITED_FG`, `INHERITED_BG`), dirty-пропагация (`markStyleDirty`) и top-down резолвинг (`performStyleResolution`). Базовый `TUIStyle` содержит только `fg`/`bg`. Компонент-специфичные стили задаются через generic: `TUIElement<S extends TUIStyle>`, расширения стилей определяются рядом с соответствующими виджетами (например `TitledPanelStyle`). Разрешённые значения доступны через `resolvedStyle: ResolvedTUIStyle`
- **Widgets** — конкретные виджеты: корневой элемент, боксы с рамкой, вертикальный стек, текстовый блок с word-wrap, скролл-контейнер со скроллбаром, контекстные меню, выпадающие меню, полоса меню, `CompletionListElement` (NvChad-подобный дропдаун автодополнения у каретки: рамка, фон-подсветка выбора, codicon-иконка типа, внутренний фильтр)

`OverlayLayer` также выступает как overlay-менеджер: помимо legacy-операций (`addItem/removeItem/setVisible/setPosition`) поддерживает session API (`createSession`, `openPopupSession`) с единым lifecycle для popup/dialog/quick-open. Сессии умеют политики закрытия (`closeOnEscape`, `disposeOnClose`), восстановление фокуса (`restoreFocus`) и якорное позиционирование popup с clamp/flip по экрану.

**`pointerPolicy` (обязательное поле сессии)** закручивает инвариант «окно либо закрывается по клику снаружи, либо не пропускает клики позади себя». Каждая сессия обязана явно объявить одно из трёх:
- `"close-on-outside"` — клик мимо закрывает сессию (контекст-меню, Quick Open); клик доходит до элемента позади как раньше.
- `"modal"` — клик мимо **блокируется** и не доходит до элементов позади (`elementFromPoint` отдаёт сам модальный элемент вместо проваливания вниз), плюс Tab-фокус заперт внутри окна через focus-scope в `FocusManager` (`pushFocusScope`/`popFocusScope`). Используется диалогом несохранённых изменений (`ConfirmSaveDialogElement`).
- `"passthrough"` — клик проходит насквозь, сессия не закрывается через OverlayLayer (док-виджеты вроде Find; дропдаун меню-бара, который сам закрывается по blur/тоглу).

Пропуск `pointerPolicy` — ошибка компиляции (поле required, без дефолта), поэтому случайно «протекающий» оверлей создать нельзя.

#### Default Actions

Система default actions повторяет модель Web DOM. У каждого элемента есть встроенное поведение (default action), отделённое от клиентских event listeners.

**Порядок обработки события:**
```
1. Capture phase   (root → target)
2. Target phase
3. Bubble phase    (target → root)
4. Default action  — вызов performDefaultAction(event) на target-элементе
```

**Как работает:**
- `TUIElement` определяет protected-метод `performDefaultAction(event)` (noop по умолчанию)
- `dispatchEvent()` вызывает `performDefaultAction()` на target-элементе **после** всех фаз propagation
- Если любой listener (на любой фазе) вызвал `preventDefault()`, default action **не выполняется**
- `stopPropagation()` **не отменяет** default action — только `preventDefault()`

**Как виджеты определяют default action:**
```typescript
class MyWidget extends TUIElement {
    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type === "keydown") {
            // встроенное поведение виджета
        }
    }
}
```

**Как клиенты отменяют default action:**
```typescript
widget.addEventListener("keydown", (event) => {
    event.preventDefault(); // отменяет встроенное поведение
});
```

**Что считать default action, а что нет:**
- Default action — встроенное поведение элемента, которое клиент может захотеть отменить (открытие подменю по клику, навигация по пунктам клавишами)
- НЕ default action — internal state management (сохранение `previousFocusedElement` при focus, деактивация при blur)

**Ограничение:** `performDefaultAction` вызывается только на `event.target` (элемент, на котором произошло событие), а не на каждом элементе в цепочке propagation.

**Паттерн «click → callback»:** Когда target события — внутренний дочерний элемент (hit-test попадает в `TextLabelElement` внутри `MenuBarItemElement`), используйте bubble listener с проверкой `defaultPrevented` вместо `performDefaultAction`:

```typescript
class MenuBarItemElement extends TUIElement {
    public onActivate: (() => void) | null = null;

    constructor() {
        super();
        // click бабблится от дочернего TextLabelElement
        this.addEventListener("click", (event) => {
            if (event.defaultPrevented) return;
            this.onActivate?.();
        });
    }
}

// Родитель подписывается при создании:
const item = new MenuBarItemElement("File");
item.onActivate = () => this.openMenu(index);
```

Клиент может вызвать `preventDefault()` на capture-фазе — и `onActivate` не сработает.

### Editor/
Модель текстового редактора и виджет-мост к TUIDom. Хранение текста (пока массив строк, в планах Piece Table), состояние вида (scroll, selections, folding, курсор), undo/redo стек, TUI-виджет редактора и набор интерфейсов. Содержит подкаталог с тестовыми утилитами (TrackDSL).

**Слежение за файлом на диске и защита от затирания (à la VS Code).** `EditorController` (слой Controllers) хранит снимок `diskStat` (`mtime` + размер) файла на момент открытия/последней записи и слушает внешние изменения через инъектируемый `IFileWatcher` (`fileWatcher` ставится группой перед `openFile`). При внешнем изменении: чистый буфер — молча перечитывается с диска (`revertToDisk`), «грязный» — взводит флаг `hasDiskConflict` и событие `onDidChangeDiskState`. Сохранение (`save({ overwrite? })`) сверяет текущий stat с `diskStat`: если файл поменяли параллельно — запись отменяется (`SaveOutcome === "conflict"`), пока пользователь не подтвердит перезапись (диалог Overwrite/Cancel в `AppController`). Собственные записи отсеиваются сверкой stat (после `save`/`saveAs` снимок обновляется). Чтобы перечитка переживала пересоздание документа, подписки `onDidChangeContent`/`Language`/`Eol`/`DiskState` ретранслируются на уровне контроллера.

Документ публикует структурные изменения через `ITextDocument.onDidChangeContent(listener)` (тип `IDocumentContentChange { startLine, oldEndLine, newEndLine }`). Это событие — точка расширения для всех per-document подсистем (токенайзер, decorations, marker tracking, future Piece Tree).

У документа есть язык: `ITextDocument.languageId` (дефолт `"plaintext"`, задаётся в конструкторе), мутатор `setLanguage(languageId)` (no-op при совпадении, **не** бампает `versionId` — смена языка не делает документ dirty) и событие `onDidChangeLanguage(listener)` (тип `IDocumentLanguageChange { oldLanguageId, newLanguageId }`). Язык определяется один раз при открытии файла (`EditorController.resolveLanguageId` через `ILanguageService`) и хранится на документе; `EditorController.setLanguage` — публичная закладка под будущий language picker (`editor.action.changeLanguage`).

#### Editor/Tokenization/
Подсветка синтаксиса организована по образцу VS Code: разделены *источник токенов*, *хранилище*, *резолвер стиля* и *рендер*.

- **`IState`** + **`NULL_STATE`** — состояние токенайзера на границе строк (`clone()`, `equals(other)`). Для TextMate state — это rule stack; для stateless токенайзеров используется `NULL_STATE`.
- **`ITokenizationSupport`** — `tokenizeLine(line, state) → { tokens, endState }`. Sync MVP. Async-вариант (LSP semantic tokens) — точка расширения.
- **`ILineTokens` / `IToken`** — `IToken { startIndex, scopes: readonly string[] }` (TextMate scope stack от корня к более специфичным).
- **`TokenizationRegistry`** — DI-сервис: `register(languageId, support)`, `get(languageId)`, `onDidChange(listener)`. Резолвится по `TokenizationRegistryDIToken`.
- **`DocumentTokenStore`** — per-document Disposable. Подписан на `document.onDidChangeContent`: при изменении строк сдвигает массив кешированных токенов (splice по `lineDelta`), инвалидирует затронутые строки и опускает `invalidLineIndex`. `tokenizeUpTo(line)` догоняет токенизацию синхронно с использованием end-state оптимизации (если новый endState равен прежнему — останавливаемся, нижестоящий кеш ещё валиден). `setLineTokens(line, tokens)` — externally-pushed tokens (LSP, тесты).
- **`ITokenStyleResolver`** + **`NULL_TOKEN_STYLE_RESOLVER`** — `resolve(scopes): ResolvedTokenStyle { fg?, bg?, bold, italic, underline, strikethrough }`. Editor НЕ зависит от Theme напрямую — только от этого интерфейса.
- **`builtin/PlainTextTokenizer`**, **`builtin/WordTokenizer`** — встроенные заглушки. WordTokenizer распознаёт ~50 JS/TS-ключевых слов, числа, строки, `//`-комментарии и идентификаторы; используется как fallback до завершения async-загрузки настоящих TextMate-грамматик.
- **`textmate/`** — адаптер над [`vscode-textmate`](https://github.com/microsoft/vscode-textmate) и [`vscode-oniguruma`](https://github.com/microsoft/vscode-oniguruma) (оба MIT). `OnigLib` — singleton-loader WASM-движка regex; `TextMateState` — обёртка `StateStack` под наш `IState`; `TextMateTokenizationSupport` — реализация `ITokenizationSupport` поверх `IGrammar.tokenizeLine` с защитой от ReDoS на длинных строках; `TextMateGrammarLoader` — фабрика над `vscode-textmate.Registry`, грузит `.tmLanguage(.json)` с диска по списку `IGrammarRecord[]`. Конкретные грамматики поставляются builtin-расширениями из `src/Extensions/builtin/` (см. слой Extensions). Учебные тесты на сам `vscode-textmate` лежат в `textmate/learning/`.
- **`ILanguageService`** + **`NULL_LANGUAGE_SERVICE`** — абстракция определения `languageId` по пути файла (`getLanguageIdForResource(filePath)`) и display name для UI (`getLanguageDisplayName(languageId)` — первый alias, например `"TypeScript"`; `undefined` → потребитель показывает сырой id). Editor НЕ зависит от Extensions напрямую — только от этого интерфейса (по аналогии с `ITokenStyleResolver`). Реальную реализацию (`LanguageRegistry`) поставляет слой Extensions.

`EditorElement.render()` пользуется этими сервисами так:
1. До итерации по строкам вызывает `tokenStore.tokenizeUpTo(visibleBottomLine)`.
2. На каждый кадр строит локальный кеш `Map<scopes, ResolvedTokenStyle>` чтобы не звать резолвер повторно для повторяющихся скоупов.
3. Для каждой видимой строки конструирует `TokenIndex` (forward-cursor поиск токена по offset), резолвит стиль и применяет `fg/bg/style` к каждой ячейке.

#### Theme/Tokenization/
- **`TokenThemeResolver implements ITokenStyleResolver`** — компилирует `IEditorTokenTheme.rules` в массив правил, отсортированных по специфичности (число `.`-сегментов desc, затем порядок объявления desc — позже определённое побеждает на ties). `scopeMatches`: пустая строка матчит всё, exact, или префикс по dot-сегментам (`scope.startsWith(rule + ".")`). `foreground/background/fontStyle` каскадируются независимо: первый правило с заданным значением для каждой оси выигрывает. Кеширует резолв по `scopes.join(" ")`.

Связывание происходит на App-уровне (`main.ts`): `ExtensionScanner` находит builtin-расширения, `LanguageRegistry` собирает `contributes.languages`, `ExtensionTokenizationContributor` асинхронно регистрирует `contributes.grammars` в `TokenizationRegistry`. `TokenThemeResolver` создаётся из `WorkbenchTheme.tokenTheme`. Все три сервиса (`TokenizationRegistry`, `TokenStyleResolver`, `LanguageService`) биндятся в DI и попадают в `EditorController` → `EditorElement`.

Hot-swap токенайзера живёт в `EditorController`: он подписан на `TokenizationRegistry.onDidChange(languageId)` и на `document.onDidChangeLanguage`, и при совпадении языка с текущим документом пересаживает `DocumentTokenStore.setTokenizationSupport(...)` (полная инвалидация кеша токенов) + `markDirty`. Поэтому грамматика, догрузившаяся после открытия файла, и ручная смена языка подхватываются без пересоздания редактора. `StatusBarController` показывает язык активного редактора (display name через `ILanguageService`, fallback — сырой id) правее Ln/Col и обновляется по `onActiveEditorChanged` / `onDidChangeLanguage`.

### Extensions/
Загрузка VS Code-совместимых расширений. На текущем этапе поддерживаются только `contributes.languages` и `contributes.grammars` для builtin (`src/Extensions/builtin/`) и user-расширений (`<userData.root>/extensions/<publisher>.<name>-<version>/`). Активация (`main`/`activationEvents`), темы, команды и прочие contribution points — отдельные фазы (см. [docs/TODO/Extensions.md](TODO/Extensions.md)).

Builtin-набор — все 48 декларативных языковых паков из microsoft/vscode (bat … yaml), импортируются verbatim скриптом `scripts/import-vscode-extensions.mjs` с пином тега vscode (записан в `src/Extensions/builtin/VSCODE_VERSION`; обновление = бамп тега + перезапуск скрипта). Скрипт вычищает из паков тесты/билд/доки. Smoke-тест содержимого — `src/Extensions/BuiltinLanguagePacks.test.ts`.

- **`IExtensionManifest`** — полная типизация `package.json` расширения. Нереализованные contribution points типизированы, но закомментированы (themes, commands, keybindings, snippets, configuration, views, …) — раскомментируются по мере реализации.
- **`IExtension`** — `{ id: "${publisher}.${name}", manifest, location, isBuiltin }`.
- **`ExtensionScanner.scanExtensions(assets, rootPrefix, { isBuiltin })`** — читает подкаталоги по виртуальному префиксу через `IAssetAccess`, парсит `package.json`, валидирует обязательные поля (`name`, `publisher`, `version`), пропускает невалидные с логом. Backward-совместимая обёртка `scanBuiltinExtensions(assets, prefix)` эквивалентна `scanExtensions(..., { isBuiltin: true })`.
- **`mergeExtensions(builtin, user)`** — склеивает два списка с разруливанием конфликтов id: builtin побеждает user (с `console.warn`); дубликаты внутри одного списка тоже логируются.
- **`LanguageRegistry implements ILanguageService`** — собирает `contributes.languages`. `register(IExtension): IDisposable` инкрементально добавляет вклад (с refcounting расширений и filenames/extensions/patterns), `dispose()` — корректно убирает. `getLanguageIdForResource(filePath)`: приоритет — exact `filenames` → `filenamePatterns` (минимальный glob: `*`, `?`, case-insensitive) → `extensions` (case-insensitive). В extensions-тире два уточнения (для стокового editorconfig): dotfile, чьё имя целиком совпадает с «расширением» (`.editorconfig` при `path.extname === ""`), матчится по полному имени; при конфликте одного `.ext` у нескольких языков побеждает **зарегистрированный позже** (user поверх builtin — как в VS Code, где user-расширение грузится после builtin `properties`/ini). `getLanguageDisplayName(languageId)` — первый alias. В конструкторе seed'ится core-язык `plaintext` (`Plain Text`, `.txt`) — аналог `modesRegistry` VS Code: его не contribute'ит ни один пак, но он нужен как fallback и как запись для будущего пикера.
- **`ExtensionInstaller.ts`** — установка/удаление/список расширений из `.vsix` (CLI-флаги `--install-extension`/`--uninstall-extension`/`--list-extensions` в `main.ts`, до подъёма TUI). `installVsix(vsixPath, extensionsDir)` распаковывает `extension/`-префикс zip'а через `yauzl` (ленивый `import`, защита от zip-slip) во временный каталог, валидирует `package.json` (publisher/name/version) и атомарным `rename`'ом кладёт в `<userData>/extensions/<publisher>.<name>-<version>/` (формат, который ждёт `ExtensionScanner`), снося прежние версии того же id. `uninstallExtension` / `listInstalledExtensions` — по тому же каталогу.
- **`ExtensionTokenizationContributor`** — `apply()` собирает `IGrammarRecord[]` из всех `contributes.grammars`, создаёт `TextMateGrammarLoader`, для каждой грамматики с привязанным `language` загружает support и регистрирует в `TokenizationRegistry`. Хранит disposable-ссылки для будущей выгрузки.

#### Extensions/Host/ — extension host (real subprocess, Phase 8)

Изоляция кода расширений от ядра. Host форкает **один subprocess** (тот же бинарь / тот же `main.ts` с env-флагом `VEXX_EXTENSION_HOST=1`) и общается с ним через **RPC поверх Node IPC-канала** (`stdio: ['ignore','inherit','inherit','ipc']`).

- **`IMessageChannel`** — двунаправленный канал: `postMessage(msg)`, `onMessage(cb): IDisposable`, `dispose()`. Транспортно-агностичен.
- **`createInProcessChannelPair()`** — две `IMessageChannel`, соединённые через `queueMicrotask` + `JSON.stringify`/`parse`. Используется в unit-тестах `RpcEndpoint`.
- **`IpcMessageChannel(endpoint: IIpcEndpoint)`** — `IMessageChannel` поверх Node IPC (`process` в subprocess'е и `ChildProcess` на host-стороне реализуют общий `IIpcEndpoint`). Идемпотентный `dispose`, no-op `postMessage` после `disconnect`.
- **`RpcEndpoint(channel)`** — request/response/notification поверх `IMessageChannel`.
- **`IEditorOptionsService`** + **`EditorOptionsServiceAdapter`** — host-сервис настроек активного редактора (`tabSize`, `insertSpaces`). Адаптер обёрнут вокруг `EditorGroupController` — `Controllers` ничего не знает про расширения.
- **`buildVscodeNamespace(rpc): typeof vscode`** — тонкий ассемблер namespace `vscode`. Держит общее состояние (`DocumentRegistry` + кэш editor-объектов) и композирует `window` (`activeTextEditor.options` через Proxy → RPC `editor.setOptions`) поверх него; отдаёт value-типы как runtime-поля. Используется и subprocess'ом (через `Module._cache["vscode"]`), и потенциально in-process'ом. Здесь же — задел для WP3/WP4 (`workspace`/`commands`/`languages` поверх того же реестра).
- **`Extensions/Host/Vscode/`** — субпроцессная поверхность `vscode`:
  - **`VscodeNamespace.ts`** — тонкий ассемблер (`buildVscodeNamespace(rpc)`): держит общий `IVscodeHostContext` (`{ rpc, registry: DocumentRegistry, configStore: WorkspaceConfigStore }`, см. `VscodeHostContext.ts`) и композирует поверх него `window`/`workspace`/`languages`/`commands` + отдаёт value-типы как runtime-поля.
  - **`VscodeTypes.ts`** — чистые value-типы без RPC: `Position`, `Range`, `TextEdit`, `Uri` (file-scheme), enum'ы `EndOfLine`/`TextDocumentSaveReason`/`FileType`/`CompletionItemKind`, `CompletionItem`, `EventEmitter`, `DisposableImpl`, `FileSystemError`. Конструируются расширением (`new vscode.Position(...)`). `FileSystemError.name` в формате VS Code `"${providerCode} (FileSystemError)"` (FileNotFound → `EntryNotFound (FileSystemError)`) — некоторые расширения ловят ошибки `workspace.fs` по `name`, а не по `code` (стоковый `EditorConfig.generate`).
  - **`ExtHostDocuments.ts`** — `DocumentRegistry` (`Map<fileName, ExtHostTextDocument>`, `getOrCreate`/`upsertMeta`/`upsertFull`) со **стабильной идентичностью**: один объект на `fileName` живёт всю сессию, обновления мутируют его на месте (нужно для `activeTextEditor.document === doc` по ссылке). `ExtHostTextDocument` — `fileName`/`uri`/`languageId`/`isDirty`/`version`/`eol`/`getText`/`lineCount`/`lineAt→TextLine`; текст лениво из последнего снапшота (полный текст + `eol` — только на путях will-save и completion).
  - **`WorkspaceNamespace.ts`** — `getConfiguration(section, scope)` поверх `WorkspaceConfigStore`, `workspaceFolders`, `asRelativePath`, `openTextDocument`, `fs` (см. ниже), события `onDidChangeConfiguration`/`onWill|DidSaveTextDocument` (шлют `workspace.updateSubscriptions` на 0↔1 подписчиков). Обрабатывает host-запрос `workspace.willSaveTextDocument` (upsert full snapshot с `eol` → фаер `onWillSaveTextDocument` → сбор `waitUntil`-thenable'ов с per-listener таймаутом → сериализация `TextEdit[]`) и notify `workspace.initialize`/`configurationChanged`/`didSaveTextDocument`.
  - **`WindowNamespace.ts`** — `activeTextEditor` (стабильная идентичность editor-объекта через `WeakMap`, `options`-Proxy → RPC `editor.setOptions`), `state`, `onDidChangeActiveTextEditor` (из notify `editor.activeEditorChanged`), `showErrorMessage`/… → notify `window.showMessage`, no-op `createOutputChannel`/`onDidChangeWindowState`.
  - **`CommandsNamespace.ts`** — `registerCommand` (локальная Map + notify `commands.registerCommand`), `executeCommand` (local-first, иначе `rpc.request("commands.executeCommand")` на хост), обработка обратного host-запроса `commands.executeCommand` (для прокси-команд вроде `EditorConfig.generate`).
  - **`FileSystemNamespace.ts`** — `workspace.fs.{stat,readFile,writeFile}` **локально через `node:fs`** (без RPC — целевой файл на той же машине); ошибки `node` маппятся в `FileSystemError` с тем же `code`.
  - **`WorkspaceConfigStore.ts`** — два слоя конфигурации: `defaultsTree` (из `contributes.configuration`, dotted `applyDefaults`) под `userTree` (снапшот из `workspace.initialize`); `merged()` = user поверх defaults. Резолв `get`/`has`/`inspect`/`sectionKeys` по dotted-пути.
  - **`DocumentSelector.ts`** — `matchDocumentSelector(selector, doc)`: минимальный `languages.match` (строка/`DocumentFilter`/массив; `language`/`scheme`/`pattern`-glob c `**`). Используется completion-handler'ом в `LanguagesNamespace` для отбора провайдеров под документ.
  - **`LanguagesNamespace.ts`** — `registerCompletionItemProvider` (хранит регистрации, сигналит хосту `languages.updateSubscriptions` на 0↔1) + host-запрос `languages.provideCompletionItems` (`upsertFull` снапшот → матч селектора → вызов провайдеров → сериализация `WireCompletionItem[]`).
- **`runExtensionHostSubprocess()`** (`ExtensionHostSubprocess.ts`) — точка входа subprocess'а: поднимает `IpcMessageChannel(process)` + `RpcEndpoint`, патчит `Module._cache["vscode"]` + `Module._resolveFilename` через `installVscodeStub(rpc)`, обрабатывает RPC `host.activateExtension({ id, mainPath })` / `host.deactivateExtension` / `host.shutdown`, шлёт `host.ready` notification. Расширения загружаются через `createRequire(mainPath)(mainPath)` — канонический CJS `exports.activate(context)` / `exports.deactivate()`.
- **`IExtensionRegistration`** — `{ id, manifest, mainPath, configDefaults?, commandTitles? }`. Host передаёт subprocess'у только путь (runtime-загрузка живёт по ту сторону IPC), плюс сплюснутые дефолты `contributes.configuration` (`configDefaults`, слоятся под пользовательским снапшотом) и заголовки `contributes.commands` (`commandTitles` — id→title). `commandTitles` нужны, чтобы рантайм-`registerCommand` расширения показался в палитре: host заводит прокси в `CommandRegistry` с этим `title` (иначе команда исполнима по id, но невидима — так стал доступен `EditorConfig.generate`).
- **Save-participant seam** — `EditorController.save()` асинхронный: если задан `saveParticipant?: (ISaveSnapshot) => Promise<ISaveEdit[]>`, он `await`-ится до записи (текстовые правки клампятся к текущим границам и уходят одним undoable-батчем; смена EOL — через `setEol`). Снапшот несёт `eol` документа, чтобы `SetEndOfLine` расширения корректно решал про CRLF↔LF. Инъекция seam'а — в `Controllers/Modules/ExtensionHostModule.ts` (`group.saveParticipant = (s) => host.willSaveTextDocument(s)`, `group.onEditorSaved → host.didSaveTextDocument`, `group.completionSource = (r) => host.provideCompletionItems(r)`); ядро (`EditorController`/`EditorGroupController`) про extension-слой не знает. Wire-формы и (де)сериализация — `WireTypes.ts` (`WireTextEdit`, `WireCompletionItem`, per-request таймаут).
- **Инвентарь RPC** (симметричный `RpcEndpoint`): host→subprocess `host.{activateExtension,deactivateExtension,shutdown}`, `workspace.{initialize,configurationChanged,willSaveTextDocument(req),didSaveTextDocument(notify)}`, `languages.provideCompletionItems(req)`, `editor.activeEditorChanged(notify)`, `commands.executeCommand(req, для прокси)`. subprocess→host `host.ready`, `editor.setOptions/getOptions`, `commands.{registerCommand,unregisterCommand,executeCommand}`, `workspace.updateSubscriptions`, `languages.updateSubscriptions`, `window.showMessage`. `editor.setOptions` учит `indentSize` (алиас tabSize).
- **`ExtensionHost(editorOptions, options?)`** — host-сторона: лениво форкает subprocess через `spawn(process.execPath, ..., env { VEXX_EXTENSION_HOST: "1" })`, регистрирует RPC `editor.setOptions/getOptions`. `defaultSpawnArgs()` различает SEA-бинарь (через `require("node:sea").isSea()` — статический ESM-импорт `node:sea` ломает SEA-сборку) и dev (`process.execPath + execArgv + main script`). Тестам доступен seam `options.spawnArgs` (`subprocessSpawnArgsForTests()` в `TestUtils/`). `dispose()` — graceful `host.shutdown` → `SIGTERM` → `SIGKILL` fallback. В DI — `ExtensionHostDIToken` (см. `Controllers/Modules/ExtensionHostModule.ts`).
- **`main.ts`** содержит ранний branch на env-флаг (до CLI/TUI/loadConfiguration): subprocess уходит в `runExtensionHostSubprocess()` и живёт на IPC-канале до `host.shutdown` или `disconnect`; обычный запуск идёт в `runEditor()`.
- **`Extensions/Api/vscode.d.ts`** — дословная копия `vscode.d.ts` из microsoft/vscode, всё line-commented кроме активной поверхности (`declare module "vscode"` вверху). Активный блок сейчас: `version`/`Disposable`/`Event`/`EventEmitter`, value-типы (`Position`/`Range`/`TextEdit`/`Uri`/enum'ы `EndOfLine`/`TextDocumentSaveReason`/`FileType`/`CompletionItemKind`), `TextLine`, `TextDocument`, `window`. `tsconfig paths` маршрутизирует `import type * as vscode from "vscode"` сюда.

  **Правило роста поверхности (важно):** нужные блоки **дословно раскомментируются** из нижней части в активный модуль — их **нельзя сужать/переписывать/переоформлять** (комментарии тоже upstream). Это не «стаб под реализацию», а стадийная копия реального API. Если блок тянет ещё не раскомментированные типы (dependency closure), либо раскомментируй и их тоже, либо **отложи весь блок целиком**, пока зависимости не понадобятся, — но не подменяй их сужённой версией.
  - Пример-прецедент: `CompletionItem` (класс) отложен — его дословное раскомментирование тянет `SnippetString`/`MarkdownString`/`Command`/`CompletionItemLabel`/`CompletionItemTag`; он нужен только для completion (WP8). При этом runtime-класс живёт в `Vscode/VscodeTypes.ts` и отдаётся неймспейсом (расширение не падает на `new vscode.CompletionItem(...)`), — раскомментируется вместе с зависимостями, когда дойдут руки до WP8. То есть runtime-значение может опережать типовую декларацию (namespace отдаётся через `as unknown as typeof vscode`).

Зависимости: Extensions → Editor (через `ILanguageService`, `TextMateGrammarLoader`, `TokenizationRegistry`), Common; подмодуль `Extensions/Host` дополнительно → Controllers (через `EditorGroupController`-адаптер). Сам `EditorController` экспонирует только seam `setIndentOptions({ tabSize?, insertSpaces? })`; auto-detect indent выключается при явной установке.

### Configuration/
Сервис пользовательских настроек, аналог `IConfigurationService` из VS Code (урезанный). Источники: хардкод-дефолты приложения, `~/.vexx/user-data/User/settings.json` (default-профиль) и `~/.vexx/user-data/User/profiles/<name>/settings.json` (именованный профиль). Формат — JSONC (`jsonc-parser` от Microsoft), битый файл логируется и заменяется на пустую модель — bootstrap не падает.

Раскладка user data (VS Code-совместимая):
```
<root>/                          # default ~/.vexx ; CLI --user-data-dir <path>
  extensions/                    # внешние расширения
  user-data/
    User/
      settings.json              # default-профиль
      keybindings.json           # (парсинг пока не реализован)
      profiles/<name>/           # именованные профили
        settings.json
        keybindings.json
```

- **`resolveUserDataPaths({ userDataDir?, profile?, homedir })`** — чистая функция (`Common/UserDataPaths.ts`), возвращает `IUserDataPaths` со всеми путями. Имя профиля валидируется `/^[A-Za-z0-9._-]+$/`. Default-профиль кладёт settings прямо в `User/`, именованный — в `User/profiles/<name>/`.
- **`parseCliArgs(argv)`** — CLI-парсер (`Common/CliArgs.ts`): флаги `--user-data-dir <path>`, `--profile <name>`, `-h/--help`, `-v/--version`, разделитель `--`, неизвестные флаги → `CliArgsError`.
- **`VEXX_VERSION`** — версия приложения (`Common/Version.ts`), «зашивается» при сборке через `define` в `tsup.config.ts` (env `VEXX_VERSION` в CI: релиз `vX.Y.Z`, ночная `nightly-<hash>`; иначе git-fallback). В dev — `0.0.0-dev`. Используется `-v/--version` и окном About (`AboutDialogElement`).
- **`ConfigurationModel`** (`Configuration/ConfigurationModel.ts`) — иммутабельная модель: нормализует dotted-keys (`"editor.tabSize"` → `{editor: {tabSize}}`), deep-merge слоёв (default → user → profile), `get<T>(key, default?)`, `getValue(section?)`, diff через `collectKeys()`.
- **`IConfigurationService`** + **`ConfigurationService extends Disposable`** — `loadConfiguration(paths)` async-bootstrap, читает оба слоя через `jsonc-parser`, отсутствующий файл → EMPTY. `onDidChangeConfiguration` — пока no-op (watcher не реализован, изменения подхватываются перезапуском).
- **`NULL_CONFIGURATION_SERVICE`** — заглушка для тестов и demo, всегда возвращает `defaultValue`. Биндится через `configurationModuleDefault` в `TestProfile`.

Настройки применяются к редактору так: `IConfigurationService` биндится в DI через `configurationModule`, `EditorGroupController` инжектит сервис и при создании каждого нового `EditorController` (в `openFile`) дёргает `setIndentOptions({ tabSize, insertSpaces })` из ключей `editor.tabSize` / `editor.insertSpaces` и `setCursorSurroundingLines(...)` из `editor.cursorSurroundingLines` (сколько строк держать между курсором и краем окна при прокрутке — VS Code `cursorSurroundingLines`, дефолт здесь 3). `EditorController.setIndentOptions` принудительно выключает auto-detect.

Тестовая фикстура `test-fixtures/vexx-home/` повторяет реальную раскладку и подключается флагом `--user-data-dir ./test-fixtures/vexx-home` — даёт возможность ткнуть приложение без влияния на `~/.vexx`. Профиль `compact` в фикстуре (`--profile compact`) демонстрирует переопределение `editor.tabSize`.

### Theme/
Система темизации, совместимая с VS Code theme files. Тема — объект `WorkbenchTheme` в DI-контейнере (`WorkbenchThemeDIToken`), хранящий packed RGB цвета и правила подсветки синтаксиса. Контроллеры применяют цвета к элементам через `applyTheme()`, TUIDom ничего не знает о темах.

- **IThemeFile** — типизация для theme JSON (формат совместим с VS Code 1:1)
- **IWorkbenchColors** — интерфейс со всеми ~700 цветовыми ключами VS Code (большинство закомментировано, раскомментируются по мере реализации)
- **IEditorTokenTheme** — правила подсветки синтаксиса (TextMate token colors)
- **WorkbenchTheme** — основной класс с методами `getColor(key)` / `getColorOrDefault(key, default)`, статический `fromThemeFile(json)` парсит hex→packRgb при загрузке
- **ColorUtils** — `parseHexColor()` — конвертация hex-строк (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) → packed RGB
- **themes/** — встроенные темы (Dark+)

Зависимости: Theme зависит от Rendering (ColorUtils/packRgb), Common (DI primitives). Находится на одном уровне с Controllers.

### Controllers/
Контроллеры приложения с чётким жизненным циклом. Каждый контроллер реализует `IController` (extends `IDisposable`):
- **constructor** (sync) — создаёт UI-скелет (`view`), все поля non-null
- **mount()** — подписка на события, wiring после вставки view в DOM-дерево
- **activate()** (async) — загрузка данных, инициализация внешних сервисов
- **dispose()** — cleanup ресурсов (LIFO через `Disposable.register()`)

Родительский контроллер создаёт дочерние, вставляет их `view` в своё дерево, вызывает `mount()` и `activate()`. Текущие контроллеры: `AppController` (корневой, меню, шорткаты), `EditorController` (текстовый редактор).

**`IFileWatcher`** (`Controllers/IFileWatcher.ts`, токен `IFileWatcherDIToken`) — абстракция слежения за отдельным файлом (`watchFile(path, onChange)`). Реальная реализация — `ChokidarFileWatcher` (поверх chokidar, как в файловом дереве; исключена из юнит-покрытия — реальный IO), заглушка — `NULL_FILE_WATCHER`. Биндится модулем `fileWatcherModule`/`fileWatcherModuleDefault`. `EditorGroupController` инжектит watcher в каждый `EditorController` для детекта внешних изменений открытого файла (см. слой Editor). Директории дерева файлов слушаются отдельно, прямо в `FileTreeDataProvider` (chokidar per-dir); команда `workbench.files.action.refreshFilesExplorer` («Refresh Explorer» в контекст-меню дерева) перечитывает состав каталогов с диска вручную.

Соглашения для системы команд в слое Controllers:
- ID команд, которые отражают поведение VS Code Workbench/Editor, именуются в стиле VS Code (например `workbench.action.nextEditorInGroup`, `workbench.action.closeActiveEditor`).
- Доступность кейбиндингов определяется typed when-контекстами из `ContextKeys.ts` и вычисляется через `ContextKeyService`.
- Фокусные и UI-состояния (например `textInputFocus`, `editorGroupHasEditors`, `editorTabsMultiple`) обновляются в `AppController.updateContextKeys()`.
- Кейбинды адаптируются к терминалу по трём осям — capability (флаги), **tier** (`legacy < csi-u < kitty`, пресет флагов) и **mode** (`local`/`ssh`/`tmux` + кастомные). Они доступны в when-клаузах как `tier == 'kitty'`, `cap_osc52`, `mode_ssh`, `os == 'mac'`. Default-бинды задают tier-зависимые fallback'и через per-binding `when` в `CommandAction.keybindings` (`{ keys, when }`); пользовательские бинды — через `keybindings.json` (загрузчик в `Configuration/KeybindingsService.ts`, применение — `AppController.applyUserKeybindings`, VS Code-семантика `-command` для unbind).

Подкаталог **`Controllers/Workspace/`** — единая система отмены уровня workspace (à la VS Code `WorkspaceEdit`/`IUndoRedoService`). `UndoRedoService` хранит историю по контекстным бакетам (путь ресурса для редактора либо `WORKSPACE` для файловых операций) — Ctrl+Z в дереве (`when: listFocus`) и в редакторе (`textInputFocus`) не пересекаются, но проходят через один сервис и модель `IUndoRedoElement`. `WorkspaceEditService.applyFileEdits(ResourceFileEdit[])` исполняет файловые правки (delete/move/copy из `WorkspaceEdit.ts`) и кладёт обратимый элемент в историю; удаление идёт в системную корзину через `TrashService` (реализация freedesktop-спеки — перенос в `$XDG_DATA_HOME/Trash` + `.trashinfo`, восстановление контролируем сами), а если корзина недоступна (или `files.enableTrash:false`) — безвозвратно и без записи в историю. ФС-операции переиспользуют `Actions/fileClipboardFs.ts`. Зависит от `IConfigurationService` (`explorer.confirmDelete`/`explorer.confirmUndo`/`files.enableTrash`). Подтверждения рисует `AppController` через `ConfirmDialogElement` (`overlayLayer.createSession(pointerPolicy:"modal")`). Текстовая отмена редактора тоже идёт через этот сервис: `UndoManager` (Editor-слой) остаётся движком inverse-edits, но каждый его `pushUndoElement` через хук `onDidPush` регистрирует обёртку в `UndoRedoService` под контекстом = путь файла (`EditorController.attachUndoRouting`); `EditorController.undo/redo` делегируют сервису. Так Ctrl+Z в редакторе (`textInputFocus`) и в дереве (`listFocus`) — один сервис, разные бакеты.

Подкаталог **`Controllers/TerminalEnvironment/`** — детект окружения: `TerminalEnvironmentService` резолвит tier/capabilities/modes/OS **синхронно** из переменных окружения (`$TERM`/`$COLORTERM`/`$TMUX`/`$SSH_*`/флаги вроде `$KITTY_WINDOW_ID`) — старт не блокируется. Дополнительно `detect()` запускает **fire-and-forget** пробу клавиатурного протокола: метод `ITerminalBackend.probeKeyboardProtocol(onResult)` инкапсулирует весь обмен escape-последовательностями (Kitty-флаги `ESC[?u` + DA1 `ESC[c`; ответы приходят как `device-report` токены из `Input/tokenize.ts`) — наружу торчит только булев результат. Проба может лишь **повысить** `extended-keys` (внутри tmux/ssh, где `$TERM` маскируется), после чего летит `onDidChange`; никто её не ждёт. Чистая модель/резолверы — `TerminalEnvironmentModel.ts`. Сервис зависит от `ITerminalBackend` (через `TerminalBackendDIToken`) и `IConfigurationService`; конфиг-секция `terminal.*` форсит tier/capabilities/modes.

Зависимости контроллеров объявляются через `static dependencies` и резолвятся DI-контейнером из `Common/DiContainer.ts` при старте приложения. Подробности — [docs/DI.md](DI.md).

Подкаталог `Controllers/Modules/` содержит модули конфигурации DI (`coreModule`,
`commandsModule`, `themeModule` и т.д.) и профили (`createProductionContainer`,
`createTestContainer`). Здесь же группируются связи между токенами — точечные
вариации (production vs test) задаются через `Ctx`-параметры модулей. Подробности
— [docs/DI.md](DI.md#модули-и-профили).

### demos/
Демо-приложения для ручного тестирования отдельных компонентов. Подкаталог **`demos/tuidom/`** — песочница про **хостинг приложения**: как напрямую поднимается `TuiApplication` на `NodeTerminalBackend` (базовые сущности явно, без обёрток), в отличие от `StoryRunner`, который показывает отдельные виджеты.

### StoryRunner/
Лёгкий CLI-раннер для интерактивных stories (по аналогии со Storybook). Story-файлы (`*.stories.ts`) живут рядом с компонентами и экспортируют именованные функции-стори. Раннер автоматически создаёт `TuiApplication` + `BodyElement`, вызывает выбранную стори и запускает приложение.

Запуск: `npm run story -- <story-file> [story-name] [extra-args...]`

### TestUtils/
Общие утилиты для тестов (визуальные assertions для экрана). `ExtensionTestHarness.createExtensionTestHarness({ initialFile?, extensions? })` поднимает реальный `EditorGroupController` + `ExtensionHost` поверх `TestApp`/`MockTerminalBackend`. `ExtensionHost` форкается через `subprocessSpawnArgsForTests()` — `node --import tsx/esm src/Extensions/Host/__fixtures__/subprocessEntry.ts` (в vitest `process.argv[1]` указывает на vitest CLI, не на `main.ts`). Тестовые расширения лежат рядом — `*.cjs` файлы с `exports.activate = function(ctx) { var vscode = require("vscode"); ... }`.

### Inspector/
Инспектор TUIDom («браузерный дебаг-порт»): сериализация дерева элементов и протокол поверх WebSocket. `InspectorCore` — transport-agnostic ядро: держит read-only ссылку на приложение через `InspectorTarget { getRoot, getFocused }` и отвечает на методы протокола (`TUIDom.getDocument`); методы — расширяемый реестр. `InspectorServer` — рукописный WebSocket (RFC6455) поверх `node:http`, без runtime-зависимостей. `attachInspector(app)` поднимает порт поверх работающего `TuiApplication`, читая его read-only (сам `TuiApplication` не трогается). Транспорт-агностичность ядра — задел под встроенный in-process инспектор (split-screen): тот же `InspectorCore` без сети.

## Правила зависимостей

```
App → Extensions → Controllers → Editor → TUIDom → { Input, Rendering, Backend } → Common
          ↑           ↑              ↑
        Theme ────────┘──────────────┘ (через ITokenStyleResolver/ILanguageService;
                                         Editor НЕ импортирует Theme/Extensions)
        Theme → { Rendering, Common }
```

- **Common** не импортирует ничего из проекта
- **Input**, **Rendering** зависят только от Common
- **Backend** зависит от Input, Rendering, Common
- **TUIDom** зависит от Rendering, Common (через TerminalScreen)
- **TUIDom/Events** используют тип TUIElement — это внутренняя зависимость TUIDom
- **Editor** зависит от TUIDom, Rendering (ColorUtils), Common. **Не зависит** от Theme и Extensions — связь через интерфейсы (`ITokenStyleResolver`, `ILanguageService`)
- **Theme/Tokenization** реализует `ITokenStyleResolver` из `Editor/Tokenization`
- **Extensions** реализует `ILanguageService` из `Editor/Tokenization`, использует `TextMateGrammarLoader`/`TokenizationRegistry` для регистрации грамматик. Подмодуль **`Extensions/Host`** дополнительно зависит от `Controllers` (через `EditorGroupController`-адаптер) — единственное место, где Extensions поднимается выше Controllers.
- **Controllers** зависит от Editor, TUIDom, Theme, Configuration, Common и от интерфейса `Backend` (`ITerminalBackend` через `TerminalBackendDIToken` — `TerminalEnvironmentService` пробит терминал; Backend ниже по стеку)
- **App** (main.ts) зависит от всех слоёв и оркеструет загрузку builtin-расширений до bootstrap DI
- **Inspector** зависит от TUIDom (чтение дерева/типов) и Common; транспорт — встроенный `node:http` (рукописный WebSocket, без сторонних зависимостей). Не зависит от Controllers/Editor

### DI-контейнер: границы использования

Примитивы DI (`Token`, `Container`, `token()`) реализованы в `Common/DiContainer.ts`, но **объявлять конкретные DI-токены и импортировать `Container`** можно **только на уровнях Controllers и App**. Слои ниже (Editor, TUIDom, Input, Rendering, Backend) не должны зависеть от DI-контейнера.

Все DI-токены именуются по конвенции `*DIToken` (например `EditorControllerDIToken`, `TuiApplicationDIToken`). Подробности — [docs/DI.md](DI.md).
