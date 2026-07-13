# Исследование: миграция vexx на структуру репозитория VS Code

> Статус: черновик исследования (в работе). Цель — оценить стоимость и целесообразность
> «синхронизации» структуры `src/` vexx со структурой `src/vs/` upstream VS Code,
> чтобы упростить подсматривание решений и перенос кода из upstream.
> Upstream для анализа: `/workspaces/vscode` (main, июль 2026).

## 1. Как устроен VS Code (факты)

### Два ортогональных измерения структуры

VS Code организует код по **двум осям одновременно**:

1. **Вертикальные слои** (стек, нижние не знают о верхних):
   `base → platform → editor → workbench → code|server|sessions`
2. **Target environments** (горизонтальное разбиение внутри каждого слоя):
   `common / browser / node / electron-browser / electron-utility / electron-main / worker`

Обе оси формально закодированы в `eslint.config.js` upstream:

- `local/code-layering` — матрица разрешённых зависимостей окружений:
  `common → []`, `node → [common]`, `browser → [common]`,
  `electron-browser → [common, browser]`, `electron-utility → [common, node]`,
  `electron-main → [common, node, electron-utility]`.
- `local/code-import-patterns` — правила стека, например:
  - `src/vs/base/~` → только `vs/base/~`
  - `src/vs/platform/*/~` → `vs/base/~`, `vs/base/parts/*/~`, `vs/platform/*/~`
  - `src/vs/editor/~` → base + platform + editor
  - `src/vs/workbench/~` → base + platform + editor (+ editor/contrib) + workbench
  - `~` — шаблон, разворачивающийся в список окружений (common, browser, …, test/*)

Масштаб upstream: ~7450 .ts файлов в `src/vs` (vexx: ~340 не-тестовых + ~410 тестовых).

### Вертикальные слои (стек)

| # | Слой | Назначение |
|---|------|-----------|
| 1 | `base/` | Утилиты и UI-примитивы без сервисных зависимостей. `base/parts/*` — обособленные подсистемы (IPC, quickinput) |
| 2 | `platform/` (~106 каталогов) | DI (`instantiation`) + базовые сервисы: files, configuration, log, contextkey, commands, theme, markers, storage… |
| 3 | `editor/` | Ядро Monaco. `editor/common` **полностью отвязан от DOM** (проверено grep'ом — 0 импортов browser-кода из 224 файлов), `editor/browser` — view/DOM, `editor/contrib/*` — фичи редактора |
| 4 | `workbench/` | Воркбенч: `browser/parts/*` (layout-части), `services/*` (~60), `contrib/*` (~90 фич), `api/` (extension host) |
| 5 | `code/` · `server/` · `sessions/` | Точки входа приложений (desktop, remote server, agent sessions) |

Плюс `src/vs/nls.ts` (локализация, импортируется отовсюду) и `src/vs/amdX.ts`
(загрузка внешних node-модулей из ESM).

### Target environments (горизонталь)

Внутри каждого слоя код разложен по подкаталогам-окружениям: `common` (чистый JS),
`browser` (DOM), `node` (Node API), `worker`, `electron-browser`, `electron-utility`,
`electron-main`. `common` не видит ничего, `browser` и `node` видят только `common`
и друг друга не видят.

### Contrib-модель (workbench/contrib/*)

- Каждая фича — каталог `contrib/<имя>/{common,browser,electron-browser,test}/`.
- Точка входа — `*.contribution.ts`: side-effect регистрации через
  `registerWorkbenchContribution2(ID, Class, WorkbenchPhase.*)` и `registerSingleton(...)`.
  Все contribution-файлы импортируются из `workbench.common.main.ts` /
  `workbench.desktop.main.ts` (у vexx аналог — `main.ts` + `Controllers/Modules/`).
- Ядро workbench **не может** импортировать contrib; contrib-to-contrib — только
  через единый публичный common-файл фичи (защищено правилом
  `code-no-deep-import-of-internal`).

### Сервисная модель

Сервис = интерфейс с `_serviceBrand` + идентификатор через `createDecorator<T>('id')`
(одновременно тип и декоратор параметра конструктора) + реализации по окружениям +
`registerSingleton(IFoo, Foo, InstantiationType.Delayed)` (~358 файлов используют).

### Именование

camelCase-каталоги, файл = имя главного класса (`explorerService.ts` → `ExplorerService`),
окружение = подкаталог, тесты в `test/<environment>/`, `*.contribution.ts` для регистраций.

### Где у vscode задокументирована организация исходников

- `.github/instructions/source-code-organization.instructions.md` — каноничный документ
  (слои, окружения, contrib-правила, DI).
- `src/vs/sessions/LAYERS.md` — образец, как описывать новый слой-«приложение» над workbench.
- Контроль трёхуровневый: eslint-правила + `build/checker/layersChecker.ts`
  (`npm run valid-layers-check`) + per-environment tsconfig'и в `build/checker/`.

## 2. Инвентаризация vexx: что уже «списано» с VS Code

Размеры слоёв (non-test): Common ~2.5k строк, Input ~1.6k, Rendering ~0.8k,
Backend ~0.9k, TUIDom ~8k, Editor ~5k, Extensions ~30k (из них ~28k — builtin
языковые паки), Configuration ~0.9k, Theme ~6k, Controllers ~10.5k, Inspector ~0.6k.
Итого ~70k строк продуктового кода против миллионов у upstream.

### Уже прямые кальки vscode (имена/контракты/форматы совпадают)

- `ILogService`/`ILogger` + sinks (Common/Logging) ← `vs/platform/log`
- `IConfigurationService`/`ConfigurationModel`, слои default/user/profile ← `vs/platform/configuration`
- `StateService` (`IStorageService`/`Memento`) ← `vs/platform/storage`
- `MarkerService`/`MarkerSeverity` (Editor/Markers) ← `vs/platform/markers`
- `TokenizationRegistry`/`ITokenizationSupport`/`IState`/`NULL_STATE`, `ILanguageService` ← `vs/editor/common/languages`
- `ContextKeyService` + when-контексты ← `vs/platform/contextkey`
- `UndoRedoService`/`WorkspaceEdit`/`TrashService` (Controllers/Workspace) ← `vs/platform/undoRedo`, workbench
- `ScrollableElement`, quick-input, editor tabs, `OverlayLayer`≈`ContextView` (TUIDom/Widgets) ← `vs/base/browser/ui/*`, `vs/base/parts/quickinput`
- VS Code-style command IDs, keybindings.json/settings.json (JSONC-семантика)
- Формат theme-файлов + встроенные темы verbatim; color registry (`IWorkbenchColors`/`defaultColors`) ← `vs/platform/theme`
- `vscode.d.ts` verbatim (pinned 1.127.0) + extension host subprocess/RPC ← `vs/workbench/api`, `vs/workbench/services/extensions`
- Folding по отступам ← `vs/editor/contrib/folding`
- Builtin git + 48 языковых паков ← `extensions/*` upstream

### Собственные подсистемы без прямого аналога (терминальная природа)

- **Rendering** (grid/double-buffer/ANSI-diff/GridSnapshot) — у vscode это DOM/canvas/GPU
- **Input** (stdin → токены → browser-like KeyPressEvent, Kitty protocol) — у vscode это настоящий DOM
- **Backend** (`ITerminalBackend` + Node/Mock/HeadlessCapture) — терминальный I/O
- **TUIDom-ядро** (дерево, layout, события, JSX) — аналог самого браузерного DOM,
  но виджеты поверх него копируют `vs/base/browser/ui/*`
- **Inspector** (дебаг-порт, рукописный WebSocket), **TerminalEnvironment** (tier/capabilities probe)
- **StoryRunner/demos** — dev-тулинг (аналог Storybook)

## 3. Инфраструктурные примитивы: vexx vs vscode (стоимость сближения)

| Область | Вердикт | Стоимость | Комментарий |
|---------|---------|-----------|-------------|
| Disposable/lifecycle | близко (наше — подмножество) | **S** | `vs/base/common/lifecycle.ts` можно взять почти дословно; `register` → `_register`, добавить `DisposableStore`/`MutableDisposable` |
| События | другая реализация, совместимая сигнатура | **M** | Центрального `Emitter` у нас нет — везде ad-hoc массивы коллбэков, но паттерн `onDidX(listener): IDisposable` уже vscode-совместим. `event.ts` — drop-in, далее ~15–20 механических замен |
| DI | другая модель, изоморфна по смыслу | **L** (не делать) | vscode: `createDecorator` + параметрные декораторы. vexx: `Token` + `static dependencies` — сознательно, ради erasable syntax / type-stripping. Переход на декораторы ломает сборку SEA. **Оставить нашу модель**, сближать только именование |
| Logging | близко | S–M | наш `Common/Logging` ≈ `vs/platform/log`; вопрос только размещения в структуре |
| Конфигурация | близко (ядро совпадает) | **M** | `ConfigurationModel` семантически совпадает. У нас нет `configurationRegistry` (схемы/скоупы), folder-слоя, live-событий — всё аддитивно |
| Storage/State | близко | M | `StateService` ≈ `platform/state` + скоупы `IStorageService`; наша дескрипторная модель (version/migrate) чище — сохранить |
| Реестры | другая модель | M (не делать) | у vscode глобальный синглтон `Registry.as(...)`; у нас DI-инстансы реестров — чище для тестов. Доменные реестры уже функционально совпадают |
| Команды | близко | M | `CommandRegistry` — упрощённый `CommandsRegistry` |
| Context keys | другая модель | **L** | у нас `when` вычисляется через `new Function(...)`; у vscode — типизированный AST `ContextKeyExpr` + scoped overlays. Кандидат на прямой перенос парсера из upstream (уже в TODO/WhenContext) |
| Actions/меню | нет у нас | L–XL | `MenuRegistry`/`MenuId`/`registerAction2` отсутствуют; вводить только когда понадобятся декларативные меню |
| Геометрия/Assets/Unicode-width | уникальны для vexx | N/A | `BoxConstraints` (Flutter-подобный layout), SEA-бандл, терминальная ширина символов — аналогов в vscode нет, оставить как есть |

## 4. Маппинг UI-слоя: Controllers/Editor/TUIDom → workbench/editor/base

Главное структурное расхождение: **vexx плоский, vscode трёхосный**. Один vexx-контроллер
часто соответствует «part + contrib + service» в vscode. Ключевые соответствия:

### Controllers → workbench + platform

| vexx | vscode | Степень |
|------|--------|---------|
| `AppController.ts` (94 KB, god-object) | `workbench/browser/workbench.ts` + `layout.ts` + десятки `*.contribution.ts` | у нас монолит — главный кандидат на декомпозицию |
| `EditorGroupController` | `workbench/browser/parts/editor/editorPart.ts`, `editorGroupView.ts` | прямой |
| `EditorController` (40 KB) | `parts/editor/textEditor.ts` + `workbench/services/textfile` + `editor/browser/widget` | смешивает editor pane и text-file-service |
| `FileTreeController` + `FileTreeDataProvider` | `workbench/contrib/files/browser/views/explorerView.ts` + `explorerModel.ts` | прямой |
| `StatusBarController` / `PanelController` | `parts/statusbar` / `parts/panel` | прямой |
| `ProblemsController` + `Diagnostics/` | `workbench/contrib/markers` | прямой |
| `QuickOpenController` / `QuickInputController` | `workbench/contrib/quickaccess` / `platform/quickinput` | прямой |
| `FindController`, `CompletionController` | `editor/contrib/find`, `editor/contrib/suggest` | прямой (у vscode это editor/contrib, не workbench!) |
| `CommandRegistry`, `KeybindingRegistry`, `ContextKeyService` | `platform/commands`, `platform/keybinding`, `platform/contextkey` | прямой |
| `Workspace/UndoRedoService` | `platform/undoRedo` | прямой, но лежит «не в том слое» |
| `Workspace/WorkspaceEditService` | `workbench/contrib/bulkEdit` | прямой |
| `FileSearchService`, `ChokidarFileWatcher` | `workbench/services/search`, `platform/files/node/watcher` | прямой |
| `Actions/*` (21 файл в одной папке) | размазаны по `*.contribution.ts` каждой фичи | у нас иначе — по типу, у них по фиче |
| `Modules/` (DI-композиция, профили) | нет аналога (registerSingleton + side-effect imports) | наша модель, сохранить |
| `TerminalEnvironment/` | нет аналога (терминальная специфика) | оставить |

### Editor: что лежит «не в том слое» относительно vscode

- `Editor/Markers/MarkerService` → у vscode `platform/markers`
- `Editor/Tokenization/textmate/*` → у vscode `workbench/services/textMate`
- `ITokenStyleResolver` + `Theme/Tokenization/TokenThemeResolver` → `platform/theme` + `workbench/services/themes`
- `ILanguageService`/`LanguageRegistry` (в Extensions) → `editor/common/languages` + `workbench/services/language`
- `ISaveParticipant` → `workbench/services/textfile`
- `EditorViewState` — один класс объединяет то, что у vscode разнесено на
  `viewModel` / `viewLayout` / `cursor` (разнос — отдельный крупный рефакторинг, не обязателен)

### Extensions/Host ↔ workbench/api

Архитектура RPC концептуально совпадает (subprocess, симметричный канал, namespace-шим
`vscode`, main-side адаптеры ≈ `mainThread*`). Отличия: у нас строковая адресация методов
вместо типизированных `ProxyIdentifier`/`ExtHostContext`/`MainContext` (~169 прокси у vscode),
свой конверт вместо бинарного протокола, один host без lazy/remote/worker-вариантов.
Маппинг: `Host/Vscode/*Namespace.ts` ↔ `workbench/api/common/extHost*.ts`,
`Host/*ServiceAdapter.ts` ↔ `workbench/api/browser/mainThread*.ts`.

### TUIDom/Widgets ↔ vs/base/browser/ui

Прямые аналоги: `ScrollableElement`↔`ui/scrollbar`+`common/scrollable`, `TreeViewElement`↔`ui/tree`,
`InputElement`↔`ui/inputbox`, `ButtonElement`↔`ui/button`, `SashElement`↔`ui/sash`,
`PopupMenuElement`/`MenuBarElement`↔`ui/menu`, диалоги↔`ui/dialog`, `OverlayLayer`≈`ui/contextview`.
Виджеты `EditorGroupElement`/`EditorTabStrip*`/`StatusBarElement` у vscode — не base-виджеты,
а workbench parts (при миграции — решить, куда класть; допустимо оставить в base/ui).

### Чего у vexx нет совсем (пустые места будущей структуры)

Parts: activitybar, auxiliarybar, titlebar, notifications, generic views/viewContainers.
Contrib: scm (UI), debug, terminal, notebook, testing, webview, chat, outline, tasks,
snippets, timeline, mergeEditor, extensions-UI и др.
Services: progress, history (навигация), notification, activity, authentication, telemetry и др.
Это не блокер — структура vscode спокойно живёт с «дырками», наоборот: пустые места
показывают, куда класть будущие фичи.

---

## 5. Целевая структура vexx (предложение)

Принцип: **вертикальные слои и пути повторяем буквально** (`src/vs/...` — чтобы путь файла
диффался с upstream 1:1), **ось окружений адаптируем**: вместо `browser` вводим `tui`
(наш «браузер» — терминал). Альтернатива — буквально назвать каталоги `browser` ради
100% совпадения путей; честнее `tui`, маппинг browser↔tui тривиален.

```
src/vs/
├── base/
│   ├── common/            ← Common/* (Disposable→lifecycle, event, геометрия, Unicode,
│   │                         fuzzy, DiContainer→instantiation-примитивы, TypingUtils)
│   ├── tui/               ← TUIDom-ядро (TUIElement, события, стили, JSX, layout)
│   │   └── ui/*           ← TUIDom/Widgets — по каталогу на виджет, имена как в
│   │                         vs/base/browser/ui (scrollbar/, tree/, inputbox/, button/,
│   │                         sash/, menu/, dialog/, contextview/ …)
│   └── node/              ← node-специфичные утилиты (SEA/IsSea, Assets/Fs*)
├── tui/                   ← НАШ СЛОЙ ВНЕ vscode-стека: «движок браузера»
│   ├── rendering/         ← Rendering (Grid, Cell, TerminalRenderer, GridSnapshot, gridToSvg)
│   ├── input/             ← Input (tokenize, KeyInputParser, mouseTracking)
│   └── backend/           ← Backend (ITerminalBackend, Node/Mock/HeadlessCapture)
├── platform/              ← сервисы «ниже editor»
│   ├── instantiation/     ← DiContainer (НАША токенная модель, путь vscode-овский)
│   ├── log/               ← Common/Logging
│   ├── configuration/     ← Configuration (без StateService)
│   ├── state/             ← StateService (+ StateKeys дескрипторы остаются выше)
│   ├── markers/           ← Editor/Markers ★перенос слоя
│   ├── undoRedo/          ← Controllers/Workspace/UndoRedoService ★перенос слоя
│   ├── commands/          ← CommandRegistry, CommandAction
│   ├── contextkey/        ← ContextKeyService, ContextKeys
│   ├── keybinding/        ← KeybindingRegistry + KeybindingsService
│   ├── quickinput/        ← QuickInputController + QuickPick-модель
│   ├── theme/             ← IWorkbenchColors, defaultColors, ColorUtils (color registry)
│   ├── clipboard/         ← IClipboard, OscClipboard, файловый клипборд
│   ├── files/             ← IFileWatcher, ChokidarFileWatcher, TrashService
│   ├── environment/       ← CliArgs, UserDataPaths, TerminalEnv, Version
│   ├── extensions/        ← IExtension, IExtensionManifest, ExtensionScanner
│   └── extensionManagement/ ← ExtensionInstaller (.vsix)
├── editor/
│   ├── common/
│   │   ├── core/          ← IPosition, IRange, ISelection, EndOfLine, ITextEdit
│   │   ├── model/         ← TextDocument, UndoManager, IDocumentContentChange
│   │   ├── viewModel/     ← EditorViewState (разнос на viewModel/viewLayout/cursor — позже)
│   │   └── languages/     ← TokenizationRegistry, ITokenizationSupport, IState,
│   │                         ILanguageService (интерфейс), DocumentTokenStore,
│   │                         WordClassification, AutoIndent
│   ├── tui/               ← EditorElement (виджет-мост; аналог editor/browser)
│   └── contrib/
│       ├── folding/       ← FoldingRangeProvider + FoldingActions
│       ├── find/          ← findMatches + FindController + FindActions
│       └── suggest/       ← CompletionController + collectWordCompletions + SuggestActions
├── workbench/
│   ├── tui/
│   │   ├── workbench.ts   ← остатки AppController (bootstrap воркбенча)
│   │   ├── layout.ts      ← layout-логика (+ WorkbenchLayoutElement?)
│   │   └── parts/         ← editor (EditorGroupController + таб-виджеты), statusbar, panel
│   ├── services/
│   │   ├── textMate/      ← Editor/Tokenization/textmate ★перенос слоя
│   │   ├── themes/        ← ThemeService, ThemeRegistry, WorkbenchTheme, builtin themes
│   │   ├── textfile/      ← save/watch/conflict-часть EditorController, ISaveParticipant
│   │   ├── language/      ← LanguageRegistry (из Extensions)
│   │   ├── search/        ← FileSearchService
│   │   └── extensions/    ← Host/ExtensionHost (manager), ExtensionTokenizationContributor
│   ├── contrib/
│   │   ├── files/         ← FileTreeController, FileTreeDataProvider, FileActions,
│   │   │                     FileTreeActions, InputWidgetController
│   │   ├── markers/       ← ProblemsController, ProblemsTreeDataProvider
│   │   ├── quickaccess/   ← QuickOpenController, QuickOpenParsing, QuickOpenActions
│   │   ├── bulkEdit/      ← WorkspaceEditService, WorkspaceEdit
│   │   ├── preferences/   ← SettingsDiagnostics, PreferencesActions
│   │   ├── themes/        ← ThemeActions (пикер)
│   │   └── …              ← остальные Actions/* по фичам
│   ├── api/               ← Extensions/Host: Vscode/*Namespace (extHost-сторона),
│   │                         *ServiceAdapter (mainThread-сторона), RpcEndpoint, WireTypes
│   └── terminalEnvironment/ ← TerminalEnvironment (vexx-специфичный сервис)
└── vexx/                  ← точка входа (аналог vs/code): main.ts, Modules/ (DI-профили),
                              subprocess-entry extension host

вне src/vs: Inspector/, StoryRunner/, TestUtils/, demos/ — dev-тулинг, аналогов в
src/vs upstream нет (можно оставить в src/ рядом с vs/ или вынести в tools/)
```

`extensions/builtin/*` (48 языковых паков + git) уже зеркалят upstream `extensions/*` —
можно поднять из `src/Extensions/builtin` в корневой `extensions/`, как у vscode.

## 6. Что сознательно НЕ повторяем

| Что | Почему |
|-----|--------|
| **DI на декораторах** (`createDecorator`, `@IFoo`) | ломает erasable-syntax/type-stripping и SEA-сборку; наша токенная модель изоморфна. Повторяем только **путь** `platform/instantiation` и правило размещения токенов |
| **Глобальный `Registry`-синглтон** + side-effect `*.contribution.ts` | наша явная композиция через `Modules/` чище для тестов; contribution-файлы vscode требуют глобального состояния. Компромисс: внутри contrib-каталогов заводить `*.module.ts` — аналог contribution-точки, но регистрируемый явно в профиле |
| **Тесты в `test/<env>/`** | у нас колокация `Foo.test.ts` рядом с кодом (закреплена в AGENTS.md) — сохранить; парность путей важна для продуктового кода, не для тестов |
| **`nls.ts`/локализация** | преждевременно; при появлении i18n — завести `nls.ts` с той же сигнатурой |
| **JSX-рантайм TUIDom** | наша фича, vscode-аналога нет |
| **Rendering/Input/Backend внутрь base/browser** | это не «browser-код», а замена самого браузера — отдельный корень `src/vs/tui/` ниже base не по стеку vscode, но честно отражает роль |
| **Бинарный RPC-протокол + 169 ProxyIdentifier** | наш строковый конверт достаточен на текущем масштабе; типизированные прокси-идентификаторы — точечное улучшение потом |
| **MenuRegistry/MenuId/registerAction2** | у нас нет декларативных меню; вводить при необходимости, тогда уже по vscode-образцу |

Спорные (решить в момент миграции): camelCase-имена файлов как у vscode
(`scrollableElement.ts` вместо `ScrollableElement.ts`) — рекомендую принять, раз файлы
всё равно переезжают: парность путей — главный профит всей затеи; `tui` vs буквальный
`browser` в путях.

## 7. Оценка стоимости

Общий вердикт: **посильно и выгодно**. ~90% работы — механический перенос
(git mv + правка импортов, автоматизируемо кодемодом), ~10% — настоящие рефакторинги,
и они опциональны/отделимы. Объём: ~340 продуктовых + ~410 тестовых файлов.

Фазы (размер: S — часы, M — день-два, L — неделя агентной работы с ревью):

| Фаза | Содержание | Размер | Риск |
|------|-----------|--------|------|
| **0. Тулинг** | скрипт-кодемод переноса (git mv + переписывание импортов), eslint-правило слоёв по образцу `local/code-layering`/`code-import-patterns` (или dependency-cruiser), обновление tsup/vitest/e2e путей | M | низкий |
| **1. base** | Common → `vs/base/common`; принять `lifecycle.ts` (S) и `event.ts`+`Emitter` (M, ~15–20 мест ad-hoc listeners); TUIDom → `vs/base/tui` + нарезка Widgets на `ui/*`-каталоги | M–L | низкий |
| **2. tui-движок** | Rendering/Input/Backend → `vs/tui/*` — чистый перенос | S | низкий |
| **3. platform** | вынос из Editor/Controllers/Configuration/Common: log, configuration, state, markers★, undoRedo★, commands, contextkey, keybinding, quickinput, theme-registry, clipboard, files, environment, extensions. Переносы слоя (★) уже развязаны интерфейсами — в основном mv | M | средний (много правок импортов разом) |
| **4. editor** | core/model/languages/viewModel + contrib/{folding,find,suggest} + `editor/tui` мост. Без разноса EditorViewState | M | средний |
| **5. workbench** | parts/services/contrib/api по таблице §5; распил `AppController` (94 KB) на workbench.ts + layout.ts + фичевые модули — единственный крупный содержательный рефакторинг фазы | L | **высокий** — делать в несколько PR |
| **6. Финализация** | правила слоёв в eslint включить в error, переписать docs/ARCHITECTURE.md + docs/arch/* под новую карту, обновить AGENTS.md | M | низкий |

Опциональные углубления (отдельно, после миграции, по мере надобности):
- ContextKeyExpr AST вместо `new Function` — прямой порт из `platform/contextkey` (уже в TODO/WhenContext) — L
- PieceTree — порт `pieceTreeTextBuffer` (уже в TODO) — упрощается парностью путей — L
- Разнос `EditorViewState` на viewModel/viewLayout/cursor — L
- ProxyIdentifier-типизация RPC — M
- `configurationRegistry` со схемами/скоупами — M

Итого ядро миграции — **порядка 2–4 недель календарно** при работе через агентов
с ревью по фазе за раз (каждая фаза — отдельный PR, репозиторий остаётся зелёным
между фазами).

## 8. Риски и как их гасить

1. **Разовый чёрн импортов** — почти каждый файл потрогается. Гасится: кодемод +
   фазность + запрет содержательных изменений в mv-коммитах (git отслеживает переносы,
   blame выживает при `git log --follow`).
2. **Распил AppController** — единственное место, где легко внести регрессию.
   Гасится: сначала mv как есть в `workbench/tui/workbench.ts`, распил — отдельными
   маленькими PR под прикрытием e2e-скриншотов.
3. **Сборка SEA/tsup** — пути входов и ассетов зашиты в конфиги; фаза 0 обязана
   прогнать полный e2e + SEA-сборку (помним про OOM-ограничения машины).
4. **Расхождение с docs/arch/*.md** — вся документация слоёв устареет разом; переписка
   в фазе 6, до того — заметка-редирект в ARCHITECTURE.md.
5. **Соблазн «заодно отрефакторить»** — главный убийца таких миграций. Правило:
   в фазах 1–5 семантика не меняется (кроме объявленных Emitter/lifecycle), все
   улучшения — в «опциональные углубления».

## 9. Вердикт

**Да, сможем, и это стоит сделать.** Ключевые аргументы:

1. vexx уже семантически синхронизирован с vscode — контракты (`IConfigurationService`,
   `IMarkerService`, `TokenizationRegistry`, when-контексты, theme-формат, `vscode.d.ts`,
   RPC extension host) совпадают. Несинхронизирована только **раскладка по каталогам** —
   то есть самая дешёвая для изменения часть.
2. Парность путей даёт: (а) «подсматривание» диффом — наш
   `src/vs/platform/configuration/common/configuration.ts` против такого же пути upstream;
   (б) готовые места для всех будущих фич (scm, outline, notifications…);
   (в) агенты и люди, знающие vscode, ориентируются в vexx без обучения.
3. Три развилки, где повторять не надо (DI-декораторы, глобальный Registry,
   contribution-side-effects), развязываются повторением **путей и имён** без
   повторения **механизма** — профит парности сохраняется.
4. Стоимость управляемая: ядро — механика на 2–4 недели фазовых PR, содержательный
   риск сконцентрирован в одном месте (AppController) и изолируем.

Рекомендуемый порядок запуска: фаза 0 (тулинг + кодемод) → фаза 2 (tui-движок, самая
дешёвая, обкатка процесса) → 1 → 3 → 4 → 5 → 6.
