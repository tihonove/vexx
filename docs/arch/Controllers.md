# Controllers/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Контроллеры приложения с чётким lifecycle. Контракт `IController` (extends `IDisposable`):
- **constructor** (sync) — создаёт UI-скелет (`view`), все поля non-null
- **mount()** — подписки и wiring после вставки view в дерево
- **activate()** (async) — загрузка данных, внешние сервисы
- **dispose()** — cleanup (LIFO через `Disposable.register()`)

Родитель создаёт дочерние контроллеры, вставляет их `view`, вызывает `mount()`/`activate()`. Корневой — `AppController` (меню, шорткаты), плюс `EditorController` и др. Зависимости объявляются через `static dependencies` и резолвятся DI-контейнером (см. [../DI.md](../DI.md)). Подкаталог `Controllers/Modules/` — модули и профили DI (production vs test через `Ctx`-параметры), см. [../DI.md](../DI.md#модули-и-профили).

## Разделение Controller / Element / State (целевой паттерн)
Виджет со сколько-нибудь сложным поведением строится из трёх частей, а не из «толстого» элемента:
- **Controller** (слой Controllers) — логика, I/O, подписки, оркестрация;
- **Element** (слой TUIDom) — тонкий: только render + локальные input-события;
- опц. **State-класс** — выделенное изменяемое состояние виджета.

Связь двунаправленная и без обратной зависимости TUIDom→Controllers: `element.onX = …` (element → controller) и `controller.update(view)` (controller → element). Эталоны: `StatusBarController` ↔ `StatusBarElement`, `EditorGroupController` ↔ `EditorGroupElement`, `InputWidgetController` ↔ `InputElement` + `InputState`. К этому паттерну сводим «контроллеры под видом элемента» (напр. `MenuBarElement`, `ContextMenuLayer`) — см. [../TODO/Inspector.md](../TODO/Inspector.md).

## Конвенции системы команд (правила)
- ID команд, отражающих VS Code Workbench/Editor, именуются в стиле VS Code (`workbench.action.closeActiveEditor`).
- Доступность кейбиндингов — через typed when-контексты из `ContextKeys.ts` (`ContextKeyService`); фокус/UI-состояния обновляются в `AppController.updateContextKeys()`.
- Кейбинды адаптируются к терминалу по трём осям — **capability** / **tier** (`legacy < csi-u < kitty`) / **mode** (`local`/`ssh`/`tmux`) — доступны в when-клаузах (`tier == 'kitty'`, `cap_osc52`, `mode_ssh`, `os == 'mac'`). Default-бинды задают tier-зависимые fallback'и через per-binding `when`; пользовательские — через `keybindings.json` (VS Code-семантика `-command` для unbind).

## Подсистемы
- **`IFileWatcher`** — слежение за отдельным файлом. Интерфейс и `NULL_FILE_WATCHER` живут в Common (чистый IO-примитив, чтобы им мог пользоваться и слой Configuration); DI-токен `IFileWatcherDIToken` (`IFileWatcherDIToken.ts`) и реальная реализация `ChokidarFileWatcher` — здесь. `EditorGroupController` инжектит его в каждый `EditorController` (детект внешних изменений, см. [Editor.md](Editor.md)). Дерево файлов слушается отдельно в `FileTreeDataProvider`; `ConfigurationService` следит за `settings.json` (см. [Configuration.md](Configuration.md)).
- **File tree / Quick Open / поиск** — `FileTreeController` + `FileTreeDataProvider` (ленивая загрузка дерева по уровням, watch каталогов) и `TreeViewElement` (рендер вьюпортом, мультивыбор). Quick Open (`QuickOpenController`) ищет по фоновому индексу `FileSearchService` (async-обход, `onIndexChanged`/`refreshIfStale`) через fuzzy-матчер `Common/FuzzySearch.ts`. Внутренний буфер файловых операций — `IFileClipboard` (`FileClipboardDIToken`), намеренно отдельный от текстового `IClipboard` (задел под нативную интеграцию с ОС).
- **Диагностики / Problems** — `DiagnosticsController` (headless, без `view`) проводит диагностики от поставщиков к потребителям поверх `MarkerService` (реестр — в Editor, см. [Editor.md](Editor.md)); MVP-поставщик — валидатор активного `settings.json` (неизвестные ключи → Warning; матч по точному пути через `SettingsResourceDIToken`, не по basename). Нижняя **Panel** (`PanelController` + `PanelContainerElement`, VS Code `ViewContainerLocation.Panel`) хостит вкладку Problems: `ProblemsController` строит дерево «файл → маркеры» (`TreeViewElement` поверх `ProblemsTreeDataProvider`) из `MarkerService.onDidChangeMarkers`, Enter/клик → reveal. Видимостью Panel владеет `WorkbenchLayoutElement` (тогл `workbench.action.togglePanel` Ctrl+J и `workbench.actions.view.problems` Ctrl+Shift+M, контекст-ключ `panelVisible`).
- **`Controllers/Workspace/`** — единая система отмены уровня workspace (à la VS Code `WorkspaceEdit`/`IUndoRedoService`). **Инвариант:** `UndoRedoService` хранит историю по контекстным бакетам (путь ресурса для редактора либо `WORKSPACE` для файловых операций) — Ctrl+Z в дереве (`listFocus`) и в редакторе (`textInputFocus`) не пересекаются, но идут через **один** сервис. Текстовая отмена подключена сюда же: `UndoManager` (Editor) остаётся движком inverse-edits, а `EditorController.attachUndoRouting` регистрирует обёртки в `UndoRedoService`. Файловые правки исполняет `WorkspaceEditService`; удаление — в системную корзину через `TrashService` (иначе безвозвратно и без истории). Подтверждения рисует `AppController` (`ConfirmDialogElement`, `pointerPolicy:"modal"`).
- **`Controllers/TerminalEnvironment/`** — `TerminalEnvironmentService` резолвит tier/capabilities/modes/OS **синхронно** из env (старт не блокируется) и дополнительно запускает **fire-and-forget** пробу клавиатурного протокола через `ITerminalBackend.probeKeyboardProtocol` (Kitty-флаги + DA1). Проба может лишь **повысить** `extended-keys` (внутри tmux/ssh, где `$TERM` маскируется), после чего летит `onDidChange`; никто её не ждёт. Конфиг-секция `terminal.*` форсит значения.
