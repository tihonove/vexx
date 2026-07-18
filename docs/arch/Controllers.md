# Controllers/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

> **Слой растворяется в Workbench.** Логика поэтапно переезжает в `Workbench/Services/`,
> UI-сборка — в `Workbench/Components/`; см. [Workbench.md](Workbench.md) и план
> в [../TODO/WorkbenchRefactoring.md](../TODO/WorkbenchRefactoring.md). Уже переехали:
> система команд (`CommandRegistry`/`KeybindingRegistry`/`ContextKeyService`/`ContextKeys`),
> `StateKeys`, `ModifierReleaseArmory`, `ChokidarFileWatcher`+`IFileWatcherDIToken`,
> `FileSearchService`, `QuickOpenParsing`, `collectWordCompletions`, `CoreTokens`,
> каталоги `Workspace/` (кроме `TrashService`/`WorkspaceEditService`), `TerminalEnvironment/`,
> `Terminal/`, `Diagnostics/`; Panel-кластер (этап 6): `DiagnosticsService`,
> `PanelService`+`PanelComponent`, `ProblemsComponent`, `TerminalService`+
> `TerminalPanelComponent` (контроллеры Diagnostics/Panel/Problems/Terminal растворены);
> QuickInput-кластер (этап 8): `QuickInputService`+`QuickInputComponent`,
> `QuickOpenService` (контроллеры QuickInput/QuickOpen растворены; пикеры
> selectTheme/openFile/openFolder/quickOpen — экшены `Workbench/Actions/`);
> Editor-кластер (этап 9): `TextFileModel`+`EditorComponent` (9a) и
> `EditorService`+`EditorGroupComponent`+`EditorPane` (9b, `EditorGroupController`
> растворён; экшены ContextMenu/Encoding/Eol — в `Workbench/Actions/`);
> Find/Suggest-кластер (этап 10): `FindService`+`FindComponent` и
> `CompletionService`+`SuggestComponent` (контроллеры Find/Completion растворены;
> экшены Find*/Suggest* с реальными `run(accessor)` — в `Workbench/Actions/`);
> Shell-кластер (этап 11): `MenuService`+`MenuBarComponent`, `LayoutService`,
> `WorkbenchStateService` (бывш. `WorkbenchStateController`),
> `WorkbenchContextKeys`; каталог `Controllers/Actions/` растворён целиком в
> `Workbench/Actions/` (включая список `builtinActions.ts`).
> На время миграции Controllers временно **над** Workbench
> (импортирует его; обратно — никогда).

Контроллеры приложения с чётким lifecycle. Контракт `IController` (extends `IDisposable`):
- **constructor** (sync) — создаёт UI-скелет (`view`), все поля non-null
- **mount()** — подписки и wiring после вставки view в дерево
- **activate()** (async) — загрузка данных, внешние сервисы
- **dispose()** — cleanup (LIFO через `Disposable.register()`)

