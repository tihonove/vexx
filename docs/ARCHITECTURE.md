# Vexx — Архитектура

Этот файл — **концептуальная карта**: обзор структуры `src/vs/`, правила
зависимостей и ссылки на детальные документы. Детальный per-layer справочник
живёт в [arch/](arch/) (файлы названы по историческим слоям — таблица
соответствия ниже).

Раскладка репозитория **зеркалит upstream VS Code** (`microsoft/vscode`,
`src/vs/*`): пути и имена файлов совпадают с upstream везде, где у vexx есть
1:1-аналог (`vs/platform/configuration/common/configuration.ts`,
`vs/editor/common/core/range.ts`, `vs/workbench/api/common/extHostTypes.ts`, …).
Это позволяет «подсматривать» решения диффом с upstream и даёт готовые места
для будущих фич. Обоснование и полная таблица маппинга — в
`docs/VSCODE_STRUCTURE_MIGRATION.md` (ветка `docs/vscode-structure-migration`,
PR #141).

## Две оси структуры

Как у vscode, код организован по двум осям.

**1. Вертикальные слои** (нижние не знают о верхних):

```
vs/base/common → vs/base/node → vs/tui → vs/base/tui → vs/platform → vs/editor → vs/workbench → vs/vexx
```

| Слой | Назначение |
|------|-----------|
| `vs/base/` | Утилиты и UI-примитивы без сервисных зависимостей: `common` (геометрия, lifecycle, unicode, fuzzy, ассеты), `node` (SEA, fs-ассеты), `tui` (TUIDom-ядро: `tuiElement`, события, стили, JSX, layout; виджеты — `tui/ui/<виджет>/`) |
| `vs/tui/` | **Слой вне vscode-стека**: «движок браузера» vexx — `rendering` (grid, double-buffer, ANSI-diff, скриншоты), `input` (парсинг stdin, Kitty protocol), `backend` (терминальный I/O) |
| `vs/platform/` | Сервисы «ниже редактора»: instantiation (DI), log, configuration, state, keybinding, commands, contextkey, markers, undoRedo, quickinput, theme, clipboard, files, environment, extensions, extensionManagement, product |
| `vs/editor/` | Ядро редактора: `common/{core,model,viewModel,languages,tokens}`, виджет-мост `tui/editorElement.ts`, фичи `contrib/{folding,find,suggest}` |
| `vs/workbench/` | Воркбенч: `tui/` (workbench.ts, layout.ts, contextkeys.ts, parts/*), `services/*`, `contrib/*`, `api/` (extension host) |
| `vs/vexx/` | Точка входа (аналог `vs/code`): `main.ts` (bootstrap), `modules/` (DI-профили) |

`vs/tui` — единственное отступление от стека upstream: у vscode браузер дан
снаружи, у vexx «браузер» — свой код. Он ниже `vs/base/tui` (TUIDom рендерится
через него) и выше `vs/base/common`.

**2. Окружения** (подкаталог внутри слоя): `common` → только `common`;
`node` → `common`+`node`; `tui` → `common`+`node`+`tui`. В отличие от
браузерной песочницы vscode, vexx — нативное node-приложение, поэтому
tui-окружению доступен node. `tui` играет роль `browser` upstream'а —
при сравнении с vscode маппинг каталогов `tui` ↔ `browser`.

Правила обеих осей проверяет `npm run valid-layers-check`
(`scripts/check-layers.mjs`, аналог layersChecker у vscode). Известные
нарушения зафиксированы там в `EXCEPTIONS` с причинами; список должен только
уменьшаться, новые нарушения роняют проверку.

## Вне src/vs

- `src/vscode-dts/vscode.d.ts` — запиненная поверхность расширенческого API
  (путь как у upstream).
- `src/Inspector/` — инспектор TUIDom («дебаг-порт»), рукописный WebSocket.
- `src/TestUtils/`, `src/demos/`, `src/StoryRunner/` — dev-тулинг.
- `extensions/` — встроенные расширения (48 языковых паков + git), зеркалит
  корневой `extensions/` upstream. Пин версии — `extensions/VSCODE_VERSION`.
- `e2e/`, `scripts/` — сквозные тесты и сборка (SEA, ассеты, импорт из upstream).

## Карта каталогов src/vs

### base/
`common`: геометрия (`geometry.ts`), `lifecycle.ts` (IDisposable/Disposable),
`types.ts`, юникод-ширина (`unicodeWidth.ts`, `displayLine.ts`),
`fuzzySearch.ts`, `color.ts` (packRgb), `scrollable.ts`, `terminalEnv.ts`,
`assets/` (виртуальные ассеты: формат бандла + доступ). `node`: `isSea.ts`,
fs/SEA-реализации ассетов. `tui`: TUIDom-ядро — `tuiElement.ts`,
`tuiApplication.ts`, `bodyElement.ts`, `events/`, `styles/`, `jsx/`,
`tuiSelector.ts`; виджеты в `ui/<виджет>/` (scrollbar, tree, inputbox, button,
sash, menu, dialog, contextview, box, layout, text — имена каталогов как в
`vs/base/browser/ui`). Детали → [arch/Common.md](arch/Common.md),
[arch/TUIDom.md](arch/TUIDom.md), layout → [LAYOUT.md](LAYOUT.md).

### tui/ (движок)
`rendering/` — grid/double-buffer/ANSI-diff, `gridSnapshot.ts` + `gridToSvg.ts`
(скриншоты); `input/` — байты stdin → токены → browser-like события, мышь,
Kitty protocol; `backend/` — `terminalBackend.ts` (интерфейс) + Node/Mock/
HeadlessCapture. Детали → [arch/Rendering.md](arch/Rendering.md),
[arch/Input.md](arch/Input.md), [arch/Backend.md](arch/Backend.md).

### platform/
По каталогу на сервис, внутри — окружения. Ключевое:
`instantiation/` — DI-примитивы (`Token`/`Container`/`token()`; **наша токенная
модель, не декораторы** — сознательно, ради erasable syntax и SEA);
`log/`, `configuration/` (+`state/` — машинное состояние, см.
[arch/State.md](arch/State.md)), `keybinding/` (реестр + user keybindings.json +
`modifierReleaseArmory`), `commands/`, `contextkey/`, `markers/`, `undoRedo/`,
`quickinput/` (QuickPick/InputBox), `theme/` (color registry `colorRegistry.ts`,
`colors.ts`, формат theme-файлов, `workbenchTheme.ts` ≈ IColorTheme),
`clipboard/` (OSC52 — в `tui`), `files/` (watcher, trash), `environment/`
(argv, userDataPath), `extensions/` (манифест, скан), `extensionManagement/`
(.vsix), `product/` (версия). Детали → [arch/Configuration.md](arch/Configuration.md),
[arch/Theme.md](arch/Theme.md), [DI.md](DI.md).

### editor/
`common/core` (position/range/selection/textEdit/eol/word), `common/model.ts`
(ITextDocument ≈ ITextModel) + `common/model/` (textDocument, undoManager,
indentationDetector, foldingRegion, декорации), `common/viewModel/`
(editorViewState), `common/languages.ts` (completion-интерфейсы) +
`common/languages/` (language, state, tokenizationSupport, tokenStyleResolver,
autoIndent, languageConfiguration, встроенные токенизаторы),
`common/tokenizationRegistry.ts`, `common/tokens/` (lineTokens,
documentTokenStore). `tui/` — `editorElement.ts` (виджет-мост, аналог
editor/browser) и `coreCommands.ts` (cursor*-команды). `contrib/` — folding,
find, suggest (контроллер+экшены+виджет каждой фичи). Editor не зависит от
workbench-сервисов напрямую — связь через интерфейсы (`tokenStyleResolver`,
`language`); исключения перечислены в check-layers. Детали →
[arch/Editor.md](arch/Editor.md).

### workbench/
- `tui/` — `workbench.ts` (бывший AppController: сборка графа контроллеров,
  view, lifecycle, quit), `layout.ts` (WorkbenchLayoutElement),
  `contextkeys.ts`, `controller.ts` (IController: constructor → mount →
  activate → dispose), `stateKeys.ts`, `coreTokens.ts`, `actions/`
  (layoutActions, listActions, inputActions, appActions), `parts/` (editor —
  группа+табы+контроллеры, statusbar, panel, menubar).
- `services/` — keybinding (диспетчер клавиатуры: аккорды, overlay-модальность),
  dialogs (модальные диалоги), themes (ThemeService/реестр/встроенные темы),
  textMate (грамматики поверх vscode-textmate), textfile (save participants),
  language (реестр языков), search (файловый индекс), extensions (extension
  host: subprocess-менеджер + RPC `rpcProtocol.ts`).
- `contrib/` — files (дерево+FileCommands), markers (Problems), quickaccess
  (QuickOpen), preferences, themes (пикер), bulkEdit (workspace edits).
- `api/` — поверхность `vscode` для расширений: `common/extHost*.ts`
  (subprocess-сторона, `extHost.api.impl.ts` собирает namespace),
  `tui/mainThread*.ts` (адаптеры ядра), `node/extensionHostProcess.ts`
  (entry сабпроцесса). Детали → [arch/Extensions.md](arch/Extensions.md).
- `terminalEnvironment/` — vexx-специфичный детект tier/capabilities/modes.

Детали по контроллерам → [arch/Controllers.md](arch/Controllers.md).

### vexx/
`main.ts` — bootstrap: CLI → user data paths → configuration → asset access →
extensions → DI → run; уход в subprocess-entry extension host'а по env-флагу.
`modules/` — ContainerModule-профили DI (production/test). Детали → [DI.md](DI.md).

## Таблица соответствия: детальные доки ↔ новые пути

| Док в arch/ | Сегодняшние каталоги |
|-------------|----------------------|
| Common.md | `vs/base/{common,node}` + `vs/platform/{log,clipboard,environment,product,instantiation}` |
| Input.md / Rendering.md / Backend.md | `vs/tui/{input,rendering,backend}` |
| TUIDom.md | `vs/base/tui` (+ `ui/*`) |
| Editor.md | `vs/editor/*` + `vs/platform/markers` |
| Theme.md | `vs/platform/theme` + `vs/workbench/services/themes` + `vs/workbench/contrib/themes` |
| Configuration.md / State.md | `vs/platform/{configuration,state,keybinding}` |
| Controllers.md | `vs/workbench/{tui,contrib,services}` + `vs/platform/{commands,contextkey,quickinput,undoRedo,files}` |
| Extensions.md | `vs/workbench/api` + `vs/workbench/services/extensions` + `vs/platform/extensions*` + `extensions/` |
| DevTooling.md | `src/{TestUtils,demos,StoryRunner}` |
| Inspector.md | `src/Inspector` |

## Правила зависимостей

Формально: вертикаль + окружения из раздела «Две оси», проверка —
`npm run valid-layers-check`. Дополнительные содержательные правила:

- **base** не импортирует ничего выше себя; `vs/tui` видит только `vs/base/common`.
- **editor** не импортирует workbench (исключения — в EXCEPTIONS чекера:
  contrib-контроллеры пока знают конкретный `EditorGroupController`; развязка —
  ICodeEditor-подобный интерфейс, отдельной задачей).
- **workbench/api** (mainThread-адаптеры) — единственное место, где extension
  host дотягивается до контроллеров и тем; ядро про источник декораций
  (git/SCM) не знает.
- **Inspector** зависит от `vs/base/tui` и `vs/base/common` (+ type-only
  `gridSnapshot`); транспорт — `node:http`, рукописный WebSocket.
- **extensions/** (встроенные) собираются esbuild'ом в память/бандл и общаются
  с ядром только через RPC extension host'а.

### DI-контейнер: границы использования

Примитивы DI (`Token`, `Container`, `token()`) — в
`vs/platform/instantiation/common/instantiation.ts`. **Объявлять DI-токены**
можно в файле сервиса (рядом с интерфейсом, как `logDIToken.ts`) или на
уровнях workbench/vexx; **импортировать `Container`** — только в
`vs/vexx/modules` и `main.ts` (+ тестовые харнессы). Все токены именуются
`*DIToken`. Подробности — [DI.md](DI.md).