Родитель создаёт дочерние контроллеры, вставляет их `view`, вызывает `mount()`/`activate()`. С этапа 11 остался **один** — корневой `AppController`, тонкая скорлупа (~430 строк): конструирует корневую view (`BodyElement` + `WorkbenchLayoutElement`), вставляет в неё view компонентов Workbench, прикрепляет late-init швы (`attachHost`/`attachLayout`/`attachView`), регистрирует `builtinActions` (+ перекрывает `run` у quit confirm-save-флоу через `LifecycleService`) и ведёт bootstrap-жизненный цикл (mount → activate → open/restore файлов). Вся остальная логика — сервисы/компоненты Workbench: персистентность сессии — `WorkbenchStateService` + `LayoutService`, контекст-ключи — `WorkbenchContextKeys`, меню — `MenuService`+`MenuBarComponent` (см. [Workbench.md](Workbench.md)). Зависимости объявляются через `static dependencies` и резолвятся DI-контейнером (см. [../DI.md](../DI.md)). Подкаталог `Controllers/Modules/` — модули и профили DI (production vs test через `Ctx`-параметры), см. [../DI.md](../DI.md#модули-и-профили).

## Разделение Controller / Element / State (целевой паттерн)
Виджет со сколько-нибудь сложным поведением строится из трёх частей, а не из «толстого» элемента:
- **Controller** (слой Controllers) — логика, I/O, подписки, оркестрация;
- **Element** (слой TUIDom) — тонкий: только render + локальные input-события;
- опц. **State-класс** — выделенное изменяемое состояние виджета.

Связь двунаправленная и без обратной зависимости TUIDom→Controllers: `element.onX = …` (element → controller) и `controller.update(view)` (controller → element). Эталоны: `EditorGroupComponent` (Workbench) ↔ `EditorGroupElement`, `InputWidgetService` (Workbench) ↔ `InputElement` + `InputState`. К этому паттерну сводим «контроллеры под видом элемента» (напр. `MenuBarElement`, `ContextMenuLayer`) — см. [../TODO/Inspector.md](../TODO/Inspector.md). Целевая модель, в которую контроллеры мигрируют, — Service ↔ Component слоя Workbench (эталон — статус-бар, см. [Workbench.md](Workbench.md)).

## Конвенции системы команд (правила)
- ID команд, отражающих VS Code Workbench/Editor, именуются в стиле VS Code (`workbench.action.closeActiveEditor`).
- Доступность кейбиндингов — через typed when-контексты из `Workbench/Services/ContextKeys.ts` (`ContextKeyService`); фокус/UI-состояния обновляет `WorkbenchContextKeys.update()` (Workbench, этап 11). Сама система команд (`CommandRegistry`/`KeybindingRegistry`/`ContextKeyService`) живёт в `Workbench/Services/`.
- Кейбинды адаптируются к терминалу по трём осям — **capability** / **tier** (`legacy < csi-u < kitty`) / **mode** (`local`/`ssh`/`tmux`) — доступны в when-клаузах (`tier == 'kitty'`, `cap_osc52`, `mode_ssh`, `os == 'mac'`). Default-бинды задают tier-зависимые fallback'и через per-binding `when`; пользовательские — через `keybindings.json` (VS Code-семантика `-command` для unbind).

## Подсистемы
- **`IFileWatcher`** — слежение за отдельным файлом. Интерфейс и `NULL_FILE_WATCHER` живут в Common (чистый IO-примитив, чтобы им мог пользоваться и слой Configuration); DI-токен `IFileWatcherDIToken` (`Workbench/Services/IFileWatcherDIToken.ts`) и реальная реализация `ChokidarFileWatcher` — в `Workbench/Services/`. `EditorService` инжектит его в каждую `TextFileModel` (детект внешних изменений, см. [Editor.md](Editor.md)). Дерево файлов слушается отдельно в `FileTreeDataProvider`; `ConfigurationService` следит за `settings.json` (см. [Configuration.md](Configuration.md)).
- **File tree / Quick Open / поиск** — Explorer мигрировал в Workbench (этап 7 рефакторинга): `ExplorerService` + `ExplorerComponent` + `FileTreeDataProvider` (ленивая загрузка дерева по уровням, watch каталогов) поверх `TreeViewElement` (рендер вьюпортом, мультивыбор); файловые операции — `FileOperationsService`; см. [Workbench.md](Workbench.md). Quick Open (`QuickOpenService`, Workbench, этап 8) ищет по фоновому индексу `FileSearchService` (`Workbench/Services/`; async-обход, `onIndexChanged`/`refreshIfStale`) через fuzzy-матчер `Common/FuzzySearch.ts`; goto-line читает активный редактор через шов `IGotoLineEditorSource` → `EditorService`. Внутренний буфер файловых операций — `IFileClipboard` (`FileClipboardDIToken`), намеренно отдельный от текстового `IClipboard` (задел под нативную интеграцию с ОС).
- **Диагностики / Problems** — мигрировали в Workbench (этап 6 рефакторинга): `DiagnosticsService` (проводник поставщики → `MarkerService` → потребители; шов `IDiagnosticsEditorSource` → `EditorService`), нижняя Panel — `PanelService` + `PanelComponent`, дерево Problems — `ProblemsComponent` (шов reveal `IMarkerRevealTarget` → `EditorService`); см. [Workbench.md](Workbench.md). Команды (тогл `workbench.action.togglePanel` Ctrl+J и `workbench.actions.view.problems` Ctrl+Shift+M) с этапа 11 — экшены `Workbench/Actions/LayoutActions.ts` поверх `LayoutService`/`PanelService`; layout и контекст-ключ `panelVisible` следуют за `PanelService.onDidChangeVisibility` через `LayoutService`.
- **`Workbench/Services/Workspace/`** (бывш. `Controllers/Workspace/`; с этапа 7 здесь же `TrashService`, `WorkspaceEditService` и `fileClipboardFs.ts`) — единая система отмены уровня workspace (à la VS Code `WorkspaceEdit`/`IUndoRedoService`). **Инвариант:** `UndoRedoService` хранит историю по контекстным бакетам (путь ресурса для редактора либо `WORKSPACE` для файловых операций) — Ctrl+Z в дереве (`listFocus`) и в редакторе (`textInputFocus`) не пересекаются, но идут через **один** сервис. Текстовая отмена подключена сюда же: `UndoManager` (Editor) остаётся движком inverse-edits, а `TextFileModel.attachUndoRouting` регистрирует обёртки в `UndoRedoService` (перепривязку к пересозданному `EditorElement` делает `EditorComponent`). Файловые правки исполняет `WorkspaceEditService`; удаление — в системную корзину через `TrashService` (иначе безвозвратно и без истории). Подтверждения показывает `DialogService` (Workbench, `ConfirmDialog`, `pointerPolicy:"modal"`).
- **Статус-бар** — мигрировал в Workbench (этап 4 рефакторинга): `StatusBarService` + `StatusBarComponent` + contribution-сервисы (см. [Workbench.md](Workbench.md)). Пикеры команд `changeEncoding`/`changeEOL` с этапа 9b — экшены `Workbench/Actions/EncodingActions.ts`/`EolActions.ts` поверх `QuickInputService` + `EditorService`. Chord-хинт публикует `KeybindingDispatcher` (Workbench) через `StatusBarService`.
- **`Workbench/Services/TerminalEnvironment/`** (бывш. `Controllers/TerminalEnvironment/`) — `TerminalEnvironmentService` резолвит tier/capabilities/modes/OS **синхронно** из env (старт не блокируется) и дополнительно запускает **fire-and-forget** пробу клавиатурного протокола через `ITerminalBackend.probeKeyboardProtocol` (Kitty-флаги + DA1). Проба может лишь **повысить** `extended-keys` (внутри tmux/ssh, где `$TERM` маскируется), после чего летит `onDidChange`; никто её не ждёт. Конфиг-секция `terminal.*` форсит значения.
- **Встроенный терминал** — мигрировал в Workbench (этап 6 рефакторинга): `TerminalService` (headless-оркестратор инстансов; шелл спавнится **лениво** при первом открытии/активации вкладки, cwd = папка воркспейса, PTY убивается при выходе шелла или `dispose()`) + `TerminalPanelComponent` (виджеты `TerminalViewElement` в вкладке TERMINAL), см. [Workbench.md](Workbench.md). Связка node-pty + `@xterm/headless` спрятана за `ITerminalSurface` (TUIDom) и каталогом `Workbench/Services/Terminal/`: `EmbeddedTerminalSession` реализует поверхность (in-process «tmux»: реальный PTY + VT-эмулятор), `TerminalSessionFactoryDIToken` — DI-шов (тесты подменяют на `FakeTerminalSurface`, реальный PTY не спавнится), `loadNodePty.ts` — двухпутёвая загрузка нативного аддона (dev — из node_modules; SEA — распаковка вшитого ассета `node-pty.bundle` в tmp). Команды `workbench.action.terminal.toggleTerminal` (Ctrl+` только на tier `kitty`/`csi-u` — в legacy `` ` `` неоднозначен) и `workbench.action.terminal.new` с этапа 11 — экшены `Workbench/Actions/TerminalActions.ts` поверх `TerminalService`/`PanelService`/`LayoutService`; контекст-ключи `terminalFocus`/`terminalIsOpen` выставляет `WorkbenchContextKeys`. Детали и ADR по упаковке → [../TODO/IntegratedTerminal.md](../TODO/IntegratedTerminal.md).
